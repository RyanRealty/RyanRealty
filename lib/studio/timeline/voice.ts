/**
 * lib/studio/timeline/voice.ts: the film's voice and captions on ONE clock.
 *
 * ElevenLabs v3 with timestamps (lib/studio/voice/elevenlabs.ts) speaks the
 * timeline's script in a named female voice; the engine's own character timing
 * becomes spoken words (words.ts), the words are moved onto the film's clock by
 * the voice's start offset, and the caption cards are built from those very
 * words (captions.ts). The mix (mix.ts) places the audio at the same offset, so
 * a caption starts on the frame its word is heard.
 *
 * Spend: a synthesis is cached on disk by everything that shapes the sound
 * (text, voice, model, seed, settings), so iterating on a film never pays for
 * the same line twice. Tests pass their own provider and never touch the API.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_MODEL,
  alignmentToWords,
  buildCaptions,
  decodeVoiceAudio,
  spawnFfmpeg,
  synthesizeWithTimestamps,
  voiceIdFor,
  type CaptionCard,
  type ClientDeps,
  type SpokenWord,
  type StereoAudio,
  type Synthesis,
  type VoiceSettings,
} from '../voice'
import type { TimelineVoice } from './types'

/** Where the voice starts in the film when the timeline does not say. */
export const DEFAULT_VOICE_START = 0.3

export type VoiceRequest = {
  text: string
  voiceId: string
  model: string
  seed?: number
  voiceSettings?: VoiceSettings
}

/** Something that speaks a line with timing. The real one calls ElevenLabs; tests stub it. */
export type VoiceProvider = (request: VoiceRequest) => Promise<Synthesis>

export function elevenLabsProvider(deps: ClientDeps = {}): VoiceProvider {
  return (request) =>
    synthesizeWithTimestamps(
      {
        text: request.text,
        voiceId: request.voiceId,
        model: request.model,
        seed: request.seed,
        voiceSettings: request.voiceSettings,
      },
      deps,
    )
}

/** The cache key: every input that changes the sound. */
export function voiceCacheKey(request: VoiceRequest): string {
  const shaped = {
    text: request.text,
    voiceId: request.voiceId,
    model: request.model,
    seed: request.seed ?? null,
    voiceSettings: request.voiceSettings ?? null,
  }
  return createHash('sha256').update(JSON.stringify(shaped)).digest('hex').slice(0, 32)
}

type CachedSynthesis = Omit<Synthesis, 'audio'> & { audioBase64: string }

/** Speak through the cache: a hit costs nothing. */
export async function cachedSynthesis(
  request: VoiceRequest,
  provider: VoiceProvider,
  cacheDir: string | null,
): Promise<{ synthesis: Synthesis; cached: boolean }> {
  const key = voiceCacheKey(request)
  const file = cacheDir ? join(cacheDir, `${key}.json`) : null
  if (file && existsSync(file)) {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as CachedSynthesis
    const { audioBase64, ...rest } = raw
    return { synthesis: { ...rest, audio: Buffer.from(audioBase64, 'base64') }, cached: true }
  }
  const synthesis = await provider(request)
  if (file && cacheDir) {
    mkdirSync(cacheDir, { recursive: true })
    const { audio, ...rest } = synthesis
    writeFileSync(file, JSON.stringify({ ...rest, audioBase64: audio.toString('base64') }))
  }
  return { synthesis, cached: false }
}

/** The film's voice: what made it, its words and captions on the film clock, and its samples. */
export type FilmVoice = {
  engine: 'elevenlabs'
  model: string
  voiceId: string
  /** Seconds into the film where the voice's first sample plays. */
  offset: number
  /** The exact text sent to the engine. */
  script: string
  /** Spoken words, film clock. */
  words: SpokenWord[]
  /** Caption cards, film clock, built from `words`. */
  captions: CaptionCard[]
  /** The voice alone, 48 kHz stereo, starting at its own first sample. */
  audio: StereoAudio
  /** Spoken words on the voice's own clock (what the mix shifts). */
  voiceWords: SpokenWord[]
  outputFormat: string
  cached: boolean
}

const ms = (n: number) => Math.round(n * 1000) / 1000

/** Move words onto the film clock, to the millisecond. */
export function shiftWords(words: readonly SpokenWord[], offset: number): SpokenWord[] {
  return words.map((w) => ({ word: w.word, start: ms(w.start + offset), end: ms(Math.max(w.start, w.end) + offset) }))
}

/**
 * Speak the timeline's script and build its captions. `captionsUntil` is the
 * end card's start: no caption runs into the locked card. Throws when the voice
 * runs past it, or when the captions cannot hold their rules.
 */
export async function speakTimeline(
  voice: TimelineVoice,
  opts: {
    provider: VoiceProvider
    cacheDir: string | null
    ffmpeg: string
    captionsUntil: number
    env?: NodeJS.ProcessEnv
    voiceId?: string
  },
): Promise<FilmVoice> {
  const voiceId = opts.voiceId ?? voiceIdFor(voice.voice, opts.env)
  const request: VoiceRequest = {
    text: voice.script,
    voiceId,
    model: voice.model ?? DEFAULT_MODEL,
    ...(voice.seed !== undefined ? { seed: voice.seed } : {}),
    ...(voice.settings ? { voiceSettings: voice.settings } : {}),
  }
  const { synthesis, cached } = await cachedSynthesis(request, opts.provider, opts.cacheDir)
  const voiceWords = alignmentToWords(synthesis.alignment)
  if (voiceWords.length === 0) throw new Error('the voice came back with no spoken words')
  const offset = voice.start ?? DEFAULT_VOICE_START
  const words = shiftWords(voiceWords, offset)
  const last = words[words.length - 1]
  if (last.end > opts.captionsUntil - 0.1 + 1e-9) {
    throw new Error(
      `the voice runs to ${last.end}s, into the end card at ${opts.captionsUntil}s; lengthen the beats before the end card or shorten the script (it ends with "${last.word}")`,
    )
  }
  // Caption starts are word starts (already to the millisecond); ends are rounded the same way.
  const captions = buildCaptions(words, { display: voice.display, endLimitSeconds: opts.captionsUntil }).map((c) => ({
    ...c,
    start: ms(c.start),
    end: ms(c.end),
  }))
  const audio = await decodeVoiceAudio(synthesis.audio, synthesis.outputFormat, { runFfmpeg: spawnFfmpeg(opts.ffmpeg) })
  return {
    engine: synthesis.engine,
    model: synthesis.model,
    voiceId: synthesis.voiceId,
    offset,
    script: synthesis.text,
    words,
    captions,
    audio,
    voiceWords,
    outputFormat: synthesis.outputFormat,
    cached,
  }
}
