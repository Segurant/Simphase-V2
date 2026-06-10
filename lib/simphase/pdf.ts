// ═══════════════════════════════════════════════════════════
// SimPhase — PDF Report Generator
// Creates a clean, professional 1-page PDF report
// Uses jsPDF loaded from CDN (no npm dependency needed)
// ═══════════════════════════════════════════════════════════

import type { EvaluationResult, Verdict, DisplayStats, Edge, Recommendation } from './types';

declare const jspdf: any;

let jsPDFLoaded = false;

async function loadJsPDF(): Promise<void> {
  if (jsPDFLoaded) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    script.onload = () => { jsPDFLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}

function rf(n: number): string { return `${n.toFixed(2)}%`; }

export async function generateReport(
  result: EvaluationResult,
  verdict: Verdict,
  display: DisplayStats,
  edge: Edge,
  recommendations: Recommendation[],
): Promise<void> {
  await loadJsPDF();

  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const ML = 16, MR = 16;
  const CW = W - ML - MR; // content width
  let y = 0;

  const COLORS = {
    bg: [11, 16, 32],
    panel: [18, 25, 45],
    accent: [124, 92, 255],
    accent2: [22, 192, 216],
    white: [236, 242, 255],
    text2: [169, 181, 208],
    text3: [119, 130, 155],
    green: [34, 197, 94],
    amber: [245, 158, 11],
    red: [239, 68, 68],
    border: [40, 50, 75],
  };

  const verdictColors: Record<string, number[]> = {
    Strong: COLORS.green, Playable: [20, 184, 166], Borderline: COLORS.amber, Fragile: COLORS.red,
  };

  // ── Background ──
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, W, H, 'F');

  // ── Top accent bar ──
  const grd = doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, W, 3, 'F');

  y = 14;

  // ── Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.white);
  doc.text('SimPhase', ML, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text3);
  doc.text('Challenge Readiness Report', ML + 42, y);

  const dateStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  doc.text(dateStr, W - MR, y, { align: 'right' });
  y += 4;

  // ── Separator ──
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 7;

  // ── Challenge title + verdict ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(`${result.challenge.longName}  ·  $${(result.size/1000).toFixed(0)}k`, ML, y);

  // Verdict badge
  const vColor = verdictColors[verdict.label] || COLORS.text2;
  const vText = verdict.label.toUpperCase();
  const vWidth = doc.getTextWidth(vText) * 0.38 + 10;
  const vX = W - MR - vWidth;
  doc.setFillColor(vColor[0], vColor[1], vColor[2], 0.2);
  doc.roundedRect(vX, y - 5, vWidth, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...vColor);
  doc.text(vText, vX + vWidth / 2, y - 0.8, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text2);
  doc.text(verdict.hint, ML, y);
  y += 8;

  // ── Core metrics panel ──
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(ML, y, CW, 28, 3, 3, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(ML, y, CW, 28, 3, 3, 'S');

  const metricCols = [
    { label: 'RECOMMENDED RISK', value: rf(result.recRisk) },
    { label: 'ROBUST BAND', value: `${rf(result.robustLow)} – ${rf(result.robustHigh)}` },
    { label: 'PASS OUTLOOK', value: display.passBand },
    { label: 'FAILURE MODE', value: result.rec.failureMode },
  ];

  const colW = CW / metricCols.length;
  metricCols.forEach((m, i) => {
    const cx = ML + i * colW + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.text3);
    doc.text(m.label, cx, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(m.value.length > 18 ? 8 : 11);
    doc.setTextColor(...COLORS.white);
    doc.text(m.value, cx, y + 15);
    // separator line
    if (i > 0) {
      doc.setDrawColor(...COLORS.border);
      doc.line(ML + i * colW, y + 4, ML + i * colW, y + 24);
    }
  });
  y += 33;

  // ── Secondary metrics ──
  const MONEY = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const secMetrics = [
    ['Trading days', display.dayBand],
    ['Spend to pass', display.spendBand],
    ['Expected attempts', display.attemptBand],
    ['Confidence', display.confidence.label],
    ['Economics', result.fee ? (result.rec.grossSpend / Math.max(result.fee + result.activationFee, 1) <= 1.7 ? 'Efficient' : result.rec.grossSpend / Math.max(result.fee + result.activationFee, 1) <= 2.4 ? 'Manageable' : 'Expensive') : 'No fee input'],
  ];

  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(ML, y, CW, 12, 3, 3, 'F');
  const secColW = CW / secMetrics.length;
  secMetrics.forEach(([label, value], i) => {
    const cx = ML + i * secColW + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.text3);
    doc.text(label, cx, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(value, cx, y + 9);
  });
  y += 17;

  // ── Execution plans (3 columns) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text('Execution Variants', ML, y);
  y += 5;

  const plans = [
    { title: 'SAFER', risk: result.safeRisk, data: result.safe },
    { title: 'RECOMMENDED', risk: result.recRisk, data: result.rec },
    { title: 'FASTER', risk: result.fastRisk, data: result.fast },
  ];

  const planW = (CW - 6) / 3;
  plans.forEach((plan, i) => {
    const px = ML + i * (planW + 3);
    const isMain = i === 1;
    if (isMain) {
      doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
      doc.roundedRect(px, y, planW, 30, 2, 2, 'F');
      doc.setFillColor(COLORS.panel[0], COLORS.panel[1], COLORS.panel[2]);
      doc.roundedRect(px + 0.5, y + 0.5, planW - 1, 29, 2, 2, 'F');
    } else {
      doc.setFillColor(...COLORS.panel);
      doc.roundedRect(px, y, planW, 30, 2, 2, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.text3);
    doc.text(plan.title, px + 4, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...(isMain ? COLORS.accent : COLORS.white));
    doc.text(rf(plan.risk), px + 4, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.text2);
    doc.text(`Pass: ${Math.round(plan.data.passProbability*100)}%  ·  ${Math.round(plan.data.typicalDays)}d  ·  ${MONEY.format(plan.data.grossSpend)}`, px + 4, y + 19);
    doc.text(`Friction: ${plan.data.failureMode}`, px + 4, y + 24);
  });
  y += 35;

  // ── Edge profile ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text('Edge Profile', ML, y);
  y += 5;

  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(ML, y, CW, 16, 3, 3, 'F');

  const edgeItems = [
    ['Win rate', `${(edge.winRate*100).toFixed(1)}%`],
    ['Payoff ratio', `${edge.payoffRatio.toFixed(2)}x`],
    ['Expectancy R', edge.expectancyR.toFixed(3)],
    ['Profit factor', edge.profitFactor.toFixed(2)],
    ['Max streak', `${edge.maxConsecLosses}`],
    ['Trades/day', edge.tradesPerDay.toFixed(1)],
    ['Sample', `${edge.sampleTrades}`],
    ['Source', edge.inputModel === 'csv_empirical' ? 'CSV' : 'Manual'],
  ];
  const edgeColW = CW / edgeItems.length;
  edgeItems.forEach(([label, value], i) => {
    const cx = ML + i * edgeColW + 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...COLORS.text3);
    doc.text(label, cx, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(value, cx, y + 11);
  });
  y += 21;

  // ── Recommendations ──
  if (recommendations.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text('Recommendations', ML, y);
    y += 5;

    recommendations.forEach((rec) => {
      if (y > 255) return; // don't overflow page
      const icon = rec.type === 'bottleneck' ? '▲' : rec.type === 'positive' ? '●' : '◆';
      const iconColor = rec.type === 'bottleneck' ? COLORS.red : rec.type === 'positive' ? COLORS.green : COLORS.amber;

      doc.setFillColor(...COLORS.panel);
      const textLines = doc.splitTextToSize(rec.message, CW - 14);
      const boxH = 6 + textLines.length * 3.2;
      doc.roundedRect(ML, y, CW, boxH, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...iconColor);
      doc.text(icon, ML + 4, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.white);
      doc.text(rec.title, ML + 9, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...COLORS.text2);
      doc.text(textLines, ML + 9, y + 9);

      y += boxH + 2;
    });
  }

  // ── Execution rules ──
  if (y < 245) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text('Execution Rules', ML, y);
    y += 5;

    doc.setFillColor(...COLORS.panel);
    doc.roundedRect(ML, y, CW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.text2);
    doc.text(`1. Start at ${rf(result.recRisk)} — do not increase until 2 profitable sessions are completed cleanly.`, ML + 4, y + 5);
    doc.text(`2. Stay within the ${rf(result.robustLow)}–${rf(result.robustHigh)} band. Moving outside it invalidates the model.`, ML + 4, y + 10);
    doc.text('3. Stop the day after 2 full-risk losses or any session reaching ~65% of the daily loss budget.', ML + 4, y + 15);
    y += 22;
  }

  // ── Footer ──
  doc.setDrawColor(...COLORS.border);
  doc.line(ML, H - 12, W - MR, H - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.text3);
  doc.text('SimPhase · Challenge Readiness Report · This is a decision-support tool, not a guarantee.', ML, H - 8);
  doc.text(`Generated ${dateStr}`, W - MR, H - 8, { align: 'right' });

  // ── Save ──
  const fileName = `SimPhase-${result.challenge.longName.replace(/\s+/g, '-')}-${(result.size/1000)}k-${dateStr.replace(/[\s,]+/g, '-')}.pdf`;
  doc.save(fileName);
}
