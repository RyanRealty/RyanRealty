import { describe, expect, it } from 'vitest'
import { buildContactFilter, contactFrames, findFont, labelText } from './contact'
import type { Manifest } from './manifest'

/** A test environment: Next's types make NODE_ENV required on ProcessEnv. */
const env = (vars: Record<string, string>): NodeJS.ProcessEnv => vars as unknown as NodeJS.ProcessEnv

const manifest = {
  beats: [
    { id: 'hook', role: 'hook', start: 0, end: 3.1 },
    { id: 'body', role: 'body', start: 3.1, end: 24.45 },
    { id: 'end', role: 'endcard', start: 24.45, end: 27.5 },
  ],
  endcard: { start: 24.45, quality: 24.45, local: 24.85, service: 25.25, call: 25.7, out: 27.5 },
} as unknown as Manifest

describe('contactFrames', () => {
  it('samples t=0, each beat start + 0.3 and midpoint, hook_max_s, call + 0.5 and the last frame, in time order', () => {
    const f = contactFrames(manifest, 2, 27.5, 30)
    const ts = f.map((x) => x.t)
    expect(ts).toEqual([...ts].sort((a, b) => a - b))
    for (const want of [0, 0.3, 1.55, 2, 3.4, 13.775, 24.75, 25.975, 26.2]) {
      expect(ts.some((t) => Math.abs(t - want) < 0.01), `t=${want}`).toBe(true)
    }
    expect(ts[ts.length - 1]).toBeCloseTo(27.5 - 1 / 30, 3)
  })

  it('merges frames closer than 0.05 s and clamps into the film', () => {
    const f = contactFrames(manifest, 0.3, 27.5, 30)
    expect(f.filter((x) => Math.abs(x.t - 0.3) < 0.05)).toHaveLength(1)
    const short = contactFrames(manifest, 2, 10, 30)
    expect(Math.max(...short.map((x) => x.t))).toBeLessThanOrEqual(10 - 1 / 30 + 1e-9)
  })

  it('leaves out the end card sample when the manifest has none', () => {
    const f = contactFrames({ ...manifest, endcard: null } as Manifest, 2, 27.5, 30)
    expect(f.some((x) => x.tag === 'call +0.5')).toBe(false)
  })
})

describe('labelText', () => {
  it('shows the time and a tag with only drawtext-safe characters', () => {
    expect(labelText({ t: 3.4, tag: "hook +0.3" })).toBe('3.40s hook +0.3')
    expect(labelText({ t: 1, tag: "it's: 'x'" })).toBe('1.00s its x')
  })
})

describe('buildContactFilter', () => {
  const frames = Array.from({ length: 10 }, (_, i) => ({ t: i, tag: `f${i}` }))

  it('tiles four columns and as many rows as needed', () => {
    const g = buildContactFilter(frames, null)
    expect(g).toContain('tile=4x3')
    expect(g).toContain('concat=n=10')
    expect(g).not.toContain('drawtext')
  })

  it('labels each cell when there is a font', () => {
    const g = buildContactFilter(frames, '/fonts/a.ttf')
    expect(g.match(/drawtext=/g)).toHaveLength(10)
    expect(g).toContain("text='3.00s f3'")
  })
})

describe('findFont', () => {
  it('prefers QA_FONT_FILE when it exists', () => {
    expect(findFont(env({ QA_FONT_FILE: '/x/f.ttf' }), (p) => p === '/x/f.ttf')).toBe('/x/f.ttf')
  })

  it('falls back to a common path, and reports none', () => {
    expect(findFont(env({}), (p) => p.endsWith('DejaVuSans.ttf'))).toMatch(/DejaVuSans\.ttf$/)
    expect(findFont(env({}), () => false)).toBeNull()
    expect(findFont(env({ QA_FONT_FILE: '/missing.ttf' }), () => false)).toBeNull()
  })
})
