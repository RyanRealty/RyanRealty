/**
 * lib/grok/vision.test.ts — the general vision path (CLAUDE.md §4 chokepoint).
 *
 * `generateGrokVisionText` was added 2026-09-12 because the site-queue taste
 * instrument had three transports and, on a runner without the grok CLI, no
 * working one. These cover the message shape it puts on the wire, since a
 * malformed content part fails as an opaque 400 from xAI.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateGrokVisionText, imageDataUrl } from './vision'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

function mockXai(content: string) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function bodyOf(fetchMock: ReturnType<typeof mockXai>) {
  const init = fetchMock.mock.calls[0]?.[1]
  if (!init?.body) throw new Error('xaiFetch was never called with a body')
  return JSON.parse(String(init.body))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('imageDataUrl', () => {
  it('base64-encodes bytes behind the declared mime type', () => {
    expect(imageDataUrl(PNG)).toBe('data:image/png;base64,iVBORw==')
  })

  it('honours a non-default mime', () => {
    expect(imageDataUrl(PNG, 'image/jpeg')).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('refuses empty bytes rather than sending an empty part xAI answers with a 400', () => {
    expect(() => imageDataUrl(new Uint8Array())).toThrow(/needs image bytes/)
  })
})

describe('generateGrokVisionText', () => {
  it('sends one text part then one image_url part per image, in order', async () => {
    vi.stubEnv('XAI_API_KEY', 'test-key')
    const fetchMock = mockXai('{"score":71}')

    const out = await generateGrokVisionText({
      prompt: 'judge this',
      images: [{ bytes: PNG }, { bytes: PNG, mime: 'image/jpeg' }],
      model: 'grok-4.6',
    })

    expect(out).toEqual({ text: '{"score":71}', model: 'grok-4.6' })
    const body = bodyOf(fetchMock)
    expect(body.model).toBe('grok-4.6')
    expect(body.messages).toHaveLength(1)
    const parts = body.messages[0].content
    expect(parts.map((p: { type: string }) => p.type)).toEqual(['text', 'image_url', 'image_url'])
    expect(parts[0].text).toBe('judge this')
    expect(parts[1].image_url.url).toMatch(/^data:image\/png;base64,/)
    expect(parts[2].image_url.url).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('defaults to the vision model when the caller names none', async () => {
    vi.stubEnv('XAI_API_KEY', 'test-key')
    const fetchMock = mockXai('ok')
    const out = await generateGrokVisionText({ prompt: 'p', images: [{ bytes: PNG }] })
    expect(out.model).toBe('grok-4.6')
    expect(bodyOf(fetchMock).model).toBe('grok-4.6')
  })

  it('refuses a call with no images — a taste score with no shots is not a score', async () => {
    vi.stubEnv('XAI_API_KEY', 'test-key')
    await expect(generateGrokVisionText({ prompt: 'p', images: [] })).rejects.toThrow(/at least one image/)
  })

  it('refuses an empty prompt', async () => {
    vi.stubEnv('XAI_API_KEY', 'test-key')
    await expect(generateGrokVisionText({ prompt: '   ', images: [{ bytes: PNG }] })).rejects.toThrow(/needs a prompt/)
  })
})
