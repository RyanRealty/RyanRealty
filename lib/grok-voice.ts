/**
 * xAI Voice chokepoint (G32 / R-213).
 *
 * Docs loaded this session (required before any generate call):
 *   https://docs.x.ai/overview
 *   https://docs.x.ai/developers/models
 *   https://docs.x.ai/developers/model-capabilities/imagine
 *   https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
 *   https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
 *   https://docs.x.ai/developers/model-capabilities/audio/custom-voices
 *
 * New VO / STT / caption-align goes through this module. Do not call
 * ElevenLabs, Replicate, fal, Synthesia, or OpenAI images from a new path.
 * Do not invent a listing. Publishes stay approval-gated.
 */

const XAI_TTS_URL = 'https://api.x.ai/v1/tts'
const XAI_STT_URL = 'https://api.x.ai/v1/stt'

/** Locked voice. Override with XAI_VOICE_ID after Matt clones Victoria. */
export const XAI_VOICE_ID_DEFAULT = 'eve'

/**
 * Central Oregon place names → IPA (CLAUDE.md §4).
 * xAI `replace` values may be IPA in slashes. Keys: letters, digits, apostrophes, spaces.
 * Tumalo is TUM-uh-low, not TOO-muh-low.
 */
export const PLACE_NAME_REPLACE: Record<string, string> = {
  Deschutes: '/dəˈʃuːts/',
  Tumalo: '/ˈtʌməloʊ/',
  Tetherow: '/ˈtɛθəroʊ/',
  Awbrey: '/ˈɔːbri/',
  Terrebonne: '/ˈtɛrəbɒn/',
  Paulina: '/pɒlˈaɪnə/',
  Madras: '/ˈmædrəs/',
}

export type GrokWordTimestamp = {
  text: string
  start: number
  end: number
}

export type GrokTtsResult = {
  audio: Buffer
  durationSec: number | null
  words: GrokWordTimestamp[]
}

export type GrokTtsOptions = {
  text: string
  language?: string
  withTimestamps?: boolean
  speed?: number
  voiceId?: string
  replace?: Record<string, string>
  fetchImpl?: typeof fetch
}

export type GrokSttOptions = {
  audio: ArrayBuffer | Buffer | Uint8Array
  filename?: string
  contentType?: string
  language?: string
  diarize?: boolean
  keyterms?: string[]
  fetchImpl?: typeof fetch
}

export function lockedXaiVoiceId(): string {
  const override = process.env.XAI_VOICE_ID?.trim()
  return override || XAI_VOICE_ID_DEFAULT
}

function requireXaiKey(): string {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not set. Add it to .env.local for voice generation.')
  }
  return apiKey
}

/** Group xAI character timestamps into words for SingleWordCaption. */
export function wordsFromCharTimestamps(
  graphChars: string[] | undefined,
  graphTimes: Array<[number, number]> | undefined,
): GrokWordTimestamp[] {
  if (!graphChars?.length || !graphTimes?.length) return []
  const words: GrokWordTimestamp[] = []
  let buf = ''
  let start = 0
  let end = 0
  const flush = () => {
    const text = buf.trim()
    if (text) words.push({ text, start, end })
    buf = ''
  }
  const n = Math.min(graphChars.length, graphTimes.length)
  for (let i = 0; i < n; i++) {
    const ch = graphChars[i] ?? ''
    const pair = graphTimes[i]
    if (!pair) continue
    if (/\s/.test(ch)) {
      flush()
      continue
    }
    if (!buf) start = pair[0]
    buf += ch
    end = pair[1]
  }
  flush()
  return words
}

/**
 * Synthesize speech via POST /v1/tts.
 * `with_timestamps: true` returns a JSON envelope (audio + graph_chars/times).
 */
export async function synthesizeGrokVoice(options: GrokTtsOptions): Promise<GrokTtsResult> {
  const apiKey = requireXaiKey()
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const text = options.text.trim()
  if (!text) throw new Error('TTS text is required')
  if (text.length > 15000) throw new Error('TTS text exceeds 15,000 characters')

  const body: Record<string, unknown> = {
    text,
    voice_id: options.voiceId ?? lockedXaiVoiceId(),
    language: options.language ?? 'en',
    replace: options.replace ?? PLACE_NAME_REPLACE,
  }
  if (options.withTimestamps !== false) body.with_timestamps = true
  if (typeof options.speed === 'number') body.speed = options.speed

  const res = await fetchImpl(XAI_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`xAI TTS failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await res.json()) as {
      audio?: string
      duration?: number
      audio_timestamps?: { graph_chars?: string[]; graph_times?: Array<[number, number]> }
    }
    if (!payload.audio) throw new Error('xAI TTS JSON envelope did not return audio')
    const words = wordsFromCharTimestamps(
      payload.audio_timestamps?.graph_chars,
      payload.audio_timestamps?.graph_times,
    )
    return {
      audio: Buffer.from(payload.audio, 'base64'),
      durationSec: typeof payload.duration === 'number' ? payload.duration : null,
      words,
    }
  }

  const buf = Buffer.from(await res.arrayBuffer())
  return { audio: buf, durationSec: null, words: [] }
}

/** Transcribe audio via POST /v1/stt (Twilio recordings, call logs). */
export async function transcribeGrokAudio(options: GrokSttOptions): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) return null
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  const bytes =
    options.audio instanceof ArrayBuffer
      ? new Uint8Array(options.audio)
      : options.audio instanceof Buffer
        ? new Uint8Array(options.audio)
        : options.audio
  const form = new FormData()
  form.append('format', 'true')
  form.append('language', options.language ?? 'en')
  if (options.diarize) form.append('diarize', 'true')
  const keyterms = options.keyterms ?? ['Deschutes', 'Tumalo', 'Tetherow', 'Awbrey', 'Bend']
  for (const term of keyterms) form.append('keyterm', term)
  form.append(
    'file',
    new Blob([bytes as BlobPart], { type: options.contentType ?? 'audio/mpeg' }),
    options.filename ?? 'audio.mp3',
  )

  const res = await fetchImpl(XAI_STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    console.warn('[grok-voice] STT failed:', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return null
  }
  const data = (await res.json()) as { text?: string }
  return data.text?.trim() || null
}
