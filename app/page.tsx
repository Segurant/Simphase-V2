'use client';

import { SimPhaseProvider, useSimPhase } from '@/lib/store';
import { FIRMS, CHALLENGES, rf, economicsPosture, verdictFor, buildRecommendations } from '@/lib/simphase';
import { useState, useEffect, useRef } from 'react';

export default function Home() { return <SimPhaseProvider><AppContent /></SimPhaseProvider>; }

function AppContent() {
  const s = useSimPhase();
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const toggleTheme = () => { const n = theme==='dark'?'light':'dark'; setTheme(n); document.documentElement.className = n; };
  const challenge = CHALLENGES[s.selectedChallenge];
  const firm = FIRMS[s.selectedFirm];

  return (<>
    {/* TOPBAR */}
    <header className="sticky top-0 z-50 backdrop-blur-2xl border-b border-[var(--border)]" style={{background:'color-mix(in srgb, var(--bg) 80%, transparent)'}}>
      <div className="max-w-[1380px] mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[14px] grid place-items-center border border-[var(--border)]" style={{background:'linear-gradient(135deg, rgba(124,92,255,0.22), rgba(22,192,216,0.18))'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 16L9 11L13 14L20 7" stroke="#c9bcff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25"/><path d="M20 7H16" stroke="#72f1ff" strokeLinecap="round" strokeWidth="2.25"/><path d="M20 7V11" stroke="#72f1ff" strokeLinecap="round" strokeWidth="2.25"/></svg>
          </div>
          <div><h1 className="text-base font-bold tracking-tight m-0">SimPhase</h1><p className="text-[var(--text-3)] text-xs mt-0.5 m-0">Challenge Readiness · Risk Plan · Firm Fit</p></div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:inline-flex items-center gap-2 border border-[var(--border)] px-3 py-2 rounded-full text-xs text-[var(--text-2)]" style={{background:'rgba(255,255,255,0.03)'}}>
            <span className="w-2 h-2 rounded-full bg-[var(--green)]"/><span>FTMO · Topstep · FundedNext · FundingPips</span><span className="text-[var(--text-3)]">· Rules verified June 2026</span>
          </div>
          <button onClick={toggleTheme} className="w-[42px] h-[42px] rounded-[14px] border border-[var(--border)] grid place-items-center cursor-pointer" style={{background:'rgba(255,255,255,0.03)',color:'var(--text)'}}>&#9684;</button>
        </div>
      </div>
    </header>

    <main className="max-w-[1380px] mx-auto px-4">

      {/* HERO */}
      <section className="py-10 md:py-14">
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border border-[rgba(124,92,255,0.18)]" style={{background:'rgba(124,92,255,0.12)',color:'#d8ccff'}}>Challenge readiness tool for prop traders</span>
        <h2 className="mt-4 text-3xl md:text-5xl lg:text-6xl font-extrabold leading-none max-w-[760px]" style={{letterSpacing:'-0.055em'}}>Know if this challenge is actually playable before you burn another fee.</h2>
        <p className="mt-3.5 text-[var(--text-2)] text-base md:text-lg max-w-[760px] leading-relaxed">SimPhase runs thousands of rule-accurate simulations of your edge inside the exact challenge — daily loss, trailing drawdown, best-day and consistency mechanics included — then tells you the risk that survives, what kills most attempts, and the realistic cost of one pass.</p>
        <div className="flex flex-wrap gap-3 mt-6"><a href="#analyzer" className="sp-btn sp-btn-primary">Start challenge diagnostic</a><button onClick={s.loadDemo} className="sp-btn sp-btn-secondary">Load demo profile</button></div>
      </section>

      {/* WORKSPACE */}
      <div id="analyzer" className="workspace-grid grid gap-6 items-start pb-8" style={{gridTemplateColumns:'minmax(0, 1fr) minmax(320px, 0.72fr)'}}>
        <div className="space-y-5">

          {/* STEP 1 - FIRM + MARKET */}
          <section className="sp-card p-6">
            <h3 className="text-lg font-bold tracking-tight">Step 1 - Choose the prop firm</h3>
            <p className="text-[var(--text-2)] text-sm mt-1 mb-4">Start with the brand you are actually considering.</p>

            {/* Market family - prominent */}
            <div className="mb-5 p-4 rounded-2xl border border-[rgba(124,92,255,0.25)]" style={{background:'rgba(124,92,255,0.08)'}}>
              <label className="text-sm font-bold block mb-2.5" style={{color:'var(--text)'}}>What do you trade?</label>
              <div className="flex gap-2 flex-wrap">
                {[['cfd','Forex / CFD'],['futures','Futures'],['indices','Indices'],['mixed','Mixed']].map(([v,l])=>
                  <button key={v} onClick={()=>s.setMarket(v)}
                    className={`px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${s.market===v ? 'border-[rgba(124,92,255,0.5)] text-white' : 'border-[var(--border)] text-[var(--text-2)]'}`}
                    style={{background: s.market===v ? 'rgba(124,92,255,0.20)' : 'rgba(255,255,255,0.03)'}}>
                    {l}
                  </button>)}
              </div>
            </div>

            <div className="firm-grid grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {Object.entries(FIRMS).map(([id, f]) => (
                <button key={id} onClick={() => s.setFirm(id)} className={`choice-card ${s.selectedFirm===id?'active':''}`}>
                  <span className="inline-block px-2 py-1 rounded-full text-[0.72rem] font-bold border border-[var(--border)] text-[var(--text-2)] mb-3" style={{background:'rgba(255,255,255,0.05)'}}>{f.highlight}</span>
                  <strong className="block text-base mb-2">{f.label}</strong>
                  <p className="text-[var(--text-2)] text-[0.82rem] leading-relaxed m-0">{f.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* STEP 2 - CHALLENGE + SIZE */}
          <section className="sp-card p-6">
            <h3 className="text-lg font-bold tracking-tight">Step 2 - Select the challenge structure</h3>
            <p className="text-[var(--text-2)] text-sm mt-1 mb-4">Only the variants that matter.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {firm.challenges.map(id => { const ch = CHALLENGES[id]; return (
                <button key={id} onClick={() => s.setChallenge(id)} className={`challenge-card ${s.selectedChallenge===id?'active':''}`}>
                  <div className="flex justify-between gap-3 items-start">
                    <div><strong className="block text-base mb-1">{ch.name}</strong><p className="text-[var(--text-2)] text-sm m-0">{ch.ruleLabel}</p></div>
                    <span className={`shrink-0 px-2 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider border whitespace-nowrap ${ch.confidence==='verified'?'bg-[rgba(34,197,94,0.12)] text-[#b8f6cf] border-[rgba(34,197,94,0.2)]':'bg-[rgba(245,158,11,0.12)] text-[#fbd38d] border-[rgba(245,158,11,0.2)]'}`}>{ch.confidence==='verified'?'Verified':'Monitored'}</span>
                  </div>
                  <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed mt-3 m-0">{ch.description}</p>
                </button>
              ); })}
            </div>
            <div className="mt-5"><h3 className="text-base font-bold mb-2">Account size</h3>
              <div className="flex flex-wrap gap-2.5">
                {challenge.sizes.map(sz => <button key={sz} onClick={() => s.setSize(sz)} className={`sp-pill ${s.selectedSize===sz?'active':''}`}>${sz>=1000?`${sz/1000}k`:sz}</button>)}
              </div>
            </div>
          </section>

          {/* STEP 3 - EDGE (simplified) */}
          <EdgeSection />

        </div>

        {/* RIGHT - ACTION PANEL */}
        <aside className="sticky top-24 space-y-5">
          <section className="sp-card p-6">
            <div className="sp-surface p-5 mb-5" style={{background:'linear-gradient(180deg, rgba(124,92,255,0.16), rgba(255,255,255,0.03))'}}>
              <strong className="block text-lg leading-snug tracking-tight mb-2">Should you take {challenge.longName} on ${s.selectedSize>=1000?`${s.selectedSize/1000}k`:s.selectedSize}?</strong>
              <p className="text-[var(--text-2)] text-sm leading-relaxed m-0">{challenge.description}</p>
            </div>
            <div className="mb-5"><div className="flex justify-between items-end mb-2"><label className="text-sm font-bold">Challenge fee</label><span className="text-[var(--text-3)] text-xs">Editable</span></div><NumericInput value={s.fee} onChange={v=>s.setFee(v)} /><p className="text-[var(--text-3)] text-xs leading-relaxed mt-2">{challenge.feeNote}</p></div>
            <div className="h-px bg-[var(--border)] my-4"/>
            <div className="space-y-2.5">
              <button onClick={s.runAnalysis} disabled={s.isAnalyzing} className="sp-btn sp-btn-primary w-full disabled:opacity-90 disabled:pointer-events-none"><span>{s.isAnalyzing?'Analyzing...':'See if this challenge is playable'}</span>{s.isAnalyzing&&<span className="sp-spinner"/>}</button>
              <button onClick={s.loadDemo} className="sp-btn sp-btn-secondary w-full">Load demo profile</button>
              <button onClick={s.reset} className="sp-btn sp-btn-secondary w-full" style={{color:'var(--text-2)'}}>Reset</button>
            </div>
          </section>
        </aside>
      </div>

      {/* RESULTS */}
      {s.analysis && <Results />}

      {/* FOOTER */}
      <footer className="py-10 mt-4 border-t border-[var(--border)] text-center">
        <p className="text-[var(--text-3)] text-xs leading-relaxed max-w-[640px] mx-auto m-0">
          SimPhase runs Monte Carlo simulations under each firm's published rules (verified June 2026). Results are statistical estimates based on the edge you provide — not guarantees, and not financial advice. Prop firm rules change; always confirm current terms with the firm before purchasing a challenge.
        </p>
      </footer>
    </main>
  </>);
}


function EdgeSection() {
  const s = useSimPhase();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="sp-card p-6">
      <h3 className="text-lg font-bold tracking-tight">Step 3 - Add your edge</h3>
      <p className="text-[var(--text-2)] text-sm mt-1 mb-4">Two numbers are enough for a first answer. Expand for more precision.</p>
      <div className="flex gap-2.5 mb-5">
        {(['manual','csv'] as const).map(mode => <button key={mode} onClick={() => s.setInputMode(mode)} className={`sp-pill sp-pill-alt ${s.inputMode===mode?'active':''}`}>{mode==='manual'?'Manual (fastest)':'Import CSV'}</button>)}
      </div>

      {s.inputMode === 'csv' && <>
        {/* Precision upgrade message */}
        <div className="mb-4 p-4 rounded-2xl border border-[rgba(34,197,94,0.25)]" style={{background:'rgba(34,197,94,0.06)'}}>
          <p className="text-sm font-bold m-0 mb-1" style={{color:'#b8f6cf'}}>Manual inputs give an estimate. Your real data shows how you actually trade.</p>
          <p className="text-[var(--text-2)] text-[0.82rem] m-0 leading-relaxed">Your CSV gives a much more accurate result than manual inputs. This is where SimPhase becomes genuinely useful.</p>
        </div>

        <CsvUploadZone type="balance" label="A. Balance History CSV" hint="Recommended: balance history with Realized P and L (value). This drives the core analysis." fileName={s.csvFileName} onUpload={(text,name) => s.loadCsv(text,name)} onDemo={s.loadDemo} sampleCount={s.parsedEdge?.sampleTrades} />

        {/* Sample size note */}
        <div className="mt-3 text-[0.82rem] text-[var(--text-2)] leading-relaxed">
          More data = more reliable insight. Results based on very few trades may not reflect your real performance.
        </div>

        <div className="mt-4">
          <CsvUploadZone type="journal" label="B. Trading Journal CSV (optional)" hint="Enriches the analysis with execution behavior, planned vs realized R, post-loss patterns." fileName={s.journalFileName} onUpload={(text,name) => s.loadJournalCsv(text,name)} sampleCount={null} onRemove={s.journalFileName ? s.removeJournalCsv : undefined} />
        </div>

        {/* Disclaimer */}
        <div className="mt-4 p-3.5 rounded-xl text-[0.82rem] leading-relaxed" style={{background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#fcd08a'}}>
          Make sure you export from the correct paper trading account. Double-check your account name before uploading.
        </div>

        {/* How to export guide */}
        <div className="mt-4">
          <HowToExport />
        </div>

        <div className="mt-5 sp-surface p-5">
          <h4 className="text-sm font-bold mb-2">The RR you target is not always the RR you execute.</h4>
          <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0 mb-2">You can aim for 2R on your setups, but your real RR may be lower if you take partials, secure profits before the full target, cut winners early, or let losses run wider than planned.</p>
          <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0">This is important because it shows how your edge actually expresses itself under execution, not just on paper.</p>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider border ${s.csvFileName ? 'confidence-high' : 'confidence-low'}`}>{s.csvFileName ? 'Balance history loaded' : 'No balance history'}</span>
          <span className={`px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider border ${s.journalFileName ? 'confidence-high' : 'confidence-medium'}`}>{s.journalFileName ? 'Journal loaded' : 'No journal (optional)'}</span>
        </div>
      </>}

      {s.inputMode === 'manual' && <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
          <InputField label="Win rate" hint="% of trades that finish positive" value={s.winRate} min={1} max={99} step={0.1} onChange={v=>s.setManualInput('winRate',v)} />
          <InputField label="Payoff multiple (RR)" hint="Average winner / average loser" value={s.payoffRatio} min={0.2} max={10} step={0.1} onChange={v=>s.setManualInput('payoffRatio',v)} />
        </div>
        <button onClick={()=>setShowAdvanced(!showAdvanced)} className="text-sm font-bold cursor-pointer bg-transparent border-none flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity" style={{color:'var(--accent)'}}>
          <span style={{transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.2s', display:'inline-block'}}>&#9654;</span>
          {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields (optional)'}
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-4 rounded-2xl border border-[var(--border)]" style={{background:'rgba(255,255,255,0.02)'}}>
            <InputField label="Trade frequency" hint="Average pace" value={s.tradeFrequency} min={0.2} max={50} step={0.1} onChange={v=>s.setManualInput('tradeFrequency',v)} />
            <div><div className="flex justify-between mb-2"><label className="text-sm font-bold">Frequency unit</label></div><select value={s.frequencyUnit} onChange={e=>s.setManualInput('frequencyUnit',e.target.value)} className="sp-input"><option value="day">Per day</option><option value="week">Per week</option></select></div>
            <InputField label="Max losing streak" hint="Observed or expected" value={s.maxLossStreak} min={2} max={20} step={1} onChange={v=>s.setManualInput('maxLossStreak',v)} />
            <InputField label="Backtest trades" hint="For confidence width" value={s.sampleTrades} min={10} max={5000} step={1} onChange={v=>s.setManualInput('sampleTrades',v)} />
          </div>
        )}
      </div>}

      <div className="mt-5">
        <h3 className="text-base font-bold mb-2">Execution mode</h3>
        <div className="flex gap-2.5">
          {(['calm','realistic','pressure'] as const).map(mode=><button key={mode} onClick={()=>s.setStressMode(mode)} className={`sp-pill ${s.stressMode===mode?'active':''} capitalize`}>{mode}</button>)}
        </div>
      </div>
    </section>
  );
}


function CsvUploadZone({ type, label, hint, fileName, onUpload, onDemo, sampleCount, onRemove }: { type: string; label: string; hint: string; fileName: string; onUpload: (text:string, name:string) => boolean; onDemo?: () => void; sampleCount?: number|null; onRemove?: () => void; }) {
  const [error, setError] = useState('');
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setError(''); const text = await file.text(); if (!onUpload(text, file.name)) setError('Could not parse this file. Check the format and try again.'); };
  return (
    <div className="rounded-[20px] border border-dashed border-[rgba(124,92,255,0.34)] p-5 relative" style={{background:'rgba(124,92,255,0.06)'}}>
      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer"/>
      <strong className="block text-sm mb-1">{label}</strong>
      <p className="text-[var(--text-2)] text-[0.82rem] m-0 leading-relaxed">{hint}</p>
      {fileName && <div className="mt-3 px-3 py-2 rounded-xl text-sm font-bold text-[#b8f6cf] flex justify-between items-center" style={{background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.24)'}}><span>{fileName}{sampleCount ? ` - ${sampleCount} rows` : ''}</span>{onRemove && <button onClick={(e)=>{e.stopPropagation();onRemove();}} className="text-xs underline opacity-70 bg-transparent border-none cursor-pointer" style={{color:'#b8f6cf'}}>Remove</button>}</div>}
      {error && <div className="mt-3 px-3 py-2 rounded-xl text-sm font-bold text-[#fdadad]" style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.24)'}}>{error}</div>}
      {onDemo && !fileName && <button onClick={onDemo} className="mt-3 text-sm text-[var(--text-2)] underline underline-offset-2 cursor-pointer bg-transparent border-none font-semibold">Load demo CSV instead</button>}
    </div>
  );
}

function NumericInput({value,onChange,className}:{value:number;onChange:(v:number)=>void;className?:string}) {
  const [text, setText] = useState(String(value));
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { setText(String(value)); last.current = value; } }, [value]);
  return <input type="text" inputMode="decimal" value={text}
    onChange={e=>{ const raw=e.target.value; setText(raw); const n=parseFloat(raw.replace(',','.')); if(Number.isFinite(n)){ last.current=n; onChange(n); } }}
    onBlur={()=>{ const n=parseFloat(text.replace(',','.')); if(!Number.isFinite(n)) setText(String(value)); else if(String(n)!==text) setText(String(n)); }}
    className={className||'sp-input'} />;
}

function InputField({label,hint,value,onChange}:{label:string;hint:string;value:number;min?:number;max?:number;step?:number;onChange:(v:number)=>void}) {
  return <div><div className="flex justify-between items-end mb-2"><label className="text-sm font-bold">{label}</label><span className="text-[var(--text-3)] text-xs">{hint}</span></div><NumericInput value={value} onChange={onChange} /></div>;
}


function Results() {
  const { analysis } = useSimPhase();
  if (!analysis) return null;
  const { result, alternatives, display, verdict, enrichedVerdictNote, execution, journal, cross, edge, level } = analysis;
  const MONEY = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const recs = buildRecommendations(result, edge, verdict);

  // ── Paywall: activates only when NEXT_PUBLIC_STRIPE_PAYMENT_LINK is set ──
  const PAYWALL_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '';
  const paywallOn = PAYWALL_LINK.length > 0;
  const [unlocked, setUnlocked] = useState(!paywallOn);
  useEffect(() => {
    if (!paywallOn) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const cleanUrl = () => {
        const q = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (q ? '?' + q : ''));
      };
      // Post-payment return: verify the Checkout session with Stripe, server-side
      const sid = params.get('session_id');
      if (sid) {
        params.delete('session_id'); cleanUrl();
        fetch(`/api/verify?session_id=${encodeURIComponent(sid)}`)
          .then(r => r.json())
          .then(d => { if (d?.ok) { localStorage.setItem('simphase_pro', '1'); setUnlocked(true); } })
          .catch(() => {});
      }
      // Legacy redirect param (kept for older Payment Link configs)
      if (params.get('unlocked') === 'sp19') {
        localStorage.setItem('simphase_pro', '1');
        params.delete('unlocked'); cleanUrl();
      }
      if (localStorage.getItem('simphase_pro') === '1') setUnlocked(true);
    } catch {}
  }, [paywallOn]);

  return (
    <section className="pb-16 space-y-5">
      <div className="flex gap-2 flex-wrap">
        <span className={`px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider border ${level==='manual'?'confidence-low':level==='balance_csv'?'confidence-medium':'confidence-high'}`}>
          {level==='manual'?'Standard analysis':level==='balance_csv'?'Enriched analysis (balance CSV)':'Deep analysis (balance + journal)'}
        </span>
      </div>

      <section className="sp-panel overflow-hidden">
        <div className="p-7 md:p-8 border-b border-[var(--border)]">
          <div className="flex flex-wrap gap-2.5 items-center mb-4">
            <span className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider border v-${verdict.label.toLowerCase()}`}>{verdict.label}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${display.confidence.cls}`}>{display.confidence.label} confidence</span>
          </div>
          <h4 className="text-2xl md:text-3xl font-extrabold leading-tight max-w-[760px]" style={{letterSpacing:'-0.04em'}}>
            {result.challenge.longName}{unlocked ? ` - recommended risk ${rf(result.recRisk)}, band ${rf(result.robustLow)}-${rf(result.robustHigh)}` : ' - your verdict is ready'}
          </h4>
          <p className="text-[var(--text-2)] text-base leading-relaxed mt-3 max-w-[760px]">{enrichedVerdictNote}</p>
          <p className="text-[var(--text-3)] text-[0.8rem] mt-2 max-w-[760px]">Based on {result.rec.simRuns.toLocaleString()} simulated attempts of {result.challenge.longName} under its exact rule mechanics · Rules verified {result.challenge.rulesVerified}</p>
          <div className="metric-grid grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Metric label="Recommended base risk" value={unlocked ? rf(result.recRisk) : '· · ·'} sub={unlocked ? 'Single primary recommendation' : 'Unlocks with the full plan'} />
            <Metric label="Robust risk band" value={unlocked ? `${rf(result.robustLow)}-${rf(result.robustHigh)}` : '· · ·'} sub={unlocked ? 'Zone that holds under stress' : 'Unlocks with the full plan'} />
            <Metric label="Pass outlook" value={display.passMidpointLabel} sub={`Range ${display.passBand}`} />
            <Metric label="Main failure mode" value={result.rec.failureMode} sub={result.rec.failureModeShare > 0.05 ? `${Math.round(result.rec.failureModeShare*100)}% of simulated failures` : 'Most likely to kill the attempt'} small />
          </div>
        </div>
        <div className="p-7 grid grid-cols-2 md:grid-cols-5 gap-5" style={{background:'rgba(255,255,255,0.02)'}}>
          <SideStat label="Trading days" value={display.dayBand} /><SideStat label="Spend to pass" value={display.spendBand} /><SideStat label="Expected attempts" value={display.attemptBand} /><SideStat label="Confidence" value={display.confidence.label} sub={display.confidence.note} /><SideStat label="Economics" value={economicsPosture(result)} />
        </div>
      </section>

      {/* WHY CONSERVATIVE */}
      <section className="sp-surface p-5" style={{borderLeftWidth:'3px', borderLeftColor:'var(--accent-2)'}}>
        <h4 className="text-sm font-bold mb-2">Why this might feel conservative</h4>
        <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0">Every number above comes from Monte Carlo simulation: thousands of full challenge attempts, trade by trade, under this challenge's exact rules. The simulation also accounts for what backtests hide — your sample only pins your real win rate within a confidence interval, losses slip past their planned size, and discipline degrades after red days. A strategy that survives all of that has earned the verdict.</p>
      </section>

      {recs.length > 0 && <section className="sp-panel p-7"><h3 className="text-base font-bold mb-1">What SimPhase recommends</h3><p className="text-[var(--text-2)] text-sm mb-5">Personalized analysis based on your current edge profile.</p><div className="space-y-3">{recs.map((rec,i) => <SuggestionCard key={i} sug={rec} />)}</div></section>}

      {execution && <ExecutionReality ex={execution} />}
      {journal?.usable && <JournalSection j={journal} />}
      {cross && <CrossSection c={cross} />}

      {unlocked ? (<>
      <section className="sp-panel p-7">
        <h3 className="text-base font-bold mb-5">Execution variants</h3>
        <div className="plan-grid grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[{k:'safe',t:'Lower-risk',tag:'Safer',risk:result.safeRisk,d:result.safe,p:false},{k:'rec',t:'Recommended',tag:'Primary',risk:result.recRisk,d:result.rec,p:true},{k:'fast',t:'Higher-risk',tag:'Faster',risk:result.fastRisk,d:result.fast,p:false}].map(plan=>
            <div key={plan.k} className={`plan-card ${plan.p?'primary':''}`}>
              <div className="flex justify-between items-center mb-3"><strong className="text-sm">{plan.t}</strong><span className="px-2 py-1 rounded-full text-[0.68rem] font-extrabold uppercase tracking-wider border border-[var(--border)]">{plan.tag}</span></div>
              <div className="text-2xl font-extrabold" style={{letterSpacing:'-0.05em'}}>{rf(plan.risk)}</div>
              <div className="mt-4 space-y-2.5"><PlanRow l="Pass" v={`${Math.round(plan.d.passProbability*100)}%`}/><PlanRow l="Spend" v={MONEY.format(plan.d.grossSpend)}/><PlanRow l="Days" v={`${Math.round(plan.d.typicalDays)}d`}/><PlanRow l="Friction" v={plan.d.failureMode}/></div>
            </div>)}
        </div>
      </section>

      <section className="sp-panel p-7"><h3 className="text-base font-bold mb-4">Execution plan</h3><div className="space-y-3">
        <div className="sp-notice"><strong>Base rule:</strong> Start at {rf(result.recRisk)} and stay there until two profitable sessions are completed cleanly.</div>
        <div className="sp-notice"><strong>Kill-switch:</strong> Stop after two full-risk losses or any session reaching about 65% of the daily loss budget.</div>
        <div className="sp-notice"><strong>Primary focus:</strong> {result.rec.failureMode.includes('Daily loss')?'Prevent one sloppy session from invalidating the edge.':result.rec.failureMode.includes('Consistency')?'Do not compress the attempt into one strong day.':'Staying alive inside the rules is the priority.'}</div>
      </div></section>

      <section className="sp-panel p-7"><h3 className="text-base font-bold mb-5">Best same-size alternatives</h3><div className="space-y-3">{alternatives.map(alt=>{const v=verdictFor(alt);const cur=alt.challenge.id===result.challenge.id;return(
        <div key={alt.challenge.id} className={`compare-card ${cur?'active':''}`}><div><strong className="text-sm block">{alt.challenge.longName}{cur?' (current)':''}</strong><span className="text-[var(--text-2)] text-xs">{alt.challenge.ruleLabel}</span></div>
        <CompareCol l="Pass" v={`${Math.round(alt.rec.passProbability*100)}%`} s={`Risk ${rf(alt.recRisk)}`}/><CompareCol l="Spend" v={MONEY.format(alt.rec.grossSpend)} s={`${alt.rec.expectedAttempts.toFixed(1)} att.`}/><CompareCol l="Days" v={`${Math.round(alt.rec.typicalDays)}d`} s={v.label}/><CompareCol l="Eco" v={economicsPosture(alt)} s={alt.challenge.firm==='topstep'?'Act. incl.':'Fee burn'}/></div>);})}</div></section>

      <section className="sp-panel p-7"><h3 className="text-base font-bold mb-4">Export your report</h3><CopySummary result={result} display={display} verdict={verdict} alternatives={alternatives}/><div className="mt-3"><PdfButton result={result} verdict={verdict} display={display} edge={edge} recs={recs}/></div></section>
      </>) : <PaywallCard link={PAYWALL_LINK} feeAnchor={result.fee + result.activationFee} verdictLabel={verdict.label} onUnlock={()=>setUnlocked(true)} />}
    </section>
  );
}


function ExecutionReality({ ex }: { ex: any }) {
  const m = ex.metrics;
  const MONEY = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const rc:any = {strong:'var(--green)',ok:'var(--accent-2)',warn:'var(--amber)',bad:'var(--red)'};
  const rb:any = {strong:'rgba(34,197,94,0.12)',ok:'rgba(22,192,216,0.12)',warn:'rgba(245,158,11,0.12)',bad:'rgba(239,68,68,0.12)'};
  return (
    <section className="sp-panel overflow-hidden">
      <div className="p-7 border-b border-[var(--border)]"><div className="flex flex-wrap gap-2.5 items-center mb-3"><h3 className="text-base font-bold m-0">Execution Reality</h3><span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${ex.confidence==='High'?'confidence-high':ex.confidence==='Medium'?'confidence-medium':'confidence-low'}`}>{ex.confidence} confidence</span></div><p className="text-[var(--text-2)] text-sm leading-relaxed m-0 max-w-[700px]">How your edge actually expresses itself under real execution.</p></div>
      <div className="px-7 pt-5"><div className="sp-surface p-5" style={{borderLeftWidth:'3px',borderLeftColor:rc[ex.executionRead.style]||'var(--text-3)',background:rb[ex.executionRead.style]||'rgba(255,255,255,0.03)'}}><div className="text-[var(--text-3)] text-[0.7rem] uppercase tracking-wider font-bold mb-1">Execution read</div><div className="text-base font-extrabold">{ex.executionRead.label}</div></div></div>
      <div className="px-7 pt-5"><div className="metric-grid grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="sp-metric"><div className="sp-metric-label">Realized RR</div><div className="sp-metric-value">{m.realizedRR.toFixed(2)}x</div><div className="sp-metric-sub">{ex.rrGap!=null&&ex.rrGap>0.2?`${((ex.rrGap/(ex.intendedRR||2))*100).toFixed(0)}% below target`:'Avg winner / avg loser'}</div></div>
        <div className="sp-metric"><div className="sp-metric-label">Real win rate</div><div className="sp-metric-value">{(m.winRate*100).toFixed(1)}%</div><div className="sp-metric-sub">{m.winCount}W / {m.lossCount}L</div></div>
        <div className="sp-metric"><div className="sp-metric-label">Average winner</div><div className="sp-metric-value">{MONEY.format(m.avgWin)}</div><div className="sp-metric-sub">Median: {MONEY.format(m.medianWin)}</div></div>
        <div className="sp-metric"><div className="sp-metric-label">Average loser</div><div className="sp-metric-value">{MONEY.format(m.avgLoss)}</div><div className="sp-metric-sub">Median: {MONEY.format(m.medianLoss)}</div></div>
      </div></div>
      <div className="px-7 pt-4"><div className="grid grid-cols-2 md:grid-cols-5 gap-3"><MiniM l="Expectancy R" v={m.expectancyR.toFixed(3)}/><MiniM l="Profit factor" v={m.profitFactor.toFixed(2)}/><MiniM l="Total PnL" v={MONEY.format(m.totalPnl)}/><MiniM l="Max loss streak" v={String(m.maxLossStreak)}/><MiniM l="Outlier dep." v={m.outlierDependency}/></div></div>
      {ex.rrGap!=null&&ex.rrGap>0.2&&<div className="px-7 pt-5"><div className="sp-surface p-5"><div className="text-sm font-bold mb-2">You target {(ex.intendedRR||2).toFixed(1)}R, but your realized RR is {m.realizedRR.toFixed(2)}</div><p className="text-[var(--text-2)] text-sm leading-relaxed m-0">This usually means winners are being partially secured or closed before the full target. The gap does not mean the strategy is broken.</p></div></div>}
      {ex.suggestions.length>0&&<div className="px-7 pt-5 pb-7"><h4 className="text-sm font-bold mb-3">What your real execution says</h4><div className="space-y-2.5">{ex.suggestions.map((s:any,i:number)=><SuggestionCard key={i} sug={s} small/>)}</div><div className="mt-4 p-3.5 rounded-xl text-xs text-[var(--text-3)] leading-relaxed" style={{background:'rgba(255,255,255,0.02)',border:'1px solid var(--border)'}}>This is an execution analysis, not investment advice. It highlights patterns visible in your historical data and suggests possible areas to review.</div></div>}
    </section>
  );
}

function JournalSection({ j }: { j: any }) {
  return (<section className="sp-panel p-7"><div className="flex flex-wrap gap-2.5 items-center mb-3"><h3 className="text-base font-bold m-0">Journal-Based Execution Read</h3><span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${j.confidenceLevel==='High'?'confidence-high':j.confidenceLevel==='Medium'?'confidence-medium':'confidence-low'}`}>{j.confidenceLevel} confidence</span></div><p className="text-[var(--text-2)] text-sm mb-5">{j.confidenceNote}</p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><MiniM l="Journal trades" v={String(j.tradeCount)}/>{j.avgPlannedR!=null&&<MiniM l="Avg planned R" v={j.avgPlannedR.toFixed(2)}/>}{j.avgRealizedR!=null&&<MiniM l="Avg realized R" v={j.avgRealizedR.toFixed(2)}/>}{j.plannedVsRealizedGap!=null&&<MiniM l="R gap" v={j.plannedVsRealizedGap.toFixed(2)}/>}{j.partialRate!=null&&<MiniM l="Partial exit rate" v={`${(j.partialRate*100).toFixed(0)}%`}/>}<MiniM l="Post-loss behavior" v={j.postLossBehavior}/><MiniM l="Has notes" v={j.hasNotes?'Yes':'No'}/><MiniM l="Has stop/target" v={j.hasStopTarget?'Yes':'No'}/></div>
    {j.suggestions.length>0&&<div className="space-y-2.5">{j.suggestions.map((s:any,i:number)=><SuggestionCard key={i} sug={s} small/>)}</div>}
  </section>);
}

function CrossSection({ c }: { c: any }) {
  const sl:any = { clean_controlled:'Clean and controlled', viable_compressed:'Viable but compressed', irregular:'Irregular', fragile_under_constraint:'Fragile under constraint' };
  return (<section className="sp-panel p-7"><h3 className="text-base font-bold mb-3">Combined Execution Diagnosis</h3>
    <div className="sp-surface p-5 mb-5" style={{borderLeftWidth:'3px',borderLeftColor:'var(--accent-2)'}}><div className="text-[var(--text-3)] text-[0.7rem] uppercase tracking-wider font-bold mb-1">Execution style</div><div className="text-base font-extrabold mb-2">{sl[c.executionStyle]||c.executionStyle}</div><p className="text-[var(--text-2)] text-sm leading-relaxed m-0">{c.behaviorRead}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5"><div className="sp-surface p-4"><div className="text-[var(--text-3)] text-[0.7rem] uppercase tracking-wider font-bold mb-1">Main strength</div><p className="text-sm m-0">{c.mainStrength}</p></div><div className="sp-surface p-4"><div className="text-[var(--text-3)] text-[0.7rem] uppercase tracking-wider font-bold mb-1">Main improvement</div><p className="text-sm m-0">{c.mainImprovement}</p></div></div>
    {c.suggestions.length>0&&<div className="space-y-2.5">{c.suggestions.map((s:any,i:number)=><SuggestionCard key={i} sug={s} small/>)}</div>}
  </section>);
}


function SuggestionCard({ sug, small }: { sug: any; small?: boolean }) {
  const colors:any = { observation:'var(--accent-2)', positive:'var(--green)', improvement:'var(--amber)', bottleneck:'var(--red)' };
  const bgs:any = { observation:'rgba(22,192,216,0.15)', positive:'rgba(34,197,94,0.15)', improvement:'rgba(245,158,11,0.15)', bottleneck:'rgba(239,68,68,0.15)' };
  const icons:any = { observation:'*', positive:'OK', improvement:'!', bottleneck:'!!' };
  const txtC:any = { observation:'#9ff6eb', positive:'#b8f6cf', improvement:'#fcd08a', bottleneck:'#fdadad' };
  return (<div className="sp-surface p-4 flex gap-3 items-start" style={{borderLeftWidth:'3px',borderLeftColor:colors[sug.type]||'var(--text-3)'}}>
    <div className={`shrink-0 ${small?'w-6 h-6':'w-7 h-7'} rounded-lg grid place-items-center text-[0.6rem] font-extrabold`} style={{background:bgs[sug.type],color:txtC[sug.type]}}>{icons[sug.type]||'-'}</div>
    <div><strong className={`block ${small?'text-[0.82rem]':'text-sm'} mb-0.5`}>{sug.title}</strong><p className={`text-[var(--text-2)] ${small?'text-[0.82rem]':'text-sm'} leading-relaxed m-0`}>{sug.message}</p></div>
  </div>);
}

function Metric({label,value,sub,small}:{label:string;value:string;sub:string;small?:boolean}) { return <div className="sp-metric"><div className="sp-metric-label">{label}</div><div className={small?'sp-metric-value-sm':'sp-metric-value'}>{value}</div><div className="sp-metric-sub">{sub}</div></div>; }
function SideStat({label,value,sub}:{label:string;value:string;sub?:string}) { return <div><div className="text-[var(--text-3)] text-[0.72rem] uppercase tracking-wider font-bold">{label}</div><div className="text-sm font-bold mt-1.5">{value}</div>{sub&&<div className="text-[var(--text-2)] text-xs mt-1 leading-relaxed">{sub}</div>}</div>; }
function PlanRow({l,v}:{l:string;v:string}) { return <div className="flex justify-between gap-3 text-sm"><span className="text-[var(--text-2)]">{l}</span><span className="font-bold text-right">{v}</span></div>; }
function CompareCol({l,v,s}:{l:string;v:string;s:string}) { return <div><div className="text-[var(--text-3)] text-[0.7rem] uppercase tracking-wider font-bold">{l}</div><div className="text-base font-extrabold mt-1">{v}</div><div className="text-[var(--text-2)] text-xs mt-0.5">{s}</div></div>; }
function MiniM({l,v}:{l:string;v:string}) { return <div className="sp-surface p-3"><div className="text-[var(--text-3)] text-[0.65rem] uppercase tracking-wider font-bold">{l}</div><div className="text-sm font-extrabold mt-1">{v}</div></div>; }


function PaywallCard({ link, feeAnchor, verdictLabel, onUnlock }: { link: string; feeAnchor: number; verdictLabel: string; onUnlock: () => void }) {
  const MONEY = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const [showRestore, setShowRestore] = useState(false);
  const [email, setEmail] = useState('');
  const [restoreState, setRestoreState] = useState<'idle'|'loading'|'fail'>('idle');
  const urgency = verdictLabel === 'Fragile' || verdictLabel === 'Borderline'
    ? 'Your edge needs every advantage it can get before you pay another fee.'
    : 'Your edge can pass this - if the execution does not leak it away.';
  const restore = async () => {
    setRestoreState('loading');
    try {
      const r = await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const d = await r.json();
      if (d?.ok) { try { localStorage.setItem('simphase_pro', '1'); } catch {} onUnlock(); return; }
    } catch {}
    setRestoreState('fail');
  };
  return (
    <section className="sp-panel p-7 md:p-8 text-center" style={{border:'1px solid rgba(124,92,255,0.35)', background:'linear-gradient(180deg, rgba(124,92,255,0.10), rgba(255,255,255,0.02))'}}>
      <span className="inline-block px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider border border-[rgba(124,92,255,0.4)] mb-4" style={{background:'rgba(124,92,255,0.15)', color:'#d8ccff'}}>Full Challenge Plan</span>
      <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-2">The verdict is free. The plan that gets you through is $19.</h3>
      <p className="text-[var(--text-2)] text-sm leading-relaxed max-w-[540px] mx-auto mb-5">A failed attempt at this challenge costs you {feeAnchor ? MONEY.format(feeAnchor) : 'the full fee'} and weeks of work. {urgency} One-time payment - unlocks every plan, every firm. Your purchase email is your key on any device.</p>
      <div className="max-w-[440px] mx-auto text-left space-y-2 mb-6">
        {['Exact recommended risk % and the robust band that survives stress',
          'Three execution variants: safer / recommended / aggressive',
          'Day-one execution plan with kill-switch rules',
          'All same-size alternatives ranked for your edge',
          'Printable report you can keep on your trading desk'].map((t,i)=>(
          <div key={i} className="flex gap-2.5 items-start text-sm text-[var(--text-2)]"><span style={{color:'var(--green)'}}>OK</span><span>{t}</span></div>
        ))}
      </div>
      <a href={link} target="_blank" rel="noopener noreferrer" className="sp-btn sp-btn-primary" style={{fontSize:'1rem', padding:'14px 28px'}}>Unlock the full plan - $19 one-time</a>
      <p className="text-[var(--text-3)] text-xs mt-3">Secure payment via Stripe - Instant access - No subscription</p>
      <div className="mt-5">
        {!showRestore ? (
          <button onClick={()=>setShowRestore(true)} className="text-sm font-semibold underline underline-offset-2 cursor-pointer bg-transparent border-none" style={{color:'var(--text-2)'}}>Already paid? Restore your access</button>
        ) : (
          <div className="max-w-[380px] mx-auto">
            <p className="text-[var(--text-2)] text-xs mb-2">Enter the email you used at checkout:</p>
            <div className="flex gap-2">
              <input type="email" inputMode="email" value={email} onChange={e=>{setEmail(e.target.value); if(restoreState==='fail') setRestoreState('idle');}} placeholder="you@email.com" className="sp-input flex-1" />
              <button onClick={restore} disabled={restoreState==='loading' || !email.includes('@')} className="sp-btn sp-btn-secondary shrink-0 disabled:opacity-60">{restoreState==='loading' ? 'Checking...' : 'Restore'}</button>
            </div>
            {restoreState==='fail' && <p className="text-xs mt-2 m-0" style={{color:'#fdadad'}}>No purchase found for this email. Use the exact email from your Stripe receipt, or buy access above.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function CopySummary({result,display,verdict,alternatives}:any) {
  const [copied,setCopied] = useState(false);
  const text = [`${result.challenge.longName} - ${verdict.label}`,`Recommended: ${rf(result.recRisk)} | Band: ${rf(result.robustLow)}-${rf(result.robustHigh)}`,`Pass outlook: ${display.passBand} | Confidence: ${display.confidence.label}`,`Days: ${display.dayBand} | Spend: ${display.spendBand}`,`Best fit: ${alternatives[0].challenge.longName}`].join('\n');
  return <div><textarea readOnly value={text} className="sp-input font-mono text-sm leading-relaxed" style={{minHeight:'120px',resize:'vertical'}}/><button onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{}}} className="sp-btn sp-btn-secondary mt-3">{copied?'Copied!':'Copy summary'}</button></div>;
}

function PdfButton({result,verdict,display,edge,recs}:any) {
  const openReport = () => {
    const esc = (s:any)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>SimPhase - Challenge Plan</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;line-height:1.5}
      h1{font-size:22px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:16px}
      .badge{display:inline-block;border:1.5px solid #111;border-radius:999px;padding:3px 12px;font-weight:700;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0 16px}td,th{border:1px solid #ccc;padding:7px 9px;font-size:13px;text-align:left}th{background:#f3f3f3}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px}
      .rec{margin:6px 0;font-size:13px}.foot{margin-top:24px;color:#888;font-size:11px;border-top:1px solid #ddd;padding-top:8px}
    </style></head><body>
      <h1>SimPhase - Challenge Plan</h1>
      <div class="sub">${esc(result.challenge.longName)} - $${result.size.toLocaleString()} - Generated ${new Date().toLocaleDateString()} - Rules verified ${esc(result.challenge.rulesVerified)}</div>
      <div class="badge">Verdict: ${esc(verdict.label)}</div>
      <table><tr><th>Recommended risk</th><th>Robust band</th><th>Pass outlook</th><th>Main failure mode</th></tr>
      <tr><td>${rf(result.recRisk)}</td><td>${rf(result.robustLow)} - ${rf(result.robustHigh)}</td><td>${esc(display.passMidpointLabel)} (${esc(display.passBand)})</td><td>${esc(result.rec.failureMode)}</td></tr></table>
      <table><tr><th>Trading days</th><th>Expected attempts</th><th>Spend to pass</th><th>Based on</th></tr>
      <tr><td>${esc(display.dayBand)}</td><td>${esc(display.attemptBand)}</td><td>${esc(display.spendBand)}</td><td>${result.rec.simRuns.toLocaleString()} simulated attempts</td></tr></table>
      <h2>Execution plan</h2>
      <div class="rec"><b>Base rule:</b> Start at ${rf(result.recRisk)} and stay there until two profitable sessions are completed cleanly.</div>
      <div class="rec"><b>Kill-switch:</b> Stop after two full-risk losses or any session reaching ~65% of the daily loss budget.</div>
      ${recs.map((r:any)=>`<div class="rec"><b>${esc(r.title)}:</b> ${esc(r.message)}</div>`).join('')}
      <div class="foot">Generated by SimPhase - Monte Carlo simulation under exact prop firm rules. Estimates, not guarantees.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to print the report.'); return; }
    w.document.write(html); w.document.close();
  };
  return <button onClick={openReport} className="sp-btn sp-btn-primary inline-flex items-center gap-2">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    <span>Print / Save as PDF</span>
  </button>;
}

function HowToExport() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={()=>setOpen(!open)} className="text-sm font-bold cursor-pointer bg-transparent border-none flex items-center gap-2 hover:opacity-80 transition-opacity" style={{color:'var(--accent)'}}>
        <span style={{transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.2s', display:'inline-block'}}>&#9654;</span>
        {open ? 'Hide export guide' : 'How to export your CSV from TradingView'}
      </button>
      {open && (
        <div className="mt-3 sp-surface p-5 space-y-4">
          <div className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-lg grid place-items-center text-xs font-extrabold" style={{background:'rgba(124,92,255,0.15)', color:'#d8ccff'}}>1</span>
            <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0">Open the <strong style={{color:'var(--text)'}}>Paper Trading</strong> panel at the bottom of TradingView. Click the dropdown arrow next to "Paper Trading" and select <strong style={{color:'var(--text)'}}>Export data...</strong></p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-lg grid place-items-center text-xs font-extrabold" style={{background:'rgba(124,92,255,0.15)', color:'#d8ccff'}}>2</span>
            <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0">In the export popup, select <strong style={{color:'#b8f6cf'}}>Balance History</strong> for SimPhase zone A, or <strong style={{color:'#b8f6cf'}}>Trading Journal</strong> for zone B.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-lg grid place-items-center text-xs font-extrabold" style={{background:'rgba(124,92,255,0.15)', color:'#d8ccff'}}>3</span>
            <p className="text-[var(--text-2)] text-[0.84rem] leading-relaxed m-0">Click export. The CSV file downloads to your computer. Upload it here.</p>
          </div>
          <p className="text-[var(--text-3)] text-xs m-0 leading-relaxed">Works with TradingView Paper Trading. Other platforms with similar CSV exports are also supported.</p>
        </div>
      )}
    </div>
  );
}
