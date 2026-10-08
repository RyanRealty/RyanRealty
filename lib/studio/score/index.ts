/**
 * lib/studio/score — a code-composed soundtrack for Studio films.
 *
 * Pure TypeScript: no Web Audio, no native code, no dependencies, runs in Node
 * on Vercel. Deterministic: the same input is the same WAV, byte for byte.
 * Importable straight from a test (no 'server-only').
 */
export { composeScore, renderScoreStems, weightDb, type ScoreStems } from './compose'
export { integratedLoudness, truePeakDb } from './loudness'
export { planScore, type ScorePlan, type PlannedSection, type PlannedEvent, type PulseNote } from './plan'
export { encodeWav } from './wav'
export {
  SAMPLE_RATE,
  type ScoreEvent,
  type ScoreInput,
  type ScoreMood,
  type ScoreReport,
  type ScoreResult,
  type ScoreSection,
} from './types'
