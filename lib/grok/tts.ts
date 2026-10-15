/**
 * lib/grok/tts.ts: Grok text-to-speech (xAI POST /v1/tts), the Studio's DEFAULT voice engine.
 *
 * Matt, 2026-10-14 (relayed by Chief of Staff): Grok voice replaces the ElevenLabs studio
 * voiceover for all videos, and the voice is Eve (the same voice as the receptionist).
 * ElevenLabs stays available only as an explicit opt-in (timeline voice.engine = 'elevenlabs').
 *
 * Confirmed against https://docs.x.ai/developers/model-capabilities/audio/text-to-speech (2026-10-14):
 *   POST https://api.x.ai/v1/tts  { text, voice_id (default eve), language (required),
 *     output_format { codec mp3|wav|pcm|mulaw|alaw, sample_rate, bit_rate }, speed 0.7-1.5,
 *     text_normalization, with_timestamps, replace }
 *   with_timestamps: true -> JSON { audio (base64), content_type, duration,
 *     audio_timestamps { graph_chars[], graph_times[[start,end]] } } (seconds)
 *   GET /v1/tts/voices -> { voices: [{ voice_id, name, language, gender }] }
 * Speech tags: inline [pause] [long-pause] [breath] [inhale] [exhale] [sigh] [laugh] [chuckle] ...
 * and wrapping <whisper>..</whisper>, <slow>..</slow> etc. graph_chars mirrors the input one for
 * one, tags included; lib/studio/voice/words.ts drops [tags], and wrapping <tags> are blanked here.
 *
 * Goes through xaiFetch (one key read, one retry policy). The key never appears in a result.
 */
import { Buffer } from 'node:buffer'
import { xaiFetch } from './client'

/** The locked default voice. ci: lib/grok/tts.test.ts fails if this changes. */
export const GROK_TTS_DEFAULT_VOICE = 'eve' as const
/** Engine label recorded on every synthesis and in the film manifest. */
export const GROK_TTS_ENGINE = 'grok' as const
/** xAI exposes one TTS model; the label is recorded so the manifest says what made the sound. */
export const GROK_TTS_MODEL = 'grok-tts' as const
export const GROK_TTS_MAX_CHARACTERS = 60_000
/** Post-production default: lossless WAV at 48 kHz (the Studio's own rate). */
export const GROK_TTS_DEFAULT_FORMAT = { codec: 'wav', sample_rate: 48_000 } as const

export type GrokTtsFormat = { codec: 'mp3' | 'wav' | 'pcm' | 'mulaw' | 'alaw'; sample_rate?: number; bit_rate?: number }

export type GrokTtsOptions = {
  /** Exact text, speech tags included. Spell numbers out for ads ("one hundred sixty-nine dollars"). */
  text: string
  /** Default eve. */
  voiceId?: string
  /** BCP-47 or 'auto'. Default 'en'. */
  language?: string
  /** 0.7 to 1.5. 0.95 reads as a relaxed phone call. */
  speed?: number
  outputFormat?: GrokTtsFormat
  textNormalization?: boolean
  replace?: Record<string, string>
}

export type GrokCharacterAlignment = {
  characters: string[]
  characterStartTimesSeconds: number[]
  characterEndTimesSeconds: number[]
}

export type GrokSpeech = {
  engine: typeof GROK_TTS_ENGINE
  model: typeof GROK_TTS_MODEL
  voiceId: string
  text: string
  /** e.g. 'wav_48000' / 'mp3_24000', the same shape lib/studio/voice/decode.ts reads. */
  outputFormat: string
  audio: Buffer
  duration: number
  alignment: GrokCharacterAlignment
}

export type GrokTtsDeps = { fetchImpl?: typeof xaiFetch }

/** Blank the characters of wrapping tags (<slow>, </slow>) so they never become caption words; lengths are kept. */
export function blankWrappingTags(chars: readonly string[]): string[] {
  const out = [...chars]
  let inside = false
  for (let i = 0; i < out.length; i++) {
    if (out[i] === '<') inside = true
    if (inside) {
      const close = out[i] === '>'
      out[i] = ' '
      if (close) inside = false
    }
  }
  return out
}

export function grokTtsBody(o: GrokTtsOptions): Record<string, unknown> {
  if (!o.text.trim()) throw new RangeError('grok tts: text is empty')
  if (o.text.length > GROK_TTS_MAX_CHARACTERS) throw new RangeError(`grok tts: text over ${GROK_TTS_MAX_CHARACTERS} characters`)
  if (o.speed !== undefined && (o.speed < 0.7 || o.speed > 1.5)) throw new RangeError('grok tts: speed must be 0.7 to 1.5')
  return {
    text: o.text,
    voice_id: o.voiceId ?? GROK_TTS_DEFAULT_VOICE,
    language: o.language ?? 'en',
    output_format: o.outputFormat ?? GROK_TTS_DEFAULT_FORMAT,
    with_timestamps: true,
    ...(o.speed !== undefined ? { speed: o.speed } : {}),
    ...(o.textNormalization !== undefined ? { text_normalization: o.textNormalization } : {}),
    ...(o.replace ? { replace: o.replace } : {}),
  }
}

/** Speak `text` with Grok TTS and get the audio plus xAI's own character timing of that exact audio. */
export async function synthesizeGrokSpeech(o: GrokTtsOptions, deps: GrokTtsDeps = {}): Promise<GrokSpeech> {
  const body = grokTtsBody(o)
  const res = await (deps.fetchImpl ?? xaiFetch)('/tts', { method: 'POST', body: JSON.stringify(body) }, { timeoutMs: 300_000 })
  const p = (await res.json()) as {
    audio: string
    duration: number
    audio_timestamps?: { graph_chars: string[]; graph_times: [number, number][] }
  }
  if (!p.audio || !p.audio_timestamps) throw new Error('grok tts: response had no audio or timestamps')
  const ts = p.audio_timestamps
  const fmt = body.output_format as GrokTtsFormat
  return {
    engine: GROK_TTS_ENGINE,
    model: GROK_TTS_MODEL,
    voiceId: String(body.voice_id),
    text: o.text,
    outputFormat: `${fmt.codec}_${fmt.sample_rate ?? 24_000}`,
    audio: Buffer.from(p.audio, 'base64'),
    duration: p.duration,
    alignment: {
      characters: blankWrappingTags(ts.graph_chars),
      characterStartTimesSeconds: ts.graph_times.map((t) => t[0]),
      characterEndTimesSeconds: ts.graph_times.map((t) => t[1]),
    },
  }
}

/** GET /v1/tts/voices: the built-in voices on the account. */
export async function listGrokVoices(deps: GrokTtsDeps = {}): Promise<Array<{ voice_id: string; name: string; gender?: string }>> {
  const res = await (deps.fetchImpl ?? xaiFetch)('/tts/voices', { method: 'GET' })
  return ((await res.json()) as { voices: Array<{ voice_id: string; name: string; gender?: string }> }).voices
}
