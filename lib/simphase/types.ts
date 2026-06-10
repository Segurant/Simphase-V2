// ═══════════════════════════════════════════════════════════
// SimPhase — Core Types
// Everything the engine, UI, and persistence speak in.
// ═══════════════════════════════════════════════════════════

// ── Firm & Challenge ────────────────────────────────────────

export interface Firm {
  id: string;
  label: string;
  description: string;
  highlight: string;
  challenges: string[];
}

export interface ChallengePhase {
  /** Profit target as fraction of initial balance (e.g. 0.10). Null if dollar-based. */
  target: number | null;
  /** Dollar target per account size (Topstep style). */
  targetDollar?: Record<number, number>;
  /** Minimum trading days for this phase (days with at least one trade). */
  minDays: number;
}

export type TrailingMode = 'none' | 'eod' | 'intraday';
export type FeeModel = 'one_time' | 'monthly';

export interface Challenge {
  id: string;
  firm: string;
  name: string;
  longName: string;
  ruleLabel: string;
  description: string;
  confidence: 'verified' | 'monitored';
  /** Month the rules were last verified against official sources. */
  rulesVerified: string;
  sizes: number[];
  feeDefaults: Record<number, number>;
  /** 'one_time' = fee per attempt. 'monthly' = subscription; a reset credit accrues monthly. */
  feeModel: FeeModel;
  activationFee: number;
  /** Evaluation phases, simulated sequentially. Drawdown counters reset between phases. */
  phases: ChallengePhase[];
  /** Max daily loss as fraction of initial balance. 0 = no hard daily loss rule. */
  dailyLoss: number;
  /** Static overall max loss as fraction of initial balance (null if only trailing applies). */
  overallLoss: number | null;
  overallLossDollar?: Record<number, number>;
  /** Trailing max-loss mechanics. */
  trailing: TrailingMode;
  /** Trailing distance as fraction of initial balance (e.g. 0.10). */
  trailingPct?: number;
  trailingDollar?: Record<number, number>;
  /** Whether the trailing floor freezes once it reaches the initial balance. */
  trailingFreezesAtInitial?: boolean;
  /**
   * Best Day rule (FTMO 1-Step style): best day must be <= cap × positive days' profit.
   * NOT a breach — exceeding it forces the trader to keep trading until satisfied.
   */
  bestDayCap: number | null;
  /**
   * Consistency rule (Topstep style): best day must be < cap × profit target.
   * Exceeding it forces additional profitable trading before the pass counts.
   */
  consistencyCap: number | null;
  market: 'cfd' | 'futures';
  confidenceNote: string;
  feeNote: string;
  failureBase: string;
}

// ── Edge (trader profile) ───────────────────────────────────

export interface Edge {
  source: 'manual' | 'csv';
  inputModel: 'manual_assumptions' | 'csv_empirical';
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  payoffRatio: number;
  tradesPerDay: number;
  maxConsecLosses: number;
  sampleTrades: number;
  expectancyR: number;
  profitFactor: number;
  observedVol: number;
  confidencePenalty: number;
  // CSV-specific
  csvMeta?: {
    delimiter: string;
    columnIndex: number;
    columnName: string;
    fileType: string;
    recommended: boolean;
    activeDays: number;
  };
  // Manual-specific
  payoffInputLabel?: string;
  frequencyValue?: number;
  frequencyUnit?: 'day' | 'week';
}

// ── Stress modes ────────────────────────────────────────────

export type StressMode = 'calm' | 'realistic' | 'pressure';

/** Behavioral execution model applied inside the simulation. */
export interface StressConfig {
  /** Additive shift to win rate (e.g. -0.04 under pressure). */
  wrShift: number;
  /** Multiplier on payoff ratio (profit capture degrades under pressure). */
  rrMult: number;
  /** Personal kill-switch: stop the day after this many losses. */
  stopAfterLosses: number;
  /** Probability of taking 1-2 extra "tilt" trades past the kill-switch on a losing day. */
  tiltProb: number;
  /** Max extra slippage on losing trades (a loss can reach (1+slipMax) × planned risk). */
  slipMax: number;
}

// ── Engine output ───────────────────────────────────────────

export interface FailureBreakdown {
  daily: number;
  overall: number;
  trailing: number;
  slow: number;
}

export interface RiskScore {
  riskPct: number;
  passProbability: number;
  robustness: number;
  expectedAttempts: number;
  grossSpend: number;
  failureMode: string;
  /** Share of simulated failures attributable to the dominant failure mode (0-1). */
  failureModeShare: number;
  failureBreakdown: FailureBreakdown;
  /** Median trading days of successful attempts. */
  typicalDays: number;
  p25Days: number;
  p75Days: number;
  /** Share of passing runs delayed by best-day / consistency rules. */
  delayedShare: number;
  ruleFit: number;
  /** Number of Monte Carlo runs behind this estimate. */
  simRuns: number;
}

export interface EvaluationResult {
  challenge: Challenge;
  size: number;
  fee: number;
  activationFee: number;
  targetPct: number;
  overallLoss: number;
  dailyLoss: number;
  safe: RiskScore;
  rec: RiskScore;
  fast: RiskScore;
  safeRisk: number;
  recRisk: number;
  fastRisk: number;
  robustLow: number;
  robustHigh: number;
  score: number;
}

export type VerdictLabel = 'Strong' | 'Playable' | 'Borderline' | 'Fragile';

export interface Verdict {
  label: VerdictLabel;
  cls: string;
  hint: string;
}

// ── Confidence layer ────────────────────────────────────────

export interface ResultConfidence {
  label: 'High' | 'Medium' | 'Low';
  cls: string;
  note: string;
  spread: number;
}

export interface DisplayStats {
  confidence: ResultConfidence;
  passLow: number;
  passHigh: number;
  passBand: string;
  attemptLow: number;
  attemptHigh: number;
  attemptBand: string;
  dayLow: number;
  dayHigh: number;
  dayBand: string;
  spendLow: number;
  spendHigh: number;
  spendBand: string;
  passMidpointLabel: string;
}

// ── Recommendations ─────────────────────────────────────────

export interface Recommendation {
  type: 'bottleneck' | 'improvement' | 'positive';
  title: string;
  message: string;
  priority: number;
}

// ── App state ───────────────────────────────────────────────

export interface AppState {
  selectedFirm: string;
  selectedChallenge: string;
  selectedSize: number;
  inputMode: 'manual' | 'csv';
  stressMode: StressMode;
  market: string;
  feeTouched: boolean;
  parsedEdge: Edge | null;
  lastResult: {
    result: EvaluationResult;
    alternatives: EvaluationResult[];
    edge: Edge;
    display: DisplayStats;
  } | null;
}

// ── Persistence ─────────────────────────────────────────────

export interface SavedPlan {
  id: string;
  createdAt: string;
  selectedFirm: string;
  selectedChallenge: string;
  selectedSize: number;
  inputMode: 'manual' | 'csv';
  stressMode: StressMode;
  fee: number;
  market: string;
  parsedEdge: Edge | null;
  manualInputs: {
    winRate: string;
    payoff: string;
    tradeFrequency: string;
    frequencyUnit: string;
    maxLossStreak: string;
    sampleTrades: string;
    market: string;
  };
  challengeName: string;
  verdict: string;
  passBand: string;
}

export interface OutcomeEntry {
  createdAt: string;
  challenge: string;
  size: number;
  verdict: string;
  confidence: string;
  risk: string;
  outcome: 'passed' | 'failed';
}

export interface JournalEntry {
  updatedAt: string;
  status: string;
  note: string;
}
