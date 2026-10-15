/**
 * lib/studio/voice/types.ts: the shapes the voiceover and captions hand to the
 * rest of the factory.
 *
 * `SpokenWord`, `CaptionCard` and `ManifestVoice` are the manifest's own shapes
 * (docs/plans/STUDIO_ONE_FACTORY.md: `voice.words`, `captions`, `voice`),
 * field for field, so a value from this folder drops into
 * `final.manifest.json` without a mapping step. Seconds everywhere.
 */

/** One spoken word with its place in the final audio: `voice.words[i]` in the manifest. */
export type SpokenWord = { word: string; start: number; end: number }

/** One caption card: `captions[i]` in the manifest. `words` are indices into the spoken-word list. */
export type CaptionCard = { text: string; start: number; end: number; words: number[] }

/** The engine's character-level timing (ElevenLabs alignment or Grok graph_chars/graph_times, camelCased). Seconds from the first sample of the audio. */
export type CharacterAlignment = {
  characters: string[]
  characterStartTimesSeconds: number[]
  characterEndTimesSeconds: number[]
}

/** Voice engines. 'grok' (Grok TTS, Eve) is the enforced default; 'elevenlabs' is opt-in only. */
export type VoiceEngine = 'grok' | 'elevenlabs'

/** The manifest's `voice` block. */
export type ManifestVoice = {
  engine: VoiceEngine
  model: string
  voiceId: string
  words: SpokenWord[]
}

/** 48 kHz stereo float audio, the format every buffer in lib/studio/score uses. */
export type StereoAudio = { left: Float32Array; right: Float32Array }
