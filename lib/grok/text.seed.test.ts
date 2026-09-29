/**
 * Temperature and seed ride on the xAI chat body. Fetch is stubbed.
 * This test must not call api.x.ai.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateGrokStructured } from '@/lib/grok/text'
import { runWithGrokTransportAsync } from '@/lib/grok/transport'

describe('generateGrokStructured seed and temperature', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('puts temperature and seed on the chat completions body when the caller sets them', async () => {
    const bodies: Array<Record<string, unknown>> = []
    vi.stubEnv('XAI_API_KEY', 'test-not-a-real-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { cost_in_usd_ticks: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )

    const result = await runWithGrokTransportAsync('xai', () =>
      generateGrokStructured<{ ok: boolean }>({
        prompt: 'Return the object.',
        schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        schemaName: 'ok',
        temperature: 0,
        seed: 20260929,
        reasoningEffort: 'low',
      }),
    )

    expect(result.value.ok).toBe(true)
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.temperature).toBe(0)
    expect(bodies[0]!.seed).toBe(20260929)
    expect(bodies[0]!.reasoning_effort).toBe('low')
    expect(String(bodies[0]!.model)).toBe('grok-4.6')
  })

  it('omits seed and temperature when the caller does not set them', async () => {
    const bodies: Array<Record<string, unknown>> = []
    vi.stubEnv('XAI_API_KEY', 'test-not-a-real-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: {} }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )

    await runWithGrokTransportAsync('xai', () =>
      generateGrokStructured<{ ok: boolean }>({
        prompt: 'Return the object.',
        schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        schemaName: 'ok',
      }),
    )
    expect(bodies[0]!.temperature).toBeUndefined()
    expect(bodies[0]!.seed).toBeUndefined()
  })
})
