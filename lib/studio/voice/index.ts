/**
 * lib/studio/voice: the female voiceover and the burned-in captions of a Studio film.
 *
 * Grok TTS (lib/grok/tts.ts, voice Eve) is the DEFAULT engine (Matt 2026-10-14); ElevenLabs v3 is an
 * explicit opt-in (timeline voice.engine = 'elevenlabs'). Either engine's timestamps in; word timings, caption cards and a mixed
 * soundtrack out. Importable straight from a test or a script (no 'server-only').
 * See docs/plans/STUDIO_ONE_FACTORY.md for where each output lands in the manifest.
 */
export {
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_FORMATS,
  ELEVENLABS_BASE_URL,
  ElevenLabsError,
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
export type { CaptionCard, CharacterAlignment, ManifestVoice, SpokenWord, StereoAudio, VoiceEngine } from './types'
export { DEFAULT_VOICE_ENGINE, DEFAULT_GROK_VOICE, resolveVoiceEngine } from './engine'
