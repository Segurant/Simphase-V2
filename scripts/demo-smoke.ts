import { evaluateChallenge, verdictFor, buildDisplayStats, getResultConfidence } from '../lib/simphase/engine';
import { parseCsvText } from '../lib/simphase/edge';
import { CHALLENGES } from '../lib/simphase/firms';
import { readFileSync } from 'fs';

const store = readFileSync('../lib/store.tsx', 'utf8');
const m = store.match(/const SAMPLE_CSV = `([^`]*)`/)!;
const csv = m[1].replace(/\\n/g, '\n');
const edge = parseCsvText(csv)!;
console.log('demo edge:', { wr: (edge.winRate*100).toFixed(1)+'%', rr: edge.payoffRatio.toFixed(2), tpd: edge.tradesPerDay.toFixed(2), n: edge.sampleTrades, expR: edge.expectancyR.toFixed(2), streak: edge.maxConsecLosses });
const r = evaluateChallenge(CHALLENGES.ftmo_2step, 50000, edge, 345, 'cfd', 'realistic');
const v = verdictFor(r);
const d = buildDisplayStats(r, edge);
console.log(`DEMO ftmo_2step 50k -> ${v.label} | pass=${(r.rec.passProbability*100).toFixed(1)}% band=${d.passBand} | risk=${r.recRisk}% [${r.robustLow}-${r.robustHigh}] | days=${d.dayBand} | spend=${d.spendBand} | conf=${d.confidence.label} | fail="${r.rec.failureMode}" ${(r.rec.failureModeShare*100).toFixed(0)}%`);
