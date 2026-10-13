/**
 * lib/studio/voice/elevenlabs.ts: the Studio's voice, with its clock.
 *
 * ElevenLabs text-to-speech WITH timestamps, the one call that returns the
 * audio and the engine's own character-level timing of that exact audio, so
 * captions are timed from the final voiceover and never estimated
 * (AGENTS.md "Ad copy, voiceover and captions" 4; docs/ai-voiceover-scripts.md 4).
 *
 * Confirmed against the official reference 2026-10-13
 * (https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps):
 *
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps
 *     headers  xi-api-key: <key>, Content-Type: application/json
 *     query    output_format (default mp3_44100_128; pcm_48000 and wav_48000 are
 *              listed; 44.1 kHz PCM/WAV need the Pro tier), enable_logging
 *     body     text (required), model_id (default eleven_multilingual_v2),
 *              language_code, voice_settings { stability, similarity_boost,
 *              style, speed, use_speaker_boost }, seed, previous_text,
 *              next_text, apply_text_normalization (auto|on|off), ...
 *     200      { audio_base64, alignment, normalized_alignment } where each
 *              alignment is { characters[], character_start_times_seconds[],
 *              character_end_times_seconds[] } (seconds)
 *
 * `alignment` times the text we sent (tags, ellipses and all); words.ts reads it.
 * Model and voice are recorded on every result, with the exact text sent, so the
 * manifest can say what made the sound. ElevenLabs v3 takes audio tags and
 * ellipses and NO `<break>` tag (docs/ai-voiceover-scripts.md 1).
 *
 * `fetch` is injected so tests never reach the network. The API key is read
 * from the environment only when the caller passes none, and never appears in
 * an error message, a result, or a log.
 *
 * Lives next to scripts/_voice_lib.py as an allowed home for the API call in
 * scripts/check-tool-discipline.mjs (G36): the Python helper serves the
 * Python producers, this serves lib/studio.
 */
import { Buffer } from 'node:buffer'
import type { CharacterAlignment, ManifestVoice, SpokenWord } from './types'

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io'
/** The model Matt's 2026-10-13 rule names for the ad voice. */
export const DEFAULT_MODEL = 'eleven_v3'
/** eleven_v3's documented request limit, characters. */
export const V3_MAX_CHARACTERS = 5000

/**
 * Output formats to ask for, best first. `pcm_48000` is raw signed 16-bit
 * little-endian mono at the Studio's own 48 kHz: no codec, no resample. If the
 * account's tier refuses it, MP3 is decoded by ffmpeg (decode.ts).
 */
export const DEFAULT_OUTPUT_FORMATS: readonly string[] = ['pcm_48000', 'mp3_44100_128']

/** The two female voices in the environment (Matt 2026-10-13: the VO is a female voice). */
export const VOICE_ENV = {
  ellen: 'ELEVENLABS_VOICE_ID_ELLEN',
  victoria: 'ELEVENLABS_VOICE_ID_VICTORIA',
} as const
export type VoiceName = keyof typeof VOICE_ENV

/** The voice id for a named voice, from the environment. Throws, naming the variable, when unset. */
export function voiceIdFor(name: VoiceName, env: NodeJS.ProcessEnv = process.env): string {
  const variable = VOICE_ENV[name]
  const id = env[variable]?.trim()
  if (!id) throw new ElevenLabsError(`${variable} is not set`, { status: 0 })
  return id
}

export type VoiceSettings = {
  stability?: number
  similarity_boost?: number
  style?: number
  speed?: number
  use_speaker_boost?: boolean
}

export type SynthesizeOptions = {
  /** The exact text to speak, markup included (audio tags, ellipses). Sent verbatim and recorded verbatim. */
  text: string
  voiceId: string
  /** Default eleven_v3. */
  model?: string
  /** Omit to use the voice's own defaults (recorded as null). */
  voiceSettings?: VoiceSettings
  /** 0 to 4294967295; best-effort determinism only (the docs' words). */
  seed?: number
  languageCode?: string
  previousText?: string
  nextText?: string
  applyTextNormalization?: 'auto' | 'on' | 'off'
  /** Preference order; the next is tried only when the API refuses the format. Default DEFAULT_OUTPUT_FORMATS. */
  outputFormats?: readonly string[]
}

export type ClientDeps = {
  /** Default process.env.ELEVENLABS_API_KEY. */
  apiKey?: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  /** Retries on 429 and 5xx, after 0.5 s, 1 s, 2 s. Default 2. */
  retries?: number
  sleep?: (ms: number) => Promise<void>
  /** Per-request abort, ms. Default 120000. */
  timeoutMs?: number
}

export type Synthesis = {
  engine: 'elevenlabs'
  model: string
  voiceId: string
  /** The exact text sent. */
  text: string
  /** The settings sent, or null when the voice's defaults applied. */
  voiceSettings: VoiceSettings | null
  /** The format the API actually served. */
  outputFormat: string
  /** The audio bytes exactly as returned (raw PCM, or a container). */
  audio: Buffer
  /** Timing of the characters of `text`. */
  alignment: CharacterAlignment
  /** Timing of the engine's normalized text ("$169" read as words), when returned. */
  normalizedAlignment: CharacterAlignment | null
  /** The API's request id header, for support, when present. */
  requestId: string | null
  /** Formats tried and refused before this one, with the refusal. */
  refusedFormats: Array<{ format: string; status: number; detail: string }>
}

export class ElevenLabsError extends Error {
  readonly status: number
  readonly detail: string
  constructor(message: string, info: { status: number; detail?: string }) {
    super(message)
    this.name = 'ElevenLabsError'
    this.status = info.status
    this.detail = info.detail ?? ''
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A response body made safe to put in an error: the key removed, one line, bounded. */
function safeDetail(raw: string, apiKey: string): string {
  let text = raw
  if (apiKey) text = text.split(apiKey).join('[redacted]')
  return text.replace(/\s+/g, ' ').trim().slice(0, 500)
}

/** Seconds arrays must be the same length as the characters and finite. */
export function parseAlignment(raw: unknown, label: string): CharacterAlignment {
  const a = raw as {
    characters?: unknown
    character_start_times_seconds?: unknown
    character_end_times_seconds?: unknown
  } | null
  if (
    !a ||
    !Array.isArray(a.characters) ||
    !Array.isArray(a.character_start_times_seconds) ||
    !Array.isArray(a.character_end_times_seconds)
  ) {
    throw new ElevenLabsError(`ElevenLabs returned no usable ${label}`, { status: 200 })
  }
  const n = a.characters.length
  if (a.character_start_times_seconds.length !== n || a.character_end_times_seconds.length !== n) {
    throw new ElevenLabsError(`ElevenLabs ${label} arrays differ in length`, { status: 200 })
  }
  const starts = a.character_start_times_seconds as number[]
  const ends = a.character_end_times_seconds as number[]
  for (let i = 0; i < n; i++) {
    if (typeof a.characters[i] !== 'string' || !Number.isFinite(starts[i]) || !Number.isFinite(ends[i])) {
      throw new ElevenLabsError(`ElevenLabs ${label} has a non-finite entry at ${i}`, { status: 200 })
    }
  }
  return {
    characters: a.characters as string[],
    characterStartTimesSeconds: starts,
    characterEndTimesSeconds: ends,
  }
}

/** True when a refusal reads as "this output format is not available to you". */
function refusesFormat(error: ElevenLabsError): boolean {
  if (![400, 402, 403, 422].includes(error.status)) return false
  return /output_format|format|tier|plan|subscription|upgrade|pro\b|not.?allowed/i.test(error.detail)
}

function buildBody(options: SynthesizeOptions, model: string): Record<string, unknown> {
  const body: Record<string, unknown> = { text: options.text, model_id: model }
  if (options.voiceSettings) body.voice_settings = options.voiceSettings
  if (options.seed !== undefined) body.seed = options.seed
  if (options.languageCode) body.language_code = options.languageCode
  if (options.previousText) body.previous_text = options.previousText
  if (options.nextText) body.next_text = options.nextText
  if (options.applyTextNormalization) body.apply_text_normalization = options.applyTextNormalization
  return body
}

/**
 * Speak `options.text` and get the audio with the engine's own character
 * timing. Tries `outputFormats` in order, moving on only when the API refuses
 * the format itself. Retries 429 and 5xx a couple of times. Throws
 * ElevenLabsError (status, a key-free detail) on anything else, including a
 * response with no alignment: this call exists for the timing.
 */
export async function synthesizeWithTimestamps(options: SynthesizeOptions, deps: ClientDeps = {}): Promise<Synthesis> {
  const apiKey = deps.apiKey ?? process.env.ELEVENLABS_API_KEY ?? ''
  if (!apiKey) throw new ElevenLabsError('ELEVENLABS_API_KEY is not set', { status: 0 })
  if (!options.text || options.text.trim() === '') throw new RangeError('synthesizeWithTimestamps: text is empty')
  if (!options.voiceId) throw new RangeError('synthesizeWithTimestamps: voiceId is required')
  const model = options.model ?? DEFAULT_MODEL
  if (model === 'eleven_v3' && options.text.length > V3_MAX_CHARACTERS) {
    throw new RangeError(`synthesizeWithTimestamps: ${options.text.length} characters is over eleven_v3's ${V3_MAX_CHARACTERS}`)
  }
  const doFetch = deps.fetch ?? globalThis.fetch
  const base = (deps.baseUrl ?? ELEVENLABS_BASE_URL).replace(/\/+$/, '')
  const sleep = deps.sleep ?? defaultSleep
  const retries = deps.retries ?? 2
  const timeoutMs = deps.timeoutMs ?? 120_000
  const formats = options.outputFormats?.length ? options.outputFormats : DEFAULT_OUTPUT_FORMATS
  const body = JSON.stringify(buildBody(options, model))
  const refused: Synthesis['refusedFormats'] = []

  for (let f = 0; f < formats.length; f++) {
    const format = formats[f]
    const url = `${base}/v1/text-to-speech/${encodeURIComponent(options.voiceId)}/with-timestamps?output_format=${encodeURIComponent(format)}`
    let lastError: ElevenLabsError | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
          signal: controller.signal,
        })
      } catch (cause) {
        clearTimeout(timer)
        lastError = new ElevenLabsError('ElevenLabs request failed to send', {
          status: 0,
          detail: safeDetail(cause instanceof Error ? cause.message : String(cause), apiKey),
        })
        continue
      }
      clearTimeout(timer)
      const raw = await res.text()
      if (!res.ok) {
        const error = new ElevenLabsError(`ElevenLabs HTTP ${res.status} (${format}, ${model})`, {
          status: res.status,
          detail: safeDetail(raw, apiKey),
        })
        if (res.status === 429 || res.status >= 500) {
          lastError = error
          continue
        }
        if (f + 1 < formats.length && refusesFormat(error)) {
          refused.push({ format, status: res.status, detail: error.detail })
          lastError = null
          break
        }
        if (refused.length === 0) throw error
        const earlier = refused.map((r) => `${r.format} (HTTP ${r.status})`).join(', ')
        throw new ElevenLabsError(`${error.message}; earlier formats refused: ${earlier}`, { status: error.status, detail: error.detail })
      }
      let json: { audio_base64?: unknown; alignment?: unknown; normalized_alignment?: unknown }
      try {
        json = JSON.parse(raw)
      } catch {
        throw new ElevenLabsError('ElevenLabs returned a body that is not JSON', { status: res.status })
      }
      if (typeof json.audio_base64 !== 'string' || json.audio_base64 === '') {
        throw new ElevenLabsError('ElevenLabs returned no audio_base64', { status: res.status })
      }
      const audio = Buffer.from(json.audio_base64, 'base64')
      if (audio.length === 0) throw new ElevenLabsError('ElevenLabs returned empty audio', { status: res.status })
      return {
        engine: 'elevenlabs',
        model,
        voiceId: options.voiceId,
        text: options.text,
        voiceSettings: options.voiceSettings ?? null,
        outputFormat: format,
        audio,
        alignment: parseAlignment(json.alignment, 'alignment'),
        normalizedAlignment: json.normalized_alignment ? parseAlignment(json.normalized_alignment, 'normalized_alignment') : null,
        requestId: res.headers.get('request-id') ?? res.headers.get('x-request-id'),
        refusedFormats: refused,
      }
    }
    if (lastError) throw lastError
  }
  // Unreachable: the last format either returns or throws above. Kept so the function's type is honest.
  throw new ElevenLabsError('ElevenLabs served no output format', { status: refused.at(-1)?.status ?? 0 })
}

/** The manifest's `voice` block: what made the sound, and when each word is said. */
export function manifestVoice(synthesis: Pick<Synthesis, 'engine' | 'model' | 'voiceId'>, words: SpokenWord[]): ManifestVoice {
  return { engine: synthesis.engine, model: synthesis.model, voiceId: synthesis.voiceId, words }
}
