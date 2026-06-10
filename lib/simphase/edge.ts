// ═══════════════════════════════════════════════════════════
// SimPhase — Edge Derivation
// Converts raw user inputs (manual or CSV) into Edge objects.
// ═══════════════════════════════════════════════════════════

import type { Edge } from './types';
import { clamp } from './engine';

// ── Manual edge ─────────────────────────────────────────────

export function deriveManualEdge(inputs: {
  winRate: number;
  payoffRatio: number;
  tradeFrequency: number;
  frequencyUnit: 'day' | 'week';
  maxLossStreak: number;
  sampleTrades: number;
  market: string;
}): Edge {
  const winRate = clamp(inputs.winRate / 100, 0.05, 0.95);
  const payoffRatio = clamp(inputs.payoffRatio, 0.2, 10);
  const frequencyValue = clamp(inputs.tradeFrequency, 0.2, 50);
  const tradesPerDay = clamp(
    inputs.frequencyUnit === 'week' ? frequencyValue / 5 : frequencyValue,
    0.08, 20,
  );
  const maxConsecLosses = clamp(inputs.maxLossStreak, 2, 20);
  const sampleTrades = clamp(inputs.sampleTrades, 10, 5000);
  const expectancyR = winRate * payoffRatio - (1 - winRate);
  const profitFactor = (winRate * payoffRatio) / Math.max((1 - winRate), 0.01);
  const confidencePenalty = sampleTrades < 50 ? 0.10 : sampleTrades < 100 ? 0.05 : sampleTrades < 200 ? 0.02 : 0;

  return {
    source: 'manual',
    inputModel: 'manual_assumptions',
    winRate,
    avgWinR: payoffRatio,
    avgLossR: 1,
    payoffRatio,
    tradesPerDay,
    frequencyValue,
    frequencyUnit: inputs.frequencyUnit,
    maxConsecLosses,
    sampleTrades,
    expectancyR,
    profitFactor,
    observedVol: clamp(
      0.88 + Math.max(0, maxConsecLosses - 4) * 0.09 + Math.max(0, 100 - sampleTrades) / 300,
      0.65, 2.2,
    ),
    confidencePenalty,
  };
}

// ── CSV parsing ─────────────────────────────────────────────

export function parseCsvText(text: string): Edge | null {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return null;

  const allLines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (allLines.length < 3) return null;

  function detectDelimiter(lines: string[]): string {
    const candidates = [',', ';', '\t', '|'];
    let best = ',', bestScore = -1;
    for (const d of candidates) {
      let score = 0;
      for (const line of lines.slice(0, 8)) {
        let inQuotes = false, count = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === d && !inQuotes) count++;
        }
        score += count;
      }
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function splitDelimited(line: string, delimiter: string): string[] {
    const out: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i], next = line[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') { cur += '"'; i += 1; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function normalizeHeader(value: string): string {
    return String(value || '').toLowerCase().replace(/[\u00a0\s]+/g, ' ').replace(/[%()]/g, '').trim();
  }

  function parseNumeric(value: string | undefined): number {
    if (value == null) return NaN;
    let s = String(value).trim();
    if (!s) return NaN;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/[\u00a0\s]/g, '').replace(/[€$£¥₽₹]/g, '').replace(/%/g, '');
    s = s.replace(/realized|profit|loss|pnl|p&l/ig, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('-')) { negative = true; s = s.slice(1); }
    if (!/[\d]/.test(s)) return NaN;
    const hasDot = s.includes('.'), hasComma = s.includes(',');
    if (hasDot && hasComma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma && !hasDot) {
      const parts = s.split(',');
      if (parts.length === 2 && parts[parts.length - 1].length <= 2) s = parts[0] + '.' + parts[1];
      else s = parts.join('');
    }
    s = s.replace(/[^0-9.]/g, '');
    if (!s) return NaN;
    const n = Number(s);
    return Number.isNaN(n) ? NaN : (negative ? -n : n);
  }

  function parseDateKey(value: string | undefined): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
    const m = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    return null;
  }

  const delimiter = detectDelimiter(allLines);
  const rows = allLines.map(line => splitDelimited(line, delimiter));
  if (rows.length < 3) return null;

  const headerAliases = [
    /^pnl$/, /^p&l$/, /^net pnl$/, /^realized p&l$/, /^realized pnl$/,
    /^realized p&l value$/, /^realized pnl value$/, /^closed pnl$/,
    /^profit$/, /^net profit$/, /^gain\/loss$/, /^gain loss$/,
    /^return_pct$/, /^return %$/, /^return$/, /^r_multiple$/, /^r multiple$/, /^r$/, /^pl$/,
  ];
  const headerRow = rows[0].map(normalizeHeader);

  function classifyFileType(headers: string[]): string {
    const set = new Set(headers);
    if (set.has('realized p&l value') || set.has('realized pnl value') || set.has('realized p&l') || set.has('realized pnl')) return 'Balance History';
    if (set.has('text') && set.has('time')) return 'Trading Journal';
    if (set.has('symbol') && set.has('side') && (set.has('fill price') || set.has('price'))) return 'Order History';
    return 'Generic CSV';
  }
  const fileType = classifyFileType(headerRow);
  let columnIndex = headerRow.findIndex(h => headerAliases.some(rx => rx.test(h)));
  let startRow = 1;

  if (columnIndex < 0) {
    const firstRowNumericCount = rows[0].filter(cell => !Number.isNaN(parseNumeric(cell))).length;
    if (firstRowNumericCount >= 1) startRow = 0;
    const maxCols = Math.max(...rows.map(r => r.length));
    let bestIdx = -1, bestScore = -1;
    for (let col = 0; col < maxCols; col++) {
      const header = headerRow[col] || '';
      if (/^(time|date|timestamp|balance before|balance after|balance|currency|action|symbol|side|price|qty|quantity)$/i.test(header)) continue;
      let score = 0, pos = 0, neg = 0;
      for (let i = startRow; i < Math.min(rows.length, startRow + 120); i++) {
        const parsed = parseNumeric(rows[i][col]);
        if (!Number.isNaN(parsed)) { score += 1; if (parsed > 0) pos += 1; if (parsed < 0) neg += 1; }
      }
      if (/realized|p&l|pnl|profit|return|r multiple|^r$/.test(header)) score += 28;
      if (pos > 0 && neg > 0) score += 14;
      if (pos === 0 || neg === 0) score -= 10;
      if (score > bestScore) { bestScore = score; bestIdx = col; }
    }
    columnIndex = bestIdx;
  }

  if (columnIndex == null || columnIndex < 0) return null;

  let dateColumnIndex = headerRow.findIndex(h => /^(time|date|timestamp|open time|close time|closed at|opened at)$/i.test(h));
  if (dateColumnIndex < 0) dateColumnIndex = headerRow.findIndex(h => /time|date|timestamp/i.test(h));

  const values: number[] = [];
  const activeDays = new Set<string>();
  for (let i = startRow; i < rows.length; i++) {
    const parsed = parseNumeric(rows[i][columnIndex]);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      values.push(parsed);
      if (dateColumnIndex >= 0) {
        const key = parseDateKey(rows[i][dateColumnIndex]);
        if (key) activeDays.add(key);
      }
    }
  }

  if (values.length < 8) return null;

  const wins = values.filter(v => v > 0);
  const losses = values.filter(v => v < 0).map(v => Math.abs(v));
  const meanWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 1;
  const meanLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 1;
  // Normalize by the average loss so expectancy is in R-multiples (1R = avg loss),
  // matching the manual mode where expectancyR = WR×RR − (1−WR).
  const rUnit = losses.length ? meanLoss : (values.reduce((a, b) => a + Math.abs(b), 0) / values.length || 1);
  const normalized = values.map(v => v / Math.max(rUnit, 1e-9));
  const expectancyR = normalized.reduce((a, b) => a + b, 0) / normalized.length;
  let current = 0, maxLossStreak = 0;
  for (const v of values) {
    if (v <= 0) { current += 1; maxLossStreak = Math.max(maxLossStreak, current); }
    else current = 0;
  }
  const variance = normalized.reduce((a, b) => a + Math.pow(b - expectancyR, 2), 0) / normalized.length;
  const rawHeader = (rows[0][columnIndex] || '').trim() || `Column ${columnIndex + 1}`;
  const recommended = fileType === 'Balance History' || fileType === 'Generic CSV';
  const inferredActiveDays = activeDays.size || Math.max(5, Math.ceil(values.length / 2.2));

  // Use calendar span if we have dates (more accurate for infrequent traders)
  let tradesPerDay: number;
  if (activeDays.size >= 3) {
    const sortedDays = [...activeDays].sort();
    const firstDate = new Date(sortedDays[0]);
    const lastDate = new Date(sortedDays[sortedDays.length - 1]);
    const calendarDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const calendarTradingDays = calendarDays * (5 / 7); // approximate trading days
    tradesPerDay = clamp(values.length / Math.max(calendarTradingDays, 1), 0.08, 20);
  } else {
    tradesPerDay = clamp(values.length / inferredActiveDays, 0.08, 20);
  }
  const payoffRatio = clamp(meanWin / Math.max(meanLoss, 1e-6), 0.1, 10);

  return {
    source: 'csv',
    inputModel: 'csv_empirical',
    csvMeta: { delimiter, columnIndex, columnName: rawHeader, fileType, recommended, activeDays: inferredActiveDays },
    winRate: clamp(wins.length / values.length, 0.05, 0.95),
    avgWinR: payoffRatio,
    avgLossR: 1,
    payoffRatio,
    tradesPerDay,
    frequencyValue: Math.round(tradesPerDay * 5 * 10) / 10,
    frequencyUnit: 'week',
    maxConsecLosses: clamp(maxLossStreak || 3, 2, 20),
    sampleTrades: values.length,
    expectancyR: clamp(expectancyR, -0.7, 2.5),
    profitFactor: clamp((wins.reduce((a, b) => a + b, 0) || 0.01) / Math.max(losses.reduce((a, b) => a + b, 0), 0.01), 0.3, 6),
    observedVol: clamp(Math.sqrt(variance), 0.55, 2.4),
    confidencePenalty: values.length < 50 ? 0.08 : values.length < 100 ? 0.04 : 0.01,
  };
}
