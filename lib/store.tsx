'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  FIRMS, CHALLENGES, evaluateChallenge, compareSameSize,
  verdictFor, buildDisplayStats, deriveManualEdge, parseCsvText,
  extractPnlFromCsv, computeRealExecutionMetrics, analyzeExecutionProfile,
  parseTradingJournal, crossAnalyze,
  type Edge, type EvaluationResult, type Verdict, type DisplayStats, type StressMode,
  type ExecutionAnalysis, type JournalAnalysis, type CrossAnalysis,
} from '@/lib/simphase';

export type AnalysisLevel = 'manual' | 'balance_csv' | 'balance_and_journal';

interface AnalysisResult {
  result: EvaluationResult; alternatives: EvaluationResult[]; edge: Edge;
  display: DisplayStats; verdict: Verdict; enrichedVerdictNote: string;
  execution: ExecutionAnalysis | null; journal: JournalAnalysis | null;
  cross: CrossAnalysis | null; level: AnalysisLevel;
}

interface SimPhaseState {
  selectedFirm: string; selectedChallenge: string; selectedSize: number;
  inputMode: 'manual' | 'csv'; stressMode: StressMode; market: string;
  fee: number; feeTouched: boolean;
  winRate: number; payoffRatio: number; tradeFrequency: number;
  frequencyUnit: 'day' | 'week'; maxLossStreak: number; sampleTrades: number;
  parsedEdge: Edge | null; csvFileName: string; csvRawText: string;
  journalRawText: string; journalFileName: string;
  analysis: AnalysisResult | null; isAnalyzing: boolean;
}

interface SimPhaseActions {
  setFirm: (id: string) => void; setChallenge: (id: string) => void; setSize: (s: number) => void;
  setInputMode: (m: 'manual'|'csv') => void; setStressMode: (m: StressMode) => void;
  setMarket: (m: string) => void; setFee: (f: number) => void;
  setManualInput: (f: string, v: number|string) => void;
  loadCsv: (text: string, name: string) => boolean;
  loadJournalCsv: (text: string, name: string) => boolean;
  removeJournalCsv: () => void;
  runAnalysis: () => Promise<void>; loadDemo: () => void; reset: () => void;
}

type Store = SimPhaseState & SimPhaseActions;
const SimPhaseContext = createContext<Store | null>(null);

const defaults: SimPhaseState = {
  selectedFirm:'ftmo', selectedChallenge:'ftmo_2step', selectedSize:50000,
  inputMode:'manual', stressMode:'realistic', market:'cfd', fee:345, feeTouched:false,
  winRate:47, payoffRatio:2, tradeFrequency:2.1, frequencyUnit:'day', maxLossStreak:5, sampleTrades:120,
  parsedEdge:null, csvFileName:'', csvRawText:'',
  journalRawText:'', journalFileName:'',
  analysis:null, isAnalyzing:false,
};

const SAMPLE_CSV = `date,pnl\n2026-03-02,-90\n2026-03-02,235\n2026-03-03,128\n2026-03-04,132\n2026-03-04,154\n2026-03-04,-73\n2026-03-05,151\n2026-03-05,-117\n2026-03-05,-90\n2026-03-06,240\n2026-03-09,196\n2026-03-09,-98\n2026-03-10,200\n2026-03-11,197\n2026-03-12,-101\n2026-03-13,-91\n2026-03-13,202\n2026-03-16,155\n2026-03-16,229\n2026-03-17,-96\n2026-03-18,-84\n2026-03-18,-76\n2026-03-19,168\n2026-03-19,-91\n2026-03-20,-99\n2026-03-23,169\n2026-03-23,232\n2026-03-24,-117\n2026-03-25,-73\n2026-03-25,-85\n2026-03-26,-111\n2026-03-26,174\n2026-03-26,-71\n2026-03-27,206\n2026-03-27,151\n2026-03-30,155\n2026-03-30,242\n2026-03-31,176\n2026-04-01,-111\n2026-04-01,-84\n2026-04-02,-104\n2026-04-02,152\n2026-04-03,152\n2026-04-06,236\n2026-04-07,121\n2026-04-08,-100\n2026-04-08,138\n2026-04-09,-103\n2026-04-09,-93\n2026-04-09,-118\n2026-04-10,176\n2026-04-10,209\n2026-04-10,129\n2026-04-13,135\n2026-04-14,120\n2026-04-14,134\n2026-04-14,124\n2026-04-15,-77\n2026-04-16,-100\n2026-04-16,136`;

function enrichVerdict(v: Verdict, exec: ExecutionAnalysis|null, cross: CrossAnalysis|null): string {
  if (!exec) return v.hint;
  if (exec.executionRead.style === 'strong' && (v.label === 'Strong' || v.label === 'Playable'))
    return `${v.label} with a stable execution profile. Gains and losses both look controlled.`;
  if (exec.executionRead.style === 'warn' && exec.rrGap && exec.rrGap > 0.3)
    return `${v.label}, but your execution appears to compress your edge. Realized RR is meaningfully below target.`;
  if (exec.executionRead.style === 'bad')
    return `${v.label}. Actual trade capture looks weaker than the target structure suggests.`;
  if (cross?.behaviorRead) return `${v.label}. ${cross.behaviorRead}`;
  return v.hint;
}

const PERSIST_KEY = 'simphase_state_v1';
const PERSIST_FIELDS = ['selectedFirm','selectedChallenge','selectedSize','inputMode','stressMode','market','fee','feeTouched','winRate','payoffRatio','tradeFrequency','frequencyUnit','maxLossStreak','sampleTrades','csvFileName','csvRawText','journalRawText','journalFileName'] as const;

export function SimPhaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimPhaseState>(defaults);
  const hydrated = useRef(false);

  const doAnalysis = useCallback((s: SimPhaseState) => {
    const edge = s.inputMode==='csv' && s.parsedEdge ? s.parsedEdge
      : deriveManualEdge({ winRate:s.winRate, payoffRatio:s.payoffRatio, tradeFrequency:s.tradeFrequency,
          frequencyUnit:s.frequencyUnit, maxLossStreak:s.maxLossStreak, sampleTrades:s.sampleTrades, market:s.market });
    const ch = CHALLENGES[s.selectedChallenge];
    const result = evaluateChallenge(ch, s.selectedSize, edge, s.fee, s.market, s.stressMode);
    const alternatives = compareSameSize(CHALLENGES, s.selectedSize, edge, s.market, s.stressMode);
    const display = buildDisplayStats(result, edge);
    const verdict = verdictFor(result);

    let execution: ExecutionAnalysis|null = null;
    if (s.inputMode==='csv' && s.csvRawText) {
      const pnl = extractPnlFromCsv(s.csvRawText);
      if (pnl) { const m = computeRealExecutionMetrics(pnl); if (m) execution = analyzeExecutionProfile(m, s.payoffRatio>0?s.payoffRatio:null); }
    }
    let journal: JournalAnalysis|null = null;
    if (s.journalRawText) journal = parseTradingJournal(s.journalRawText);
    let cross: CrossAnalysis|null = null;
    if (execution && journal?.usable) cross = crossAnalyze(execution, journal);

    const level: AnalysisLevel = (s.inputMode==='csv'&&execution&&journal?.usable)?'balance_and_journal':(s.inputMode==='csv'&&execution)?'balance_csv':'manual';
    const enrichedVerdictNote = enrichVerdict(verdict, execution, cross);
    return { result, alternatives, edge, display, verdict, enrichedVerdictNote, execution, journal, cross, level };
  }, []);

  // ── Persistence: restore inputs on load, save on change ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setState(prev => {
          const next: SimPhaseState = { ...prev };
          for (const k of PERSIST_FIELDS) if (saved[k] !== undefined) (next as any)[k] = saved[k];
          if (!CHALLENGES[next.selectedChallenge] || !FIRMS[next.selectedFirm]) {
            next.selectedFirm = prev.selectedFirm; next.selectedChallenge = prev.selectedChallenge;
          }
          if (next.csvRawText) {
            const p = parseCsvText(next.csvRawText);
            if (p) next.parsedEdge = p;
            else { next.csvRawText = ''; next.csvFileName = ''; next.inputMode = 'manual'; }
          }
          return next;
        });
      }
    } catch {}
    hydrated.current = true;
    // Post-payment return: the inputs are restored, so re-run the analysis automatically
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('session_id') || params.get('unlocked')) {
        setTimeout(() => setState(s => s.analysis ? s : ({ ...s, analysis: doAnalysis(s) })), 120);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const out: Record<string, unknown> = {};
      for (const k of PERSIST_FIELDS) out[k] = (state as any)[k];
      localStorage.setItem(PERSIST_KEY, JSON.stringify(out));
    } catch {}
  }, [state]);

  const actions: SimPhaseActions = {
    setFirm:(id)=>{const f=FIRMS[id];if(!f)return;const fc=f.challenges[0];const ch=CHALLENGES[fc];
      setState(s=>({...s,selectedFirm:id,selectedChallenge:fc,selectedSize:ch.sizes.includes(s.selectedSize)?s.selectedSize:ch.sizes[0],feeTouched:false,fee:ch.feeDefaults[ch.sizes.includes(s.selectedSize)?s.selectedSize:ch.sizes[0]]??0}));},
    setChallenge:(id)=>{const ch=CHALLENGES[id];if(!ch)return;setState(s=>({...s,selectedChallenge:id,selectedSize:ch.sizes.includes(s.selectedSize)?s.selectedSize:ch.sizes[0],feeTouched:false,fee:ch.feeDefaults[ch.sizes.includes(s.selectedSize)?s.selectedSize:ch.sizes[0]]??0}));},
    setSize:(sz)=>{const ch=CHALLENGES[state.selectedChallenge];setState(s=>({...s,selectedSize:sz,feeTouched:false,fee:ch?.feeDefaults[sz]??0}));},
    setInputMode:(m)=>setState(s=>({...s,inputMode:m})),
    setStressMode:(m)=>setState(s=>({...s,stressMode:m})),
    setMarket:(m)=>setState(s=>({...s,market:m})),
    setFee:(f)=>setState(s=>({...s,fee:f,feeTouched:true})),
    setManualInput:(f,v)=>setState(s=>({...s,[f]:v})),
    loadCsv:(text,name)=>{const p=parseCsvText(text);if(p){setState(s=>({...s,parsedEdge:p,csvFileName:name,csvRawText:text,inputMode:'csv'}));return true;}return false;},
    loadJournalCsv:(text,name)=>{const j=parseTradingJournal(text);if(j){setState(s=>({...s,journalRawText:text,journalFileName:name}));return true;}return false;},
    removeJournalCsv:()=>setState(s=>({...s,journalRawText:'',journalFileName:''})),
    runAnalysis:async()=>{setState(s=>({...s,isAnalyzing:true}));await new Promise(r=>setTimeout(r,400));setState(s=>({...s,analysis:doAnalysis(s),isAnalyzing:false}));},
    loadDemo:()=>{const p=parseCsvText(SAMPLE_CSV);if(!p)return;setState(s=>{const n={...s,parsedEdge:p,csvFileName:'Demo CSV',csvRawText:SAMPLE_CSV,inputMode:'csv' as const};return{...n,analysis:doAnalysis(n)};});},
    reset:()=>{try{localStorage.removeItem(PERSIST_KEY);}catch{} setState(defaults);},
  };

  return <SimPhaseContext.Provider value={{...state,...actions}}>{children}</SimPhaseContext.Provider>;
}

export function useSimPhase(): Store {
  const ctx = useContext(SimPhaseContext);
  if (!ctx) throw new Error('useSimPhase must be used within SimPhaseProvider');
  return ctx;
}
