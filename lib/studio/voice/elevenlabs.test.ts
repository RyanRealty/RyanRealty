import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MODEL,
  ElevenLabsError,
  V3_MAX_CHARACTERS,
  manifestVoice,
  parseAlignment,
  synthesizeWithTimestamps,
  voiceIdFor,
} from './elevenlabs'

// No test here reaches the network: every call goes through an injected fetch.

/** A test environment: Next's types make NODE_ENV required on ProcessEnv. */
const env = (vars: Record<string, string>): NodeJS.ProcessEnv => vars as unknown as NodeJS.ProcessEnv

const KEY = 'xi-test-key-0123456789'
const VOICE = 'voice-abc'

const ALIGNMENT = {
  characters: ['O', 'k', 'a', 'y'],
  character_start_times_seconds: [0, 0.1, 0.2, 0.3],
  character_end_times_seconds: [0.1, 0.2, 0.3, 0.4],
}
const AUDIO = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0])

function ok(extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ audio_base64: AUDIO.toString('base64'), alignment: ALIGNMENT, normalized_alignment: ALIGNMENT, ...extra }),
    { status: 200, headers: { 'content-type': 'application/json', ...headers } },
  )
}

function failing(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

type FetchMock = ReturnType<typeof vi.fn<typeof globalThis.fetch>>
const mockFetch = (...responses: Array<Response | Error>): FetchMock => {
  const queue = [...responses]
  return vi.fn<typeof globalThis.fetch>(async () => {
    const next = queue.shift()
    if (!next) throw new Error('unexpected extra fetch')
    if (next instanceof Error) throw next
    return next
  })
}
const noSleep = async () => {}

describe('synthesizeWithTimestamps: the request', () => {
  it('posts to the with-timestamps endpoint with the key header, the model and the exact text', async () => {
    const fetch = mockFetch(ok({}, { 'request-id': 'req-1' }))
    const text = "[warm] Okay, so... here's the thing."
    const result = await synthesizeWithTimestamps({ text, voiceId: VOICE }, { apiKey: KEY, fetch })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-abc/with-timestamps?output_format=pcm_48000')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'xi-api-key': KEY, 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toEqual({ text, model_id: 'eleven_v3' })
    expect(result.text).toBe(text)
    expect(result).toMatchObject({ engine: 'elevenlabs', model: DEFAULT_MODEL, voiceId: VOICE, outputFormat: 'pcm_48000', requestId: 'req-1' })
  })

  it('sends only the options it is given, under the API field names', async () => {
    const fetch = mockFetch(ok())
    await synthesizeWithTimestamps(
      {
        text: 'Hi there.',
        voiceId: VOICE,
        model: 'eleven_multilingual_v2',
        voiceSettings: { stability: 0.5, speed: 1.05 },
        seed: 7,
        languageCode: 'en',
        previousText: 'Before.',
        nextText: 'After.',
        applyTextNormalization: 'off',
        outputFormats: ['mp3_44100_128'],
      },
      { apiKey: KEY, fetch },
    )
    const [url, init] = fetch.mock.calls[0]
    expect(url).toContain('?output_format=mp3_44100_128')
    expect(JSON.parse(init?.body as string)).toEqual({
      text: 'Hi there.',
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, speed: 1.05 },
      seed: 7,
      language_code: 'en',
      previous_text: 'Before.',
      next_text: 'After.',
      apply_text_normalization: 'off',
    })
  })

  it('records the voice settings it sent, or null when the voice defaults applied', async () => {
    const a = await synthesizeWithTimestamps({ text: 'Hi.', voiceId: VOICE, voiceSettings: { stability: 0.5 } }, { apiKey: KEY, fetch: mockFetch(ok()) })
    expect(a.voiceSettings).toEqual({ stability: 0.5 })
    const b = await synthesizeWithTimestamps({ text: 'Hi.', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok()) })
    expect(b.voiceSettings).toBeNull()
  })

  it('refuses text that is empty or over the v3 limit before spending anything', async () => {
    const fetch = mockFetch()
    await expect(synthesizeWithTimestamps({ text: '  ', voiceId: VOICE }, { apiKey: KEY, fetch })).rejects.toThrow(RangeError)
    await expect(synthesizeWithTimestamps({ text: 'a'.repeat(V3_MAX_CHARACTERS + 1), voiceId: VOICE }, { apiKey: KEY, fetch })).rejects.toThrow(/5000/)
    await expect(synthesizeWithTimestamps({ text: 'Hi', voiceId: '' }, { apiKey: KEY, fetch })).rejects.toThrow(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('needs a key', async () => {
    const saved = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    try {
      await expect(synthesizeWithTimestamps({ text: 'Hi', voiceId: VOICE }, { fetch: mockFetch() })).rejects.toThrow(/ELEVENLABS_API_KEY/)
    } finally {
      if (saved !== undefined) process.env.ELEVENLABS_API_KEY = saved
    }
  })
})

describe('synthesizeWithTimestamps: the response', () => {
  it('returns the audio bytes and the character timing, camelCased', async () => {
    const result = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok()) })
    expect(result.audio.equals(AUDIO)).toBe(true)
    expect(result.alignment).toEqual({
      characters: ['O', 'k', 'a', 'y'],
      characterStartTimesSeconds: [0, 0.1, 0.2, 0.3],
      characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4],
    })
    expect(result.normalizedAlignment).toEqual(result.alignment)
    expect(result.refusedFormats).toEqual([])
  })

  it('allows a missing normalized alignment but not a missing alignment', async () => {
    const without = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok({ normalized_alignment: null })) })
    expect(without.normalizedAlignment).toBeNull()
    await expect(
      synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok({ alignment: null })) }),
    ).rejects.toThrow(/alignment/)
  })

  it('rejects malformed alignment and empty audio', async () => {
    const bad = { characters: ['a', 'b'], character_start_times_seconds: [0], character_end_times_seconds: [1, 2] }
    await expect(synthesizeWithTimestamps({ text: 'ab', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok({ alignment: bad })) })).rejects.toThrow(/differ in length/)
    await expect(synthesizeWithTimestamps({ text: 'ab', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(ok({ audio_base64: '' })) })).rejects.toThrow(/audio/)
    await expect(
      synthesizeWithTimestamps({ text: 'ab', voiceId: VOICE }, { apiKey: KEY, fetch: mockFetch(new Response('not json', { status: 200 })) }),
    ).rejects.toThrow(/not JSON/)
  })

  it('parseAlignment names the field it is reading', () => {
    expect(() => parseAlignment(null, 'alignment')).toThrow(/alignment/)
    expect(() => parseAlignment({ characters: ['a'], character_start_times_seconds: [Number.NaN], character_end_times_seconds: [1] }, 'x')).toThrow(/non-finite/)
  })
})

describe('synthesizeWithTimestamps: failures', () => {
  it('falls back to the next output format only when the API refuses the format, and records the refusal', async () => {
    const fetch = mockFetch(failing(403, { detail: { message: 'output_format pcm_48000 requires the Pro tier' } }), ok())
    const result = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch, sleep: noSleep })
    expect(result.outputFormat).toBe('mp3_44100_128')
    expect(fetch.mock.calls.map((c) => String(c[0]).split('output_format=')[1])).toEqual(['pcm_48000', 'mp3_44100_128'])
    expect(result.refusedFormats).toHaveLength(1)
    expect(result.refusedFormats[0]).toMatchObject({ format: 'pcm_48000', status: 403 })
  })

  it('does not move on from a bad key or a bad voice, and does not retry them', async () => {
    const fetch = mockFetch(failing(401, { detail: { status: 'invalid_api_key' } }))
    await expect(synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch, sleep: noSleep })).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(1)
    const notFound = mockFetch(failing(404, { detail: { status: 'voice_not_found' } }))
    await expect(synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch: notFound })).rejects.toMatchObject({ status: 404 })
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and a 5xx with a growing wait, then succeeds', async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const fetch = mockFetch(failing(429, 'slow down'), failing(503, 'try later'), ok())
    const result = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch, sleep })
    expect(result.outputFormat).toBe('pcm_48000')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000])
  })

  it('gives up after its retries and says what the API said', async () => {
    const fetch = mockFetch(failing(500, 'a'), failing(500, 'b'), failing(500, 'boom'))
    await expect(synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch, sleep: noSleep })).rejects.toMatchObject({
      status: 500,
      detail: 'boom',
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries a network error', async () => {
    const fetch = mockFetch(new TypeError('fetch failed'), ok())
    const result = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch, sleep: noSleep })
    expect(result.audio.length).toBeGreaterThan(0)
  })

  it('never puts the key in an error', async () => {
    const fetch = mockFetch(failing(422, `bad request for key ${KEY} and more`))
    const error = await synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE, outputFormats: ['pcm_48000'] }, { apiKey: KEY, fetch }).catch((e) => e)
    expect(error).toBeInstanceOf(ElevenLabsError)
    expect(`${error.message} ${error.detail} ${error.stack}`).not.toContain(KEY)
    expect(error.detail).toContain('[redacted]')
    const network = await synthesizeWithTimestamps(
      { text: 'Okay', voiceId: VOICE },
      { apiKey: KEY, fetch: mockFetch(new Error(`connect failed with ${KEY}`), new Error(`x ${KEY}`), new Error(`y ${KEY}`)), sleep: noSleep },
    ).catch((e) => e)
    expect(`${network.message} ${network.detail}`).not.toContain(KEY)
  })

  it('names the formats it already tried when the last one fails too', async () => {
    const fetch = mockFetch(failing(403, 'output_format needs a plan upgrade'), failing(403, 'output_format needs a plan upgrade'))
    await expect(synthesizeWithTimestamps({ text: 'Okay', voiceId: VOICE }, { apiKey: KEY, fetch })).rejects.toThrow(/earlier formats refused: pcm_48000 \(HTTP 403\)/)
  })
})

describe('voice ids and the manifest block', () => {
  it('reads the named voice from the environment and names the variable when it is unset', () => {
    expect(voiceIdFor('ellen', env({ ELEVENLABS_VOICE_ID_ELLEN: ' ell-1 ' }))).toBe('ell-1')
    expect(voiceIdFor('victoria', env({ ELEVENLABS_VOICE_ID_VICTORIA: 'vic-1' }))).toBe('vic-1')
    expect(() => voiceIdFor('ellen', env({}))).toThrow(/ELEVENLABS_VOICE_ID_ELLEN/)
  })

  it('builds the manifest voice block with exactly engine, model, voiceId and words', () => {
    const words = [{ word: 'Okay,', start: 0.1, end: 0.4 }]
    const block = manifestVoice({ engine: 'elevenlabs', model: 'eleven_v3', voiceId: VOICE }, words)
    expect(block).toEqual({ engine: 'elevenlabs', model: 'eleven_v3', voiceId: VOICE, words })
    expect(Object.keys(block).sort()).toEqual(['engine', 'model', 'voiceId', 'words'])
  })
})
