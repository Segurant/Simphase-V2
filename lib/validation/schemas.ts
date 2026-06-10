// ═══════════════════════════════════════════════════════════
// SimPhase — Input Validation (Zod)
// ═══════════════════════════════════════════════════════════

import { z } from 'zod';

export const ManualEdgeInput = z.object({
  winRate: z.number().min(1).max(99),
  payoffRatio: z.number().min(0.2).max(10),
  tradeFrequency: z.number().min(0.2).max(50),
  frequencyUnit: z.enum(['day', 'week']),
  maxLossStreak: z.number().int().min(2).max(20),
  sampleTrades: z.number().int().min(10).max(5000),
  market: z.enum(['cfd', 'futures', 'indices', 'mixed']),
});

export type ManualEdgeInputType = z.infer<typeof ManualEdgeInput>;

export const ChallengeSelection = z.object({
  firmId: z.string().min(1),
  challengeId: z.string().min(1),
  size: z.number().positive(),
  fee: z.number().min(0).optional(),
});

export type ChallengeSelectionType = z.infer<typeof ChallengeSelection>;

export const AnalysisRequest = z.object({
  challenge: ChallengeSelection,
  edge: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('manual'), inputs: ManualEdgeInput }),
    z.object({ mode: z.literal('csv'), csvText: z.string().min(10) }),
  ]),
  stressMode: z.enum(['calm', 'realistic', 'pressure']).default('realistic'),
});

export type AnalysisRequestType = z.infer<typeof AnalysisRequest>;

export const OutcomeInput = z.object({
  challengeId: z.string(),
  size: z.number().positive(),
  verdict: z.string(),
  confidence: z.string(),
  risk: z.string(),
  outcome: z.enum(['passed', 'failed']),
});

export const JournalInput = z.object({
  challengeId: z.string(),
  size: z.number().positive(),
  inputMode: z.enum(['manual', 'csv']),
  status: z.enum(['planned', 'active', 'passed', 'failed', 'abandoned']),
  note: z.string().max(2000),
});
