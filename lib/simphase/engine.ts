// ═══════════════════════════════════════════════════════════
// SimPhase — Monte Carlo Engine
// Simulates thousands of full challenge attempts, trade by
// trade, under each firm's exact rule mechanics:
//   • daily loss limits (reset each day)
//   • static / EOD-trailing / intraday-trailing max loss
//   • per-phase targets with limits resetting between phases
//   • FTMO Best Day rule (delays the pass, never breaches)
//   • Topstep consistency rule (forces extra profitable days)
//   • behavioral execution model (kill-switch, tilt, slippage)
// Zero DOM dependencies. Deterministic (seeded). Testable.
// ═══════════════════════════════════════════════════════════

import type {
  Challenge, Edge, StressMode, StressConfig,
  RiskScore, EvaluationResult, Verdict,
  ResultConfidence, DisplayStats, Recommendation, FailureBreakdown,
} from './types';

// ── Utilities ───────────────────────────────────────────────

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, d = 2): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function rf(n: number): string {
  return `${n.toFixed(2)}%`;
}

/** Deterministic PRNG (mulberry32) so identical inputs give identical results. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Stress configs (behavioral execution model) ─────────────

export function getStressConfig(mode: StressMode): StressConfig {
  if (mode === 'calm') return { wrShift: 0, rrMult: 1.0, stopAfterLosses: 2, tiltProb: 0.03, slipMax: 0.06 };
  if (mode === 'pressure') return { wrShift: -0.04, rrMult: 0.90, stopAfterLosses: 4, tiltProb: 0.25, slipMax: 0.22 };
  return { wrShift: -0.01, rrMult: 0.97, stopAfterLosses: 3, tiltProb: 0.12, slipMax: 0.12 }; // realistic
}

// ── Challenge helpers ───────────────────────────────────────

export function getTargetPct(challenge: Challenge, size: number): number {
  // Combined target across phases (informational).
  let total = 0;
  for (const ph of challenge.phases) {
    total += ph.target != null ? ph.target : (ph.targetDollar?.[size] || 0) / size;
  }
  return total;
}

export function getOverallLossPct(challenge: Challenge, size: number): number {
  if (challenge.overallLoss != null) return challenge.overallLoss;
  const d = challenge.overallLossDollar?.[size] || challenge.trailingDollar?.[size] || 0;
  return d ? d / size : (challenge.trailingPct || 0);
}

export function marketFitBonus(userMarket: string, challengeMarket: string): number {
  if (userMarket === 'mixed') return 0;
  if (userMarket === challengeMarket) return 0.03;
  if (userMarket === 'indices' && challengeMarket === 'cfd') return 0.01;
  return -0.01;
}

// ── Simulation core ─────────────────────────────────────────

const MAX_TRADING_DAYS = 60;    // practical abandonment horizon per attempt (~3 months)
const MAX_CALENDAR_LOOPS = 340; // safety cap on day loop

type FailReason = 'daily' | 'overall' | 'trailing' | 'slow';

interface SimParams {
  winRate: number;
  payoff: number;       // R multiple of avg loss
  /** Sampling uncertainty: each attempt draws a "true" win rate ~ N(winRate, wrSd). */
  wrSd: number;
  /** Lognormal sigma for the per-attempt true payoff ratio. */
  rrSdLog: number;
  tradesPerDay: number;
  risk: number;         // fraction of initial balance per trade (e.g. 0.005)
  phases: { target: number; minDays: number }[]; // target as fraction of initial
  dailyLoss: number;    // fraction of initial; 0 = none
  overallLoss: number | null; // static, fraction of initial
  trailing: 'none' | 'eod' | 'intraday';
  trailingDist: number; // fraction of initial
  trailingFreeze: boolean;
  bestDayCap: number | null;     // of positive days' profit
  consistencyCap: number | null; // of profit target
  stress: StressConfig;
}

interface SimOutcome {
  passed: boolean;
  reason: FailReason | null;
  tradingDays: number;   // total across phases
  delayed: boolean;      // pass was delayed by best-day / consistency rule
}

function gaussian(rng: () => number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simulateAttempt(p: SimParams, rng: () => number): SimOutcome {
  // Your backtest pins your edge only within a confidence interval.
  // Each attempt draws a plausible "true" edge from that interval —
  // this is where most of the real-world risk lives.
  const wrTrue = p.winRate + gaussian(rng) * p.wrSd;
  const rrTrue = p.payoff * Math.exp(gaussian(rng) * p.rrSdLog - 0.5 * p.rrSdLog * p.rrSdLog);
  const wr = clamp(wrTrue + p.stress.wrShift, 0.02, 0.98);
  const rr = Math.max(rrTrue * p.stress.rrMult, 0.1);
  const baseTrades = Math.floor(p.tradesPerDay);
  const fracTrade = p.tradesPerDay - baseTrades;
  let totalDays = 0;
  let delayed = false;

  for (let phaseIdx = 0; phaseIdx < p.phases.length; phaseIdx++) {
    const phase = p.phases[phaseIdx];
    let balance = 0;            // P/L relative to phase start (fraction of initial)
    let floor = -1e9;
    if (p.overallLoss != null) floor = -p.overallLoss;
    let trailFloor = -1e9;
    if (p.trailing !== 'none') trailFloor = -p.trailingDist;
    let peak = 0;               // highest balance (EOD or intraday depending on mode)
    let bestDay = 0;
    let positiveDaysProfit = 0;
    let phaseDays = 0;
    let loops = 0;
    let phaseDone = false;

    while (!phaseDone) {
      loops++;
      if (loops > MAX_CALENDAR_LOOPS || totalDays + phaseDays >= MAX_TRADING_DAYS) {
        return { passed: false, reason: 'slow', tradingDays: totalDays + phaseDays, delayed };
      }
      // how many trades today
      let tradesToday = baseTrades + (rng() < fracTrade ? 1 : 0);
      if (tradesToday <= 0) continue; // non-trading day
      phaseDays++;

      const dayStart = balance;
      let dayPnl = 0;
      let lossesToday = 0;
      let tilted = false;

      for (let t = 0; t < tradesToday; t++) {
        // discipline: kill-switch after N losses, with tilt probability of pushing past it
        if (lossesToday >= p.stress.stopAfterLosses) {
          if (!tilted && rng() < p.stress.tiltProb) {
            tilted = true; // take 1-2 extra trades on tilt
            tradesToday = t + 1 + (rng() < 0.5 ? 1 : 0);
          } else break;
        }
        // discipline: stop the day at ~65% of the daily budget (matches the execution plan)
        if (p.dailyLoss > 0 && dayPnl <= -0.65 * p.dailyLoss && !tilted) break;

        const win = rng() < wr;
        let pnl: number;
        if (win) {
          pnl = p.risk * rr * (0.9 + rng() * 0.2);          // ±10% outcome noise
        } else {
          pnl = -p.risk * (1 + rng() * p.stress.slipMax);   // slippage on losses
          lossesToday++;
        }
        balance += pnl;
        dayPnl += pnl;

        // intraday trailing max loss (Topstep): floor follows live equity peak
        if (p.trailing === 'intraday') {
          if (balance > peak) {
            peak = balance;
            const nf = peak - p.trailingDist;
            trailFloor = Math.max(trailFloor, p.trailingFreeze ? Math.min(nf, 0) : nf);
          }
          if (balance <= trailFloor) {
            return { passed: false, reason: 'trailing', tradingDays: totalDays + phaseDays, delayed };
          }
        }
        // static overall max loss
        if (p.overallLoss != null && balance <= floor) {
          return { passed: false, reason: 'overall', tradingDays: totalDays + phaseDays, delayed };
        }
        // hard daily loss breach
        if (p.dailyLoss > 0 && (balance - dayStart) <= -p.dailyLoss) {
          return { passed: false, reason: 'daily', tradingDays: totalDays + phaseDays, delayed };
        }
        // EOD trailing checked against equity continuously, floor updates only at EOD
        if (p.trailing === 'eod' && balance <= trailFloor) {
          return { passed: false, reason: 'trailing', tradingDays: totalDays + phaseDays, delayed };
        }
      }

      // end of day bookkeeping
      if (dayPnl > 0) {
        positiveDaysProfit += dayPnl;
        if (dayPnl > bestDay) bestDay = dayPnl;
      }
      if (p.trailing === 'eod') {
        if (balance > peak) {
          peak = balance;
          const nf = peak - p.trailingDist;
          trailFloor = Math.max(trailFloor, p.trailingFreeze ? Math.min(nf, 0) : nf);
        }
      }

      // pass check (at end of day)
      if (balance >= phase.target && phaseDays >= phase.minDays) {
        let ok = true;
        if (p.bestDayCap != null && positiveDaysProfit > 0 && bestDay > p.bestDayCap * positiveDaysProfit) {
          ok = false; delayed = true; // FTMO best-day: keep trading, not a breach
        }
        if (p.consistencyCap != null && bestDay > p.consistencyCap * phase.target) {
          ok = false; delayed = true; // Topstep consistency: keep trading
        }
        if (ok) phaseDone = true;
      }
    }
    totalDays += phaseDays;
  }
  return { passed: true, reason: null, tradingDays: totalDays, delayed };
}

interface BatchStats {
  passProb: number;
  failureBreakdown: FailureBreakdown;
  medianDays: number;
  p25Days: number;
  p75Days: number;
  avgDaysAll: number; // avg trading days per attempt (pass or fail) — for monthly cost
  delayedShare: number;
  runs: number;
}

function runBatch(p: SimParams, nRuns: number, seed: number): BatchStats {
  const rng = makeRng(seed);
  let passes = 0, delayedPasses = 0, daysAllSum = 0;
  const fails: Record<FailReason, number> = { daily: 0, overall: 0, trailing: 0, slow: 0 };
  const passDays: number[] = [];

  for (let i = 0; i < nRuns; i++) {
    const o = simulateAttempt(p, rng);
    daysAllSum += o.tradingDays;
    if (o.passed) {
      passes++;
      passDays.push(o.tradingDays);
      if (o.delayed) delayedPasses++;
    } else if (o.reason) {
      fails[o.reason]++;
    }
  }

  passDays.sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : 0;
  const nFail = Math.max(nRuns - passes, 1);

  return {
    passProb: passes / nRuns,
    failureBreakdown: {
      daily: fails.daily / nFail,
      overall: fails.overall / nFail,
      trailing: fails.trailing / nFail,
      slow: fails.slow / nFail,
    },
    medianDays: q(passDays, 0.5),
    p25Days: q(passDays, 0.25),
    p75Days: q(passDays, 0.75),
    avgDaysAll: daysAllSum / nRuns,
    delayedShare: passes ? delayedPasses / passes : 0,
    runs: nRuns,
  };
}

// ── Param building ──────────────────────────────────────────

function buildSimParams(
  challenge: Challenge, size: number, edge: Edge, riskPct: number, stress: StressConfig,
): SimParams {
  const phases = challenge.phases.map(ph => ({
    target: ph.target != null ? ph.target : (ph.targetDollar?.[size] || 0) / size,
    minDays: ph.minDays,
  }));
  const trailingDist = challenge.trailingDollar?.[size]
    ? challenge.trailingDollar[size] / size
    : (challenge.trailingPct || 0);

  const n = Math.max(edge.sampleTrades || 30, 10);
  const wr = edge.winRate;
  // Standard error of the win-rate estimate, inflated for backtest-vs-live drift,
  // plus the input-quality penalty (manual guesses, thin samples).
  const wrSd = clamp(Math.sqrt(wr * (1 - wr) / n) * 1.25 + 0.012 + (edge.confidencePenalty || 0) * 0.20, 0.015, 0.10);
  const rrSdLog = clamp(1.1 / Math.sqrt(n) + (edge.confidencePenalty || 0) * 0.4, 0.05, 0.30);

  return {
    winRate: wr,
    payoff: edge.payoffRatio || 1.5,
    wrSd,
    rrSdLog,
    tradesPerDay: clamp(edge.tradesPerDay || 1, 0.08, 20),
    risk: riskPct / 100,
    phases,
    dailyLoss: challenge.dailyLoss || 0,
    overallLoss: challenge.overallLoss,
    trailing: challenge.trailing,
    trailingDist,
    trailingFreeze: challenge.trailingFreezesAtInitial !== false,
    bestDayCap: challenge.bestDayCap,
    consistencyCap: challenge.consistencyCap,
    stress,
  };
}

function failureLabel(challenge: Challenge, b: FailureBreakdown, medianDays: number, delayedShare: number): { label: string; share: number } {
  const entries: [string, number][] = [
    ['Daily loss breach', b.daily],
    ['Max loss breach', b.overall],
    ['Trailing drawdown', b.trailing],
    ['Too slow to target', b.slow],
  ];
  entries.sort((a, c) => c[1] - a[1]);
  let [label, share] = entries[0];
  if (share <= 0) { label = challenge.failureBase; share = 0; }
  // If most passes are delayed by distribution rules, surface that instead of a marginal failure cause
  if (delayedShare > 0.45 && challenge.bestDayCap) return { label: 'Best day concentration (delays the pass)', share: delayedShare };
  if (delayedShare > 0.45 && challenge.consistencyCap) return { label: 'Consistency pressure (delays the pass)', share: delayedShare };
  return { label, share };
}

function spendFor(challenge: Challenge, fee: number, activationFee: number, passProb: number, avgDaysPerAttempt: number): number {
  const p = Math.max(passProb, 0.02);
  const attempts = 1 / p;
  if (challenge.feeModel === 'monthly') {
    // Subscription: failed attempts within a month are covered by reset credits.
    const totalTradingDays = avgDaysPerAttempt * attempts;
    const months = Math.max(1, Math.ceil(totalTradingDays / 21));
    return months * (fee || 0) + activationFee;
  }
  return attempts * (fee || 0) + activationFee;
}

function toRiskScore(
  riskPct: number, stats: BatchStats, challenge: Challenge,
  fee: number, activationFee: number, robustness: number,
): RiskScore {
  const fm = failureLabel(challenge, stats.failureBreakdown, stats.medianDays, stats.delayedShare);
  const passProbability = stats.passProb;
  const expectedAttempts = 1 / Math.max(passProbability, 0.02);
  const grossSpend = spendFor(challenge, fee, activationFee, passProbability, Math.max(stats.avgDaysAll, 1));
  // ruleFit: how much of the failure mass is rule-driven (vs simply being too slow)
  const ruleDriven = stats.failureBreakdown.daily + stats.failureBreakdown.overall + stats.failureBreakdown.trailing;
  const ruleFit = clamp(1 - ruleDriven * (1 - passProbability), 0.05, 0.98);

  return {
    riskPct,
    passProbability,
    robustness,
    expectedAttempts,
    grossSpend,
    failureMode: fm.label,
    failureModeShare: fm.share,
    failureBreakdown: stats.failureBreakdown,
    typicalDays: Math.max(stats.medianDays, 1),
    p25Days: Math.max(stats.p25Days, 1),
    p75Days: Math.max(stats.p75Days, 1),
    delayedShare: stats.delayedShare,
    ruleFit,
    simRuns: stats.runs,
  };
}

// ── Main evaluation ─────────────────────────────────────────

export function evaluateChallenge(
  challenge: Challenge,
  size: number,
  edge: Edge,
  feeOverride: number | null = null,
  userMarket = 'cfd',
  stressMode: StressMode = 'realistic',
  quality: 'full' | 'quick' = 'full',
): EvaluationResult {
  const stress = getStressConfig(stressMode);
  const targetPct = getTargetPct(challenge, size);
  const overallLoss = getOverallLossPct(challenge, size);
  const dailyLoss = challenge.dailyLoss || 0;
  const fee = feeOverride != null ? feeOverride : (challenge.feeDefaults[size] ?? 0);
  const activationFee = challenge.activationFee || 0;
  const seedBase = hashSeed(challenge.id, size, stressMode,
    round(edge.winRate, 4), round(edge.payoffRatio, 3), round(edge.tradesPerDay, 3));

  // Risk ceiling: streak exposure must stay inside the daily loss budget (or its proxy)
  const dailyPressure = dailyLoss > 0 ? dailyLoss
    : (challenge.trailing !== 'none' ? overallLoss * 0.5 : (overallLoss || 0.06) * 0.55);
  const streakRef = Math.max(edge.maxConsecLosses, 3);
  const maxRiskPct = clamp((dailyPressure / streakRef) * 0.9 * 100, 0.30, 2.50);

  const coarseN = quality === 'full' ? 900 : 400;
  const refineN = quality === 'full' ? 3000 : 1200;
  const finalN = quality === 'full' ? 9000 : 3000;

  // Objective: maximize pass probability, with a mild pace penalty so the
  // recommendation is a plan a trader actually executes (not a 55-day grind).
  const objective = (s: { passProb: number; medianDays: number }) =>
    s.passProb - 0.0035 * Math.max(0, s.medianDays - 28);

  // 1) coarse scan
  let recRisk = 0.30;
  let bestObj = -1e9;
  for (let r = 0.10; r <= maxRiskPct + 1e-9; r += 0.10) {
    const stats = runBatch(buildSimParams(challenge, size, edge, r, stress), coarseN, seedBase ^ hashSeed('coarse', round(r, 2)));
    const o = objective(stats);
    if (o > bestObj + 0.004) { bestObj = o; recRisk = r; }
  }
  // 2) refine around the best
  for (let r = Math.max(0.10, recRisk - 0.10); r <= Math.min(maxRiskPct, recRisk + 0.10) + 1e-9; r += 0.025) {
    const stats = runBatch(buildSimParams(challenge, size, edge, r, stress), refineN, seedBase ^ hashSeed('refine', round(r, 3)));
    const o = objective(stats);
    if (o > bestObj + 0.003) { bestObj = o; recRisk = r; }
  }
  recRisk = round(recRisk, 2);

  const step = Math.max(0.05, round(recRisk * 0.25, 2));
  const safeRisk = round(clamp(recRisk - step * 1.2, 0.08, Math.max(0.08, recRisk - 0.02)), 2);
  const fastRisk = round(clamp(recRisk + step * 1.4, recRisk + 0.02, Math.max(maxRiskPct, recRisk + 0.02)), 2);
  const robustLow = round(clamp(recRisk - step, 0.08, recRisk - 0.01), 2);
  const robustHigh = round(clamp(recRisk + step, recRisk + 0.01, Math.max(maxRiskPct, recRisk + 0.01)), 2);

  // 3) final high-resolution batches
  const recStats = runBatch(buildSimParams(challenge, size, edge, recRisk, stress), finalN, seedBase ^ hashSeed('rec', recRisk));
  const safeStats = runBatch(buildSimParams(challenge, size, edge, safeRisk, stress), Math.round(finalN * 0.7), seedBase ^ hashSeed('safe', safeRisk));
  const fastStats = runBatch(buildSimParams(challenge, size, edge, fastRisk, stress), Math.round(finalN * 0.7), seedBase ^ hashSeed('fast', fastRisk));
  // robustness = worst pass probability inside the recommended band
  const bandLow = runBatch(buildSimParams(challenge, size, edge, robustLow, stress), Math.round(refineN * 0.8), seedBase ^ hashSeed('bl', robustLow));
  const bandHigh = runBatch(buildSimParams(challenge, size, edge, robustHigh, stress), Math.round(refineN * 0.8), seedBase ^ hashSeed('bh', robustHigh));
  const robustness = Math.min(recStats.passProb, bandLow.passProb, bandHigh.passProb);

  const safe = toRiskScore(safeRisk, safeStats, challenge, fee, activationFee, robustness);
  const rec = toRiskScore(recRisk, recStats, challenge, fee, activationFee, robustness);
  const fast = toRiskScore(fastRisk, fastStats, challenge, fee, activationFee, robustness);

  const economicsScore = fee ? clamp(1 - (rec.grossSpend / Math.max(size * 0.05, 1)), 0.05, 1) : 0.45;
  const daysScore = clamp(1 - rec.typicalDays / 55, 0.05, 1);
  const marketScore = challenge.market === userMarket || userMarket === 'mixed' ? 1 : 0.78;
  const score = rec.passProbability * 0.46 + robustness * 0.18 + rec.ruleFit * 0.08
    + economicsScore * 0.14 + daysScore * 0.10 + marketScore * 0.04
    + marketFitBonus(userMarket, challenge.market);

  return {
    challenge, size, fee, activationFee, targetPct, overallLoss, dailyLoss,
    safe, rec, fast, safeRisk, recRisk, fastRisk, robustLow, robustHigh, score,
  };
}

// ── Evaluate a single risk point (for charts) ───────────────

export function evaluateRiskAt(
  challenge: Challenge,
  size: number,
  edge: Edge,
  fee: number,
  riskPct: number,
  userMarket = 'cfd',
  stressMode: StressMode = 'realistic',
): { pass: number; spend: number } {
  const stress = getStressConfig(stressMode);
  const seed = hashSeed(challenge.id, size, stressMode, 'pt', round(riskPct, 2),
    round(edge.winRate, 4), round(edge.payoffRatio, 3));
  const stats = runBatch(buildSimParams(challenge, size, edge, riskPct, stress), 2500, seed);
  return {
    pass: stats.passProb,
    spend: spendFor(challenge, fee, challenge.activationFee || 0, stats.passProb, Math.max(stats.avgDaysAll, 1)),
  };
}

// ── Verdict ─────────────────────────────────────────────────
// Calibrated on Monte Carlo output (honest probabilities — no floor, no ceiling).

export function verdictFor(result: EvaluationResult): Verdict {
  const p = result.rec.passProbability;
  const r = result.rec.robustness;
  if (p >= 0.55 && r >= 0.45) return { label: 'Strong', cls: 'v-good', hint: 'Across thousands of simulated attempts, this structure holds up under your edge better than most.' };
  if (p >= 0.38 && r >= 0.30) return { label: 'Playable', cls: 'v-playable', hint: 'Viable if you stay inside the band and do not force pace. Expect more than one attempt.' };
  if (p >= 0.20) return { label: 'Borderline', cls: 'v-fragile', hint: 'Possible, but the simulations fail more often than they pass. Small execution mistakes decide it.' };
  return { label: 'Fragile', cls: 'v-bad', hint: 'In simulation, the rules beat this edge before it can do its job. Fix the edge before paying a fee.' };
}

// ── Economics posture ───────────────────────────────────────

export function economicsPosture(result: EvaluationResult): string {
  const feeBase = (result.fee || 0) + result.activationFee;
  if (!feeBase) return 'Needs fee input before the economics are decision-grade.';
  const multiple = result.rec.grossSpend / Math.max(feeBase, 1);
  if (multiple <= 1.7) return 'Efficient for the current profile.';
  if (multiple <= 2.4) return 'Manageable, but discipline matters.';
  return 'Expensive for the current profile.';
}

// ── Compare same-size alternatives ──────────────────────────

export function compareSameSize(
  challenges: Record<string, Challenge>,
  selectedSize: number,
  edge: Edge,
  userMarket = 'cfd',
  stressMode: StressMode = 'realistic',
): EvaluationResult[] {
  return Object.values(challenges)
    .filter(ch => ch.sizes.includes(selectedSize))
    .map(ch => evaluateChallenge(ch, selectedSize, edge, null, userMarket, stressMode, 'quick'))
    .sort((a, b) => b.score - a.score);
}

// ── Confidence layer ────────────────────────────────────────
// The dominant uncertainty is input quality (sample size, manual vs CSV),
// not Monte Carlo noise — so the spread reflects input quality.

export function getResultConfidence(
  challenge: Challenge,
  edge: Edge,
  fee: number,
): ResultConfidence {
  let score = 0;
  if (edge.inputModel === 'csv_empirical') score += 2; else score += 1;
  if ((edge.sampleTrades || 0) >= 180) score += 2;
  else if ((edge.sampleTrades || 0) >= 80) score += 1;
  else if ((edge.sampleTrades || 0) < 40) score -= 1;
  if (edge.csvMeta?.recommended) score += 1;
  if (challenge.confidence === 'verified') score += 1; else score -= 1;
  if ((edge.confidencePenalty || 0) >= 0.08) score -= 1;
  if (!Number.isFinite(fee) || fee <= 0) score -= 1;

  let label: ResultConfidence['label'] = 'Medium';
  let cls = 'confidence-medium';
  let note = 'Usable result. Lean harder on the verdict and the risk band than on the midpoint percentages.';
  if (score >= 5) {
    label = 'High'; cls = 'confidence-high';
    note = 'Stronger input quality and verified rules. The simulation is only as good as the edge you feed it — this input is solid.';
  } else if (score <= 1) {
    label = 'Low'; cls = 'confidence-low';
    note = 'Thin or manual inputs. The simulation is rule-accurate, but your edge numbers carry real uncertainty. Treat the ranges as guardrails, not promises.';
  }

  let spread = 0.05;
  if (edge.inputModel !== 'csv_empirical') spread += 0.03;
  if ((edge.sampleTrades || 0) < 50) spread += 0.05;
  else if ((edge.sampleTrades || 0) < 100) spread += 0.03;
  else if ((edge.sampleTrades || 0) < 200) spread += 0.015;
  if (challenge.confidence !== 'verified') spread += 0.02;
  if (!Number.isFinite(fee) || fee <= 0) spread += 0.02;
  spread = clamp(spread, 0.04, 0.18);

  return { label, cls, note, spread };
}

// ── Display stats builder ───────────────────────────────────

export function buildDisplayStats(result: EvaluationResult, edge: Edge): DisplayStats {
  const confidence = getResultConfidence(result.challenge, edge, result.fee);
  const passLow = clamp(result.rec.passProbability - confidence.spread, 0.01, 0.97);
  const passHigh = clamp(result.rec.passProbability + confidence.spread, 0.02, 0.97);
  const attemptLow = round(1 / Math.max(passHigh, 0.02), 2);
  const attemptHigh = round(1 / Math.max(passLow, 0.02), 2);
  const dayLow = Math.round(Math.max(result.rec.p25Days, 1));
  const dayHigh = Math.round(Math.max(result.rec.p75Days, dayLow));
  const spendCandidates = [result.safe.grossSpend, result.rec.grossSpend, result.fast.grossSpend].filter(v => Number.isFinite(v) && v >= 0);
  const spendLow = spendCandidates.length ? Math.round(Math.min(...spendCandidates)) : 0;
  const spendHigh = spendCandidates.length ? Math.round(Math.max(...spendCandidates)) : 0;

  const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pctBand = `${(passLow * 100).toFixed(0)}–${(passHigh * 100).toFixed(0)}%`;
  const dayBand = dayLow === dayHigh ? `${dayLow} days` : `${dayLow}–${dayHigh} days`;
  const spendBand = spendHigh ? (spendLow === spendHigh ? MONEY.format(spendLow) : `${MONEY.format(spendLow)}–${MONEY.format(spendHigh)}`) : 'Add fee input';

  const midPass = result.rec.passProbability;
  let passZone: string;
  if (midPass < 0.12) passZone = 'Very unlikely';
  else if (midPass < 0.25) passZone = 'Low';
  else if (midPass < 0.42) passZone = 'Uncertain';
  else if (midPass < 0.60) passZone = 'Playable';
  else passZone = 'Strong';

  return {
    confidence,
    passLow, passHigh, passBand: pctBand,
    attemptLow, attemptHigh, attemptBand: `${attemptLow.toFixed(2)}–${attemptHigh.toFixed(2)}`,
    dayLow, dayHigh, dayBand,
    spendLow, spendHigh, spendBand,
    passMidpointLabel: passZone,
  };
}

// ── Personalized recommendations ────────────────────────────

export function buildRecommendations(
  result: EvaluationResult,
  edge: Edge,
  v: Verdict,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const wr = edge.winRate;
  const rr = edge.payoffRatio;
  const expR = edge.expectancyR;
  const streak = edge.maxConsecLosses;
  const freq = edge.tradesPerDay;
  const sample = edge.sampleTrades;
  const fb = result.rec.failureBreakdown;

  // ── Negative edge ──
  if (expR <= 0) {
    recs.push({
      type: 'bottleneck', priority: 1,
      title: 'Negative edge detected',
      message: `Your expectancy is ${expR.toFixed(3)} — you lose money on average, and the simulation confirms it: almost every attempt fails. No challenge is viable until this is positive. ${
        rr < 1.5 ? 'Focus on improving your reward-to-risk ratio: let winners run longer or cut losses earlier.'
        : wr < 0.40 ? 'Your win rate is very low. Consider tighter entry criteria to improve accuracy.'
        : 'Both your win rate and payoff ratio need work before paying any challenge fee.'
      }`,
    });
    return recs;
  }

  // ── Payoff ratio bottleneck ──
  if (rr < 1.5) {
    recs.push({
      type: 'bottleneck', priority: 1,
      title: 'Payoff ratio is the bottleneck',
      message: `Your win rate is ${(wr*100).toFixed(0)}% (decent), but your payoff ratio is only ${rr.toFixed(2)}x — you risk almost as much as you gain. Target at least 2.0x by letting winners run longer or tightening your stop-loss. At ${(wr*100).toFixed(0)}% win rate with 2.0x RR, your expectancy would jump from ${expR.toFixed(2)} to ${(wr*2-(1-wr)).toFixed(2)}.`,
    });
  } else if (rr < 2.0 && wr < 0.50) {
    recs.push({
      type: 'bottleneck', priority: 2,
      title: 'Both win rate and payoff ratio need improvement',
      message: `${(wr*100).toFixed(0)}% win rate with ${rr.toFixed(1)}x RR produces a marginal edge. Improving either to 50%+ WR or 2.0x+ RR would materially change the simulation outcome.`,
    });
  }

  // ── Win rate too low ──
  if (wr < 0.40 && rr < 2.5) {
    recs.push({
      type: 'bottleneck', priority: 2,
      title: 'Win rate too low for this payoff ratio',
      message: `At ${(wr*100).toFixed(0)}% win rate, you need at least 2.5x payoff ratio to have a viable edge. Your current ${rr.toFixed(1)}x is not enough. Either improve accuracy or increase your R:R significantly.`,
    });
  }

  // ── Frequency bottleneck ──
  if (freq < 0.8 && expR > 0 && (fb.slow > 0.35 || result.rec.typicalDays > 45)) {
    recs.push({
      type: 'bottleneck', priority: 2,
      title: 'Trading frequency is too low for challenge timelines',
      message: `At ${(freq*5).toFixed(1)} trades/week, ${(fb.slow*100).toFixed(0)}% of simulated failures come from simply running out of road before the target. If you can safely increase to 5+ trades/week, the result changes significantly.`,
    });
  }

  // ── Losing streak problem ──
  if (streak >= 6 && result.challenge.dailyLoss > 0) {
    const maxSafeRisk = (result.challenge.dailyLoss / streak) * 0.90 * 100;
    recs.push({
      type: 'bottleneck', priority: 3,
      title: 'Losing streak limits your risk ceiling',
      message: `A max streak of ${streak} losses means the engine caps your risk near ${maxSafeRisk.toFixed(2)}% to survive the daily loss rule (${(result.challenge.dailyLoss*100).toFixed(0)}%). Reducing your streak to 4 or less would unlock higher risk and faster progress.`,
    });
  }

  // ── Small sample ──
  if (sample < 50) {
    recs.push({
      type: 'improvement', priority: 3,
      title: 'Sample size is thin',
      message: `Only ${sample} trades — the simulation is rule-accurate, but your edge numbers carry real uncertainty. Get to at least 80–100 trades in paper or backtesting before trusting the result with real money.`,
    });
  }

  // ── Positive feedback ──
  if (wr >= 0.50 && rr >= 2.0) {
    recs.push({
      type: 'positive', priority: 4,
      title: 'Edge profile looks workable',
      message: `${(wr*100).toFixed(0)}% win rate with ${rr.toFixed(1)}x payoff ratio is a solid foundation. Focus on execution discipline and staying inside the recommended risk band.`,
    });
  }

  if (v.label === 'Strong') {
    recs.push({
      type: 'positive', priority: 5,
      title: 'This challenge is a structural fit',
      message: 'The edge, the rules, and the economics are aligned across thousands of simulated attempts. This does not guarantee success, but it justifies the attempt.',
    });
  }

  // ── Failure-mode specific (now empirical) ──
  if (fb.daily >= 0.35) {
    recs.push({
      type: 'improvement', priority: 3,
      title: 'Daily loss rule is the main killer',
      message: `${(fb.daily*100).toFixed(0)}% of simulated failures hit the daily loss limit. One bad session ends the attempt. Hard personal rule: stop trading after ${getStressConfig('realistic').stopAfterLosses - 1} losing trades in a day, regardless of how you feel.`,
    });
  }
  if (fb.trailing >= 0.35) {
    recs.push({
      type: 'improvement', priority: 3,
      title: 'Trailing drawdown is the main killer',
      message: `${(fb.trailing*100).toFixed(0)}% of simulated failures breach the trailing max loss. Protect the floor after green days: the limit follows your equity peak, so a drawdown right after a strong run is what ends most attempts.`,
    });
  }
  if (result.rec.delayedShare >= 0.30 && (result.challenge.bestDayCap || result.challenge.consistencyCap)) {
    recs.push({
      type: 'improvement', priority: 3,
      title: 'Profit distribution rules will slow you down',
      message: `${(result.rec.delayedShare*100).toFixed(0)}% of simulated passes were delayed by the ${result.challenge.bestDayCap ? 'best-day' : 'consistency'} rule — one big day forces extra trading days and extra rule exposure. Spread your edge across sessions instead of pushing size on a hot day.`,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
