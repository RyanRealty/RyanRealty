/**
 * lib/studio/voice: the female voiceover and the burned-in captions of a Studio film.
 *
 * ElevenLabs v3 with timestamps in; word timings, caption cards and a mixed
 * soundtrack out. Importable straight from a test or a script (no 'server-only').
 * See docs/plans/STUDIO_ONE_FACTORY.md for where each output lands in the manifest.
 */
export {
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_FORMATS,
  ELEVENLABS_BASE_URL,
  ElevenLabsError,
  FALLBACK_MODEL,
  V3_MAX_CHARACTERS,
  VOICE_ENV,
  manifestVoice,
  synthesizeWithTimestamps,
  voiceIdFor,
  type ClientDeps,
  type Synthesis,
  type SynthesizeOptions,
  type VoiceName,
  type VoiceSettings,
} from './elevenlabs'
export { decodeVoiceAudio, parseWav, spawnFfmpeg, type DecodeDeps, type RunFfmpeg } from './decode'
export { alignmentToWords } from './words'
export {
  BRIDGE_GAP_SECONDS,
  CaptionRuleError,
  MAX_CARD_WORDS,
  MIN_CARD_SECONDS,
  PAUSE_BREAK_SECONDS,
  buildCaptions,
  planCaptions,
  validateCaptions,
  type CaptionOptions,
  type CaptionPlan,
} from './captions'
export { CAPTION_STYLE, SAFE_AREA, captionBox, captionCss, styleProblems, type Box, type CaptionStyle } from './captionStyle'
export { duckingCurveDb, mixVoiceOverScore, speechSpans, type MixOptions, type MixReport, type MixResult } from './mix'
export type { CaptionCard, CharacterAlignment, ManifestVoice, SpokenWord, StereoAudio } from './types'
