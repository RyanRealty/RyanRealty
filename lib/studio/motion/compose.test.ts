import { describe, expect, it, vi } from 'vitest'
import { composeMotion, type ComposeMotionDeps } from './compose'
import type { MotionSubject } from './cues'
import type { MotionAssets } from './assets'
import type { RenderMotionInput } from './render'

const subject: MotionSubject = {
  label: 'Bend, Oregon',
  figures: { 'months of supply': '4.1' },
  citations: [{ figure: '4.1', computed_at: '2026-10-06T14:00:00.000Z' }],
}

const assets: MotionAssets = {
  fonts: { amboqia: 'a', amboqiaI: 'a', azo: 'a', geist400: 'a', geist500: 'a', geist600: 'a' },
  wordmark: 'w',
  headshots: {},
}

function deps(overrides: Partial<ComposeMotionDeps> = {}): ComposeMotionDeps {
  return {
    resolveFfmpeg: async () => '/usr/bin/ffmpeg',
    probe: async () => ({ duration: 6, width: 1080, height: 1920 }),
    loadAssets: async () => assets,
    launchBrowser: async () => {
      throw new Error('not used: render is faked')
    },
    render: vi.fn(async (input: RenderMotionInput) => ({
      body: Buffer.from('final'),
      stills: input.stills.map((s) => ({ ...s, jpg: Buffer.from('jpg') })),
      renderedText: ['Bend, Oregon', '4.1', 'months of supply', "Seller's market", 'As of Oct 6, 2026', '4', '6'],
      fonts: [{ family: 'RR Geist', weight: '600', status: 'loaded' }],
      frames: 180,
      captured: 41,
      ms: 1234,
    })),
    ...overrides,
  }
}

const input = { spec: { lead: 'market' as const, closer: 'brand' as const }, subject, video: Buffer.from('plate') }

describe('composeMotion', () => {
  it('lays the type over the footage and reports what it drew', async () => {
    const d = deps()
    const result = await composeMotion(input, d)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.body.toString()).toBe('final')
    expect(result.stills.map((s) => s.cueId)).toEqual(['lead1', 'closer'])
    expect(result.record.cues.map((c) => c.kind)).toEqual(['meter', 'closer'])
    expect(result.record.cues[0].figureKeys).toEqual(['months of supply'])
    expect(result.record).toMatchObject({ frames: 180, captured: 41 })
    const call = (d.render as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call).toMatchObject({ width: 1080, height: 1920, fps: 30 })
    expect(call.html).toContain('id="lead1-card"')
  })

  it('notes a card whose still could not be pulled', async () => {
    const result = await composeMotion(
      input,
      deps({
        render: async (i: RenderMotionInput) => ({
          body: Buffer.from('final'),
          stills: i.stills.filter((s) => s.cueId !== 'closer').map((s) => ({ ...s, jpg: Buffer.from('') })),
          renderedText: ['4.1'],
          fonts: [],
          frames: 180,
          captured: 1,
          ms: 1,
        }),
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.record.notes).toContain('No still for closer: ffmpeg could not pull it.')
  })

  it('reports no-ffmpeg instead of throwing', async () => {
    const result = await composeMotion(input, deps({ resolveFfmpeg: async () => null }))
    expect(result).toMatchObject({ ok: false, reason: 'no-ffmpeg' })
  })

  it('refuses footage that is not 9:16 rather than cropping it', async () => {
    const result = await composeMotion(input, deps({ probe: async () => ({ duration: 6, width: 1080, height: 1080 }) }))
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-frame' })
  })

  it('a number the page drew that is not a verified figure is a figure leak', async () => {
    const leaky = deps({
      render: async (i) => ({
        body: Buffer.from('final'),
        stills: i.stills.map((s) => ({ ...s, jpg: Buffer.from('') })),
        renderedText: ['4.1', 'Up 12% this year'],
        fonts: [],
        frames: 180,
        captured: 1,
        ms: 1,
      }),
    })
    const result = await composeMotion(input, leaky)
    expect(result).toMatchObject({ ok: false, reason: 'figure-leak' })
    if (!result.ok) expect(result.error).toContain('12%')
  })

  it('a render failure is reported as failed with the reason', async () => {
    const result = await composeMotion(
      input,
      deps({
        render: async () => {
          throw new Error('Fonts did not load: RR Amboqia 400 (error)')
        },
      }),
    )
    expect(result).toMatchObject({ ok: false, reason: 'failed' })
    if (!result.ok) expect(result.error).toContain('Fonts did not load')
  })
})
