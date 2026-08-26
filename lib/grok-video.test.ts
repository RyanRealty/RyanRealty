import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateImageToVideo } from './grok-video'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.unstubAllEnvs()
})

describe('generateImageToVideo — the image payload', () => {
  // The defect this pins: `image` was sent as a bare string. xAI answers
  // 422 "invalid type: string ... expected struct ImageUrl", so every
  // image-to-video call failed and the Grok Imagine draft path had never
  // produced a video. Confirmed live 2026-08-26 — the string form 422s,
  // { url } returns 200.
  it('sends image as an object with a url, never a bare string', async () => {
    vi.stubEnv('XAI_API_KEY', 'test-key')
    let sent: unknown
    // Capture the body, then fail the call so the function throws instead of
    // polling for a video that will never arrive in a unit test.
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      sent = JSON.parse(init.body)
      return { ok: false, status: 500, text: async () => 'stop here' }
    }) as unknown as typeof fetch

    await generateImageToVideo({ image_url: 'https://example.com/a.jpg' }).catch(() => {})

    expect(sent).toBeDefined()
    const image = (sent as { image?: unknown }).image
    expect(typeof image).toBe('object')
    expect(image).toEqual({ url: 'https://example.com/a.jpg' })
    expect(typeof image).not.toBe('string')
  })
})
