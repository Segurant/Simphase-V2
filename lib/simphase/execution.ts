// ═══════════════════════════════════════════════════════════
// SimPhase — Execution Reality + Journal Analysis
// ═══════════════════════════════════════════════════════════

import { clamp } from './engine';

// ── Types ───────────────────────────────────────────────────

export interface RealExecutionMetrics {
  tradeCount: number; winCount: number; lossCount: number; winRate: number;
  avgWin: number; avgLoss: number; realizedRR: number;
  expectancyDollar: number; expectancyR: number; profitFactor: number; totalPnl: number;
  biggestWin: number; biggestLoss: number; maxWinStreak: number; maxLossStreak: number;
  medianWin: number; medianLoss: number; winStdDev: number; lossStdDev: number;
  topWinsShare: number; outlierDependency: 'low'|'moderate'|'high';
  lossConsistency: 'tight'|'moderate'|'wide'; winConsistency: 'tight'|'moderate'|'wide';
}

export interface ExecutionRead { label: string; style: 'strong'|'ok'|'warn'|'bad'; }

export interface ExecutionSuggestion {
  type: 'observation'|'improvement'|'positive';
  title: string; message: string;
}

export interface ExecutionAnalysis {
  metrics: RealExecutionMetrics;
  intendedRR: number|null; rrGap: number|null;
  executionRead: ExecutionRead;
  suggestions: ExecutionSuggestion[];
  confidence: 'High'|'Medium'|'Limited'; confidenceNote: string;
}

export interface JournalTrade {
  pnl?: number; date?: string; side?: string; notes?: string;
  plannedR?: number; realizedR?: number;
  hasPartial?: boolean; entryPrice?: number; exitPrice?: number;
  stopPrice?: number; targetPrice?: number;
}

export interface JournalAnalysis {
  usable: boolean; trades: JournalTrade[]; tradeCount: number;
  hasPlannedR: boolean; hasNotes: boolean; hasSide: boolean; hasPartials: boolean;
  hasStopTarget: boolean;
  avgPlannedR: number|null; avgRealizedR: number|null; plannedVsRealizedGap: number|null;
  partialRate: number|null;
  postLossBehavior: 'stable'|'degraded'|'unknown';
  confidenceLevel: 'High'|'Medium'|'Limited';
  confidenceNote: string;
  suggestions: ExecutionSuggestion[];
}

export interface CrossAnalysis {
  behaviorRead: string;
  executionStyle: 'clean_controlled'|'viable_compressed'|'irregular'|'fragile_under_constraint';
  mainStrength: string; mainImprovement: string;
  suggestions: ExecutionSuggestion[];
}

// ── Compute real execution metrics ──────────────────────────

export function computeRealExecutionMetrics(pnlValues: number[]): RealExecutionMetrics|null {
  if (!pnlValues || pnlValues.length < 8) return null;
  const wins = pnlValues.filter(v => v > 0);
  const losses = pnlValues.filter(v => v < 0).map(v => Math.abs(v));
  if (!wins.length || !losses.length) return null;

  const avgWin = wins.reduce((a,b)=>a+b,0)/wins.length;
  const avgLoss = losses.reduce((a,b)=>a+b,0)/losses.length;
  const realizedRR = avgWin / Math.max(avgLoss, 0.01);
  const winRate = wins.length / pnlValues.length;
  const totalPnl = pnlValues.reduce((a,b)=>a+b,0);
  const expectancyDollar = totalPnl / pnlValues.length;
  const expectancyR = winRate * realizedRR - (1 - winRate);
  const profitFactor = wins.reduce((a,b)=>a+b,0) / Math.max(losses.reduce((a,b)=>a+b,0),0.01);

  let curW=0,maxW=0,curL=0,maxL=0;
  for (const v of pnlValues) { if(v>0){curW++;maxW=Math.max(maxW,curW);curL=0;} else {curL++;maxL=Math.max(maxL,curL);curW=0;} }

  const sorted = (arr: number[]) => [...arr].sort((a,b)=>a-b);
  const median = (arr: number[]) => { const s=sorted(arr); return s.length%2===0 ? (s[s.length/2-1]+s[s.length/2])/2 : s[Math.floor(s.length/2)]; };
  const stdDev = (arr: number[], mean: number) => Math.sqrt(arr.reduce((sum,v)=>sum+Math.pow(v-mean,2),0)/arr.length);

  const totalWinProfit = wins.reduce((a,b)=>a+b,0);
  const top3 = sorted(wins).reverse().slice(0,3);
  const topWinsShare = totalWinProfit > 0 ? top3.reduce((a,b)=>a+b,0)/totalWinProfit : 0;

  const winCV = avgWin > 0 ? stdDev(wins, avgWin)/avgWin : 0;
  const lossCV = avgLoss > 0 ? stdDev(losses, avgLoss)/avgLoss : 0;

  return {
    tradeCount: pnlValues.length, winCount: wins.length, lossCount: losses.length,
    winRate, avgWin, avgLoss, realizedRR, expectancyDollar, expectancyR, profitFactor, totalPnl,
    biggestWin: Math.max(...pnlValues), biggestLoss: Math.min(...pnlValues),
    maxWinStreak: maxW, maxLossStreak: maxL,
    medianWin: median(wins), medianLoss: median(losses),
    winStdDev: stdDev(wins, avgWin), lossStdDev: stdDev(losses, avgLoss),
    topWinsShare, outlierDependency: topWinsShare>0.55?'high':topWinsShare>0.35?'moderate':'low',
    lossConsistency: lossCV<0.4?'tight':lossCV<0.8?'moderate':'wide',
    winConsistency: winCV<0.4?'tight':winCV<0.8?'moderate':'wide',
  };
}

// ── Analyze execution profile ───────────────────────────────

export function analyzeExecutionProfile(metrics: RealExecutionMetrics, intendedRR: number|null): ExecutionAnalysis {
  const { realizedRR, winRate, expectancyR, tradeCount, outlierDependency, lossConsistency, winConsistency, avgWin, avgLoss, medianWin } = metrics;
  const rrGap = intendedRR != null && intendedRR > 0 ? intendedRR - realizedRR : null;

  let executionRead: ExecutionRead;
  if (expectancyR <= 0) executionRead = { label:'Negative edge under execution', style:'bad' };
  else if (realizedRR < 1.2 && winRate < 0.55) executionRead = { label:'Marginal — edge too thin for challenge pressure', style:'bad' };
  else if (rrGap != null && rrGap > 0.6) executionRead = { label:'Controlled but heavily compressed', style:'warn' };
  else if (rrGap != null && rrGap > 0.3) executionRead = { label:'Controlled but compressed', style:'warn' };
  else if (outlierDependency === 'high') executionRead = { label:'Outlier-dependent — fragile under constraints', style:'warn' };
  else if (lossConsistency === 'wide') executionRead = { label:'Viable but losses are inconsistent', style:'warn' };
  else if (expectancyR >= 0.50) executionRead = { label:'Clean and controlled', style:'strong' };
  else if (expectancyR >= 0.20) executionRead = { label:'Workable — edge present but modest', style:'ok' };
  else executionRead = { label:'Thin edge — viable only with strict execution', style:'warn' };

  const suggestions: ExecutionSuggestion[] = [];

  if (expectancyR <= 0) {
    suggestions.push({ type:'observation', title:'Edge is negative under real execution',
      message:`Your trades produce ${expectancyR.toFixed(3)} expectancy on average. No challenge is viable until this turns positive.` });
  }
  if (rrGap != null && rrGap > 0.3 && expectancyR > 0) {
    suggestions.push({ type:'observation', title:'Your realized RR is lower than your intended target',
      message:`You may be targeting around ${(intendedRR||2).toFixed(1)}R, but your actual captured reward is ${realizedRR.toFixed(2)}R — about ${((rrGap/(intendedRR||2))*100).toFixed(0)}% compression. This usually points to earlier exits, partial profit-taking, or profit protection before the full target is reached.` });
  }
  if (lossConsistency === 'tight' && expectancyR > 0) {
    suggestions.push({ type:'positive', title:'Your losses look controlled',
      message:`Your losing trades are consistent in size (avg $${avgLoss.toFixed(0)}). The bigger opportunity may be in how much of your winners you actually capture.` });
  }
  if (lossConsistency === 'wide') {
    suggestions.push({ type:'improvement', title:'Your losses are inconsistent in size',
      message:`Some losses are significantly larger than others. Prop rules punish occasional oversized losses more than traders expect.` });
  }
  if (outlierDependency === 'high') {
    suggestions.push({ type:'observation', title:'Your results rely on a few large winners',
      message:`Your top 3 wins account for ${(metrics.topWinsShare*100).toFixed(0)}% of total profit. This makes the profile less stable under challenge constraints.` });
  }
  if (medianWin < avgWin * 0.65 && expectancyR > 0) {
    suggestions.push({ type:'observation', title:'Most of your wins are smaller than average',
      message:`Your median win ($${medianWin.toFixed(0)}) is significantly lower than your average ($${avgWin.toFixed(0)}). A few large winners pull up the stats.` });
  }
  if (expectancyR >= 0.40 && lossConsistency !== 'wide' && outlierDependency !== 'high') {
    suggestions.push({ type:'positive', title:'Edge profile looks solid',
      message:`${(winRate*100).toFixed(0)}% win rate with ${realizedRR.toFixed(2)}x realized RR is a workable foundation.` });
  }
  if (expectancyR > 0 && expectancyR < 0.40 && rrGap != null && rrGap > 0.3) {
    suggestions.push({ type:'improvement', title:'Execution may be the main lever, not strategy',
      message:`The gap between your intended and realized RR suggests profit capture is the bottleneck, not the strategy itself.` });
  }
  if (winRate >= 0.55 && realizedRR < 1.3 && expectancyR > 0) {
    suggestions.push({ type:'observation', title:'Your profile does not need extreme reward multiples',
      message:`Win rate is strong (${(winRate*100).toFixed(0)}%), but RR is only ${realizedRR.toFixed(2)}x. Letting a portion of winners run slightly further could help.` });
  }

  let confidence: ExecutionAnalysis['confidence'] = 'Medium';
  let confidenceNote = 'Usable analysis based on the available trade data.';
  if (tradeCount >= 80 && lossConsistency !== 'wide') { confidence = 'High'; confidenceNote = 'Sufficient sample and consistent data for a reliable read.'; }
  else if (tradeCount < 30) { confidence = 'Limited'; confidenceNote = `Only ${tradeCount} trades — patterns may not be stable yet.`; }

  return { metrics, intendedRR, rrGap, executionRead, suggestions: suggestions.slice(0,4), confidence, confidenceNote };
}

// ── Parse trading journal CSV ───────────────────────────────

export function parseTradingJournal(text: string): JournalAnalysis|null {
  const raw = String(text||'').replace(/^\uFEFF/,'').trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // Detect delimiter
  const delims = [',',';','\t','|'];
  let bestD=',',bestS=-1;
  for(const d of delims){let s=0;for(const l of lines.slice(0,8)){let q=false,c=0;for(let i=0;i<l.length;i++){if(l[i]==='"')q=!q;else if(l[i]===d&&!q)c++;}s+=c;}if(s>bestS){bestS=s;bestD=d;}}

  function split(line:string):string[]{const o:string[]=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===bestD&&!q){o.push(c.trim());c='';}else c+=ch;}o.push(c.trim());return o;}

  const rows = lines.map(split);
  const headers = rows[0].map(h=>h.toLowerCase().replace(/[\u00a0\s]+/g,' ').replace(/[%()]/g,'').trim());

  // Detect columns
  const findCol = (patterns: RegExp[]) => headers.findIndex(h => patterns.some(p => p.test(h)));
  const pnlCol = findCol([/^pnl$/,/^p&l$/,/^profit$/,/^net pnl$/,/^realized p&l$/,/^result$/,/^gain.?loss$/,/^return$/,/^net profit$/]);
  const dateCol = findCol([/^date$/,/^time$/,/^timestamp$/,/^open.?time$/,/^close.?time$/]);
  const sideCol = findCol([/^side$/,/^direction$/,/^type$/,/^long.?short$/]);
  const notesCol = findCol([/^notes?$/,/^comment$/,/^remark$/,/^journal$/,/^text$/]);
  const plannedRCol = findCol([/^planned.?r$/,/^target.?r$/,/^intended.?r$/,/^risk.?reward$/,/^rr$/]);
  const realizedRCol = findCol([/^realized.?r$/,/^actual.?r$/,/^real.?r$/,/^captured.?r$/]);
  const partialCol = findCol([/^partial$/,/^scale$/,/^partial.?exit$/,/^scaled$/]);
  const stopCol = findCol([/^stop$/,/^sl$/,/^stop.?loss$/,/^stop.?price$/]);
  const targetCol = findCol([/^target$/,/^tp$/,/^take.?profit$/,/^target.?price$/]);
  const entryCol = findCol([/^entry$/,/^entry.?price$/,/^open.?price$/,/^fill.?price$/]);
  const exitCol = findCol([/^exit$/,/^exit.?price$/,/^close.?price$/]);

  function parseNum(v:string|undefined):number|undefined{if(!v)return undefined;let s=v.trim().replace(/[€$£¥₽₹\s+]/g,'');let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}if(s.startsWith('-')){neg=true;s=s.slice(1);}if(s.includes('.')&&s.includes(',')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}else if(s.includes(',')&&!s.includes('.')){const p=s.split(',');if(p.length===2&&p[1].length<=2)s=p[0]+'.'+p[1];else s=p.join('');}s=s.replace(/[^0-9.]/g,'');const n=parseFloat(s);return isNaN(n)?undefined:(neg?-n:n);}

  const trades: JournalTrade[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const t: JournalTrade = {};
    if (pnlCol >= 0) t.pnl = parseNum(r[pnlCol]);
    if (dateCol >= 0) t.date = r[dateCol];
    if (sideCol >= 0) t.side = r[sideCol];
    if (notesCol >= 0) t.notes = r[notesCol];
    if (plannedRCol >= 0) t.plannedR = parseNum(r[plannedRCol]);
    if (realizedRCol >= 0) t.realizedR = parseNum(r[realizedRCol]);
    if (partialCol >= 0) t.hasPartial = /yes|true|1|partial|scaled/i.test(r[partialCol]||'');
    if (stopCol >= 0) t.stopPrice = parseNum(r[stopCol]);
    if (targetCol >= 0) t.targetPrice = parseNum(r[targetCol]);
    if (entryCol >= 0) t.entryPrice = parseNum(r[entryCol]);
    if (exitCol >= 0) t.exitPrice = parseNum(r[exitCol]);
    if (t.pnl !== undefined || t.plannedR !== undefined || t.realizedR !== undefined || t.notes) {
      trades.push(t);
    }
  }

  if (trades.length < 3) return null;

  const hasPlannedR = trades.some(t => t.plannedR !== undefined);
  const hasNotes = trades.some(t => t.notes && t.notes.length > 2);
  const hasSide = trades.some(t => t.side);
  const hasPartials = trades.some(t => t.hasPartial);
  const hasStopTarget = trades.some(t => t.stopPrice !== undefined || t.targetPrice !== undefined);

  // Planned vs realized R
  let avgPlannedR: number|null = null, avgRealizedR: number|null = null, plannedVsRealizedGap: number|null = null;
  const withPlanned = trades.filter(t => t.plannedR !== undefined && t.plannedR > 0);
  const withRealized = trades.filter(t => t.realizedR !== undefined);
  if (withPlanned.length >= 3) avgPlannedR = withPlanned.reduce((a,t)=>a+(t.plannedR||0),0)/withPlanned.length;
  if (withRealized.length >= 3) avgRealizedR = withRealized.reduce((a,t)=>a+(t.realizedR||0),0)/withRealized.length;
  if (avgPlannedR != null && avgRealizedR != null) plannedVsRealizedGap = avgPlannedR - avgRealizedR;

  // Partial rate
  let partialRate: number|null = null;
  if (hasPartials) { partialRate = trades.filter(t=>t.hasPartial).length / trades.length; }

  // Post-loss behavior
  let postLossBehavior: 'stable'|'degraded'|'unknown' = 'unknown';
  if (trades.length >= 10) {
    const pnls = trades.map(t=>t.pnl).filter((v):v is number => v !== undefined);
    let postLossWins = 0, postLossTotal = 0;
    for (let i = 1; i < pnls.length; i++) {
      if (pnls[i-1] < 0) { postLossTotal++; if (pnls[i] > 0) postLossWins++; }
    }
    if (postLossTotal >= 5) {
      const overallWR = pnls.filter(v=>v>0).length / pnls.length;
      const postLossWR = postLossWins / postLossTotal;
      postLossBehavior = postLossWR < overallWR - 0.12 ? 'degraded' : 'stable';
    }
  }

  // Confidence
  let confidenceLevel: JournalAnalysis['confidenceLevel'] = 'Medium';
  let confidenceNote = 'Journal data is usable for enriched analysis.';
  const richness = [hasPlannedR, hasNotes, hasSide, hasPartials, hasStopTarget].filter(Boolean).length;
  if (trades.length >= 40 && richness >= 3) { confidenceLevel = 'High'; confidenceNote = 'Rich journal data with sufficient sample. High confidence execution read.'; }
  else if (trades.length < 15 || richness < 2) { confidenceLevel = 'Limited'; confidenceNote = 'Journal insight is limited because some execution fields were not available or sample is thin.'; }

  // Journal-specific suggestions
  const suggestions: ExecutionSuggestion[] = [];
  if (plannedVsRealizedGap != null && plannedVsRealizedGap > 0.3) {
    suggestions.push({ type:'observation', title:'Gap between planned and realized R',
      message:`Your journal shows you target ${avgPlannedR!.toFixed(1)}R on average, but capture ${avgRealizedR!.toFixed(2)}R. The execution gap of ${plannedVsRealizedGap.toFixed(2)}R likely comes from partial exits or early profit-taking.` });
  }
  if (partialRate != null && partialRate > 0.3) {
    suggestions.push({ type:'observation', title:'Frequent partial exits detected',
      message:`${(partialRate*100).toFixed(0)}% of your trades involve partial exits. This compresses your realized RR but may also protect capital. The question is whether the protection is worth the compression.` });
  }
  if (postLossBehavior === 'degraded') {
    suggestions.push({ type:'improvement', title:'Execution degrades after losses',
      message:'Your win rate drops noticeably after a losing trade. This suggests emotional reaction or revenge trading. Consider a mandatory cooldown rule after any loss.' });
  } else if (postLossBehavior === 'stable') {
    suggestions.push({ type:'positive', title:'Stable execution after losses',
      message:'Your performance stays consistent after losing trades. This is a significant behavioral strength under challenge pressure.' });
  }

  return {
    usable: trades.length >= 5,
    trades, tradeCount: trades.length,
    hasPlannedR, hasNotes, hasSide, hasPartials, hasStopTarget,
    avgPlannedR, avgRealizedR, plannedVsRealizedGap, partialRate,
    postLossBehavior, confidenceLevel, confidenceNote,
    suggestions: suggestions.slice(0, 3),
  };
}

// ── Cross analysis (balance history + journal) ──────────────

export function crossAnalyze(execution: ExecutionAnalysis, journal: JournalAnalysis): CrossAnalysis {
  const { metrics } = execution;
  const suggestions: ExecutionSuggestion[] = [];

  // Determine execution style
  let executionStyle: CrossAnalysis['executionStyle'] = 'viable_compressed';
  if (metrics.expectancyR >= 0.40 && metrics.lossConsistency !== 'wide' && journal.postLossBehavior !== 'degraded') {
    executionStyle = 'clean_controlled';
  } else if (metrics.lossConsistency === 'wide' || journal.postLossBehavior === 'degraded') {
    executionStyle = metrics.expectancyR > 0 ? 'irregular' : 'fragile_under_constraint';
  } else if (execution.rrGap && execution.rrGap > 0.3) {
    executionStyle = 'viable_compressed';
  }

  // Main strength
  let mainStrength = 'Edge is present in the data.';
  if (metrics.lossConsistency === 'tight' && journal.postLossBehavior === 'stable') mainStrength = 'Disciplined loss management and emotional stability after losses.';
  else if (metrics.winRate >= 0.55) mainStrength = 'High win rate provides consistent income flow.';
  else if (metrics.realizedRR >= 2.0) mainStrength = 'Strong reward capture when winners run.';
  else if (metrics.profitFactor >= 1.5) mainStrength = 'Solid profit factor indicates sustainable edge.';

  // Main improvement
  let mainImprovement = 'Continue refining execution consistency.';
  if (execution.rrGap && execution.rrGap > 0.5) mainImprovement = 'Review how profits are managed after price moves in your favor. The gap between intended and realized RR is significant.';
  else if (metrics.lossConsistency === 'wide') mainImprovement = 'Standardize stop-loss discipline. Your losses vary too much in size.';
  else if (journal.postLossBehavior === 'degraded') mainImprovement = 'Add a hard rule after losses: wait, do not trade for revenge. Your data shows execution quality drops after losing trades.';
  else if (metrics.outlierDependency === 'high') mainImprovement = 'Reduce dependency on big winners. Spread edge across more consistent trades.';
  else if (journal.partialRate && journal.partialRate > 0.4) mainImprovement = 'Evaluate whether frequent partial exits are protecting capital or compressing edge. Try running some winners to full target as a test.';

  // Behavior read
  const styleLabels: Record<string, string> = {
    clean_controlled: 'Execution looks clean and consistent across both data sources.',
    viable_compressed: 'Edge is present but compressed by execution. The issue may not be strategy — it may be how profits are managed.',
    irregular: 'Execution shows inconsistencies that challenge rules will amplify. Focus on standardizing behavior before paying a fee.',
    fragile_under_constraint: 'Current execution is too fragile for challenge pressure. Work on the fundamentals before attempting.',
  };
  const behaviorRead = styleLabels[executionStyle];

  // Cross-specific suggestions
  if (executionStyle === 'viable_compressed' && journal.hasPlannedR) {
    suggestions.push({ type:'improvement', title:'The problem is likely execution, not strategy',
      message:'Your journal shows planned setups with decent structure. The compression happens during execution. Reviewing your trade management rules specifically could unlock the edge your strategy already has.' });
  }
  if (executionStyle === 'clean_controlled') {
    suggestions.push({ type:'positive', title:'Both data sources confirm a stable profile',
      message:'Balance history and journal agree: your execution is consistent. This is exactly the kind of profile that benefits most from the right challenge structure.' });
  }
  if (journal.postLossBehavior === 'degraded' && metrics.winRate >= 0.48) {
    suggestions.push({ type:'improvement', title:'Your base edge is fine — post-loss behavior is the leak',
      message:'Your overall stats are workable, but performance drops after losses. A simple post-loss cooldown rule could measurably improve your challenge readiness.' });
  }

  return { behaviorRead, executionStyle, mainStrength, mainImprovement, suggestions: suggestions.slice(0, 3) };
}

// ── Extract P&L values from raw CSV ─────────────────────────

export function extractPnlFromCsv(text: string): number[]|null {
  const raw = String(text||'').replace(/^\uFEFF/,'').trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const delims = [',',';','\t','|'];
  let bestD=',',bestS=-1;
  for(const d of delims){let s=0;for(const l of lines.slice(0,8)){let q=false,c=0;for(let i=0;i<l.length;i++){if(l[i]==='"')q=!q;else if(l[i]===d&&!q)c++;}s+=c;}if(s>bestS){bestS=s;bestD=d;}}

  function split(line:string):string[]{const o:string[]=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===bestD&&!q){o.push(c.trim());c='';}else c+=ch;}o.push(c.trim());return o;}

  const rows = lines.map(split);
  const hdr = rows[0].map(h=>h.toLowerCase().replace(/[\u00a0\s]+/g,' ').replace(/[%()]/g,'').trim());
  const pnlAliases = [/^pnl$/,/^p&l$/,/^net pnl$/,/^realized p&l$/,/^realized pnl$/,/^realized p&l value$/,/^realized pnl value$/,/^closed pnl$/,/^profit$/,/^net profit$/,/^gain\/loss$/,/^return$/,/^pl$/];
  let colIdx = hdr.findIndex(h=>pnlAliases.some(rx=>rx.test(h)));
  if (colIdx < 0) {
    const maxC = Math.max(...rows.map(r=>r.length));
    let bI=-1,bS=-1;
    for(let col=0;col<maxC;col++){if(/^(time|date|balance|currency|action|symbol|side|price|qty)$/i.test(hdr[col]||''))continue;let s=0,p=0,n=0;for(let i=1;i<Math.min(rows.length,121);i++){const v=parseFloat((rows[i][col]||'').replace(/[^0-9.\-]/g,''));if(!isNaN(v)){s++;if(v>0)p++;if(v<0)n++;}}if(p>0&&n>0)s+=14;if(s>bS){bS=s;bI=col;}}
    colIdx=bI;
  }
  if (colIdx < 0) return null;

  const values: number[] = [];
  for (let i=1;i<rows.length;i++){
    let s=(rows[i][colIdx]||'').trim();if(!s)continue;
    let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
    s=s.replace(/[€$£¥₽₹\s]/g,'');if(s.startsWith('+')){s=s.slice(1);}if(s.startsWith('-')){neg=true;s=s.slice(1);}
    if(s.includes('.')&&s.includes(',')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}
    else if(s.includes(',')&&!s.includes('.')){const p=s.split(',');if(p.length===2&&p[1].length<=2)s=p[0]+'.'+p[1];else s=p.join('');}
    s=s.replace(/[^0-9.]/g,'');const n=parseFloat(s);if(!isNaN(n)&&isFinite(n))values.push(neg?-n:n);
  }
  return values.length >= 8 ? values : null;
}
