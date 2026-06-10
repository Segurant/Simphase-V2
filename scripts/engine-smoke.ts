import { evaluateChallenge, verdictFor, buildDisplayStats, compareSameSize } from '../lib/simphase/engine';
import { deriveManualEdge, parseCsvText } from '../lib/simphase/edge';
import { CHALLENGES } from '../lib/simphase/firms';

const mk = (wr: number, rr: number, freq = 2.1, streak = 5, n = 120) =>
  deriveManualEdge({ winRate: wr, payoffRatio: rr, tradeFrequency: freq, frequencyUnit: 'day', maxLossStreak: streak, sampleTrades: n, market: 'cfd' });

function show(name: string, ch: string, size: number, edge: any, mode: any = 'realistic') {
  const t0 = Date.now();
  const r = evaluateChallenge(CHALLENGES[ch], size, edge, null, 'cfd', mode);
  const v = verdictFor(r);
  const d = buildDisplayStats(r, edge);
  console.log(`${name} | ${ch} $${size/1000}k [${mode}] -> ${v.label}  pass=${(r.rec.passProbability*100).toFixed(1)}% rob=${(r.rec.robustness*100).toFixed(1)}% risk=${r.recRisk}% days=${r.rec.typicalDays}(${r.rec.p25Days}-${r.rec.p75Days}) attempts=${r.rec.expectedAttempts.toFixed(2)} spend=$${Math.round(r.rec.grossSpend)} fail="${r.rec.failureMode}"(${(r.rec.failureModeShare*100).toFixed(0)}%) delayed=${(r.rec.delayedShare*100).toFixed(0)}% [${Date.now()-t0}ms]`);
  return r;
}

console.log('=== PROFIL DEFAUT (47% WR, 2.0 RR, 2.1 t/j) ===');
const def = mk(47, 2.0);
show('default', 'ftmo_2step', 50000, def);
show('default', 'ftmo_1step', 50000, def);
show('default', 'fn_2step', 50000, def);
show('default', 'fn_1step', 50000, def);
show('default', 'fp_2step', 50000, def);
show('default', 'topstep_combine', 50000, mk(47, 2.0, 2.1, 5, 120));

console.log('\n=== EDGE FORT (55% WR, 2.2 RR) ===');
const strong = mk(55, 2.2, 3, 4, 300);
show('strong', 'ftmo_2step', 50000, strong);
show('strong', 'ftmo_1step', 50000, strong);
show('strong', 'topstep_combine', 50000, strong);

console.log('\n=== EDGE NEGATIF (35% WR, 1.0 RR) ===');
const neg = mk(35, 1.0);
show('negative', 'ftmo_2step', 50000, neg);

console.log('\n=== EDGE MARGINAL (45% WR, 1.3 RR) ===');
show('marginal', 'ftmo_2step', 50000, mk(45, 1.3));

console.log('\n=== STRESS ORDERING (doit etre calm > realistic > pressure) ===');
show('default', 'ftmo_2step', 50000, def, 'calm');
show('default', 'ftmo_2step', 50000, def, 'realistic');
show('default', 'ftmo_2step', 50000, def, 'pressure');

console.log('\n=== TRADER LENT (0.5 t/j) ===');
show('slow', 'ftmo_2step', 50000, mk(50, 2.0, 0.5));

console.log('\n=== DETERMINISME (2 runs identiques) ===');
const a = evaluateChallenge(CHALLENGES.ftmo_2step, 50000, def);
const b = evaluateChallenge(CHALLENGES.ftmo_2step, 50000, def);
console.log('identical:', a.rec.passProbability === b.rec.passProbability && a.recRisk === b.recRisk);

console.log('\n=== COMPARE SAME SIZE 50k (perf) ===');
const t0 = Date.now();
const alts = compareSameSize(CHALLENGES, 50000, def);
console.log(`comparisons: ${alts.length} in ${Date.now()-t0}ms`);
alts.forEach(x => console.log(`  ${x.challenge.id}: score=${x.score.toFixed(3)} pass=${(x.rec.passProbability*100).toFixed(1)}% spend=$${Math.round(x.rec.grossSpend)}`));
