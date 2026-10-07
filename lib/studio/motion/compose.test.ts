import { describe, expect, it, vi } from 'vitest'
import { composeMotion, type ComposeMotionDeps } from './compose'
import type { MotionSubject } from './cues'
import type { MotionAssets } from './assets'
import type { RenderMotionInput } from './render'
import type { ScoreInput, ScoreResult } from '../score'

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
    composeScore: vi.fn(
      (i: ScoreInput): ScoreResult => ({
        wav: Buffer.from('RIFF'),
        samples: Math.round(i.duration * 48000),
        report: { key: 'D major', chords: ['Dmaj9', 'D'], lufs: -14, truePeakDb: -2.4, events: [], warnings: [] },
      }),
    ),
    ...overrides,
  }
}

/** Twenty-four months of a believable line, with one withheld month. */
const series = {
  title: 'Median sale price',
  scope: 'Detached single-family homes sold in Bend, by month',
  // Only the first and last ticks are drawn; they name the labelled months.
  points: Array.from({ length: 24 }, (_, i) => ({
    tick: i === 0 ? 'Oct 2024' : i === 23 ? 'Sep 2026' : `month ${i}`,
    value: i === 9 ? null : 650000 + i * 3000 + (i % 6) * 9000,
  })),
  firstKey: 'median sale price, Oct 2024',
  lastKey: 'median sale price, Sep 2026',
}

const trendSubject: MotionSubject = {
  ...subject,
  figures: { ...subject.figures, 'median sale price, Oct 2024': '$650,000', 'median sale price, Sep 2026': '$734,000' },
  citations: [
    ...subject.citations,
    { figure: '$650,000', computed_at: '2026-10-01T00:00:00.000Z' },
    { figure: '$734,000', computed_at: '2026-10-01T00:00:00.000Z' },
  ],
  series,
}

const input = { spec: { lead: 'market' as const, closer: 'brand' as const }, subject, video: Buffer.from('plate') }
const scored = { ...input, spec: { ...input.spec, sound: 'measured' as const }, seed: 'draft-1' }

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

  it('a silent format renders with no audio and says so', async () => {
    const d = deps()
    const result = await composeMotion(input, d)
    expect((d.composeScore as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
    expect((d.render as ReturnType<typeof vi.fn>).mock.calls[0][0].audioPath).toBeNull()
    if (result.ok) expect(result.record.score).toEqual({ silent: 'This format has no score.' })
  })

  it('scores a format with sound, seeded by the draft, to the frame count', async () => {
    const d = deps()
    const result = await composeMotion(scored, d)
    expect(result.ok).toBe(true)
    const scoreCall = (d.composeScore as ReturnType<typeof vi.fn>).mock.calls[0][0] as ScoreInput
    expect(scoreCall).toMatchObject({ seed: 'draft-1', mood: 'measured', duration: 6 })
    expect(scoreCall.events.some((e) => e.kind === 'lockup')).toBe(true)
    const renderCall = (d.render as ReturnType<typeof vi.fn>).mock.calls[0][0] as RenderMotionInput
    expect(renderCall.audioPath).toMatch(/score\.wav$/)
    if (result.ok) expect(result.record.score).toMatchObject({ key: 'D major', lufs: -14 })
  })

  it('a score that cannot be made leaves a silent film, never a lost one', async () => {
    const d = deps({
      composeScore: () => {
        throw new Error('limiter did not converge')
      },
    })
    const result = await composeMotion(scored, d)
    expect(result.ok).toBe(true)
    expect((d.render as ReturnType<typeof vi.fn>).mock.calls[0][0].audioPath).toBeNull()
    if (result.ok) expect(result.record.score).toEqual({ silent: 'The score could not be made: limiter did not converge' })
  })

  it('draws a paper film whole: no footage, no probe, its own length', async () => {
    const probe = vi.fn()
    const d = deps({ probe })
    const result = await composeMotion(
      { spec: { lead: 'trend', closer: 'brand', sound: 'measured' }, subject: trendSubject, video: null, seed: 'draft-2' },
      d,
    )
    expect(result).toMatchObject({ ok: true })
    expect(probe).not.toHaveBeenCalled()
    const call = (d.render as ReturnType<typeof vi.fn>).mock.calls[0][0] as RenderMotionInput
    expect(call.basePath).toBeNull()
    expect(call.plan.surface).toBe('paper')
    expect(call.html).toContain('class="paper"')
    if (result.ok) {
      expect(result.record.cues.map((c) => c.kind)).toEqual(['chart', 'meter', 'closer'])
      expect(result.record.duration).toBe(call.plan.duration)
    }
    // Every plotted month gets its own note: 23 of the 24 published.
    const events = ((d.composeScore as ReturnType<typeof vi.fn>).mock.calls[0][0] as ScoreInput).events
    expect(events.filter((e) => e.kind === 'datum')).toHaveLength(23)
  })

  it('a paper film with nothing to draw says so rather than rendering an empty page', async () => {
    const result = await composeMotion(
      { spec: { lead: 'map', closer: 'brand' }, subject, video: null },
      deps(),
    )
    expect(result).toMatchObject({ ok: false, reason: 'nothing-to-draw' })
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
