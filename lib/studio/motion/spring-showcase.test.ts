import { describe, expect, it } from 'vitest'
import {
  SPRING_SHOWCASE as S,
  plotX,
  plotY,
  retargetFrames,
  springShowcaseHtml,
  springShowcaseState,
  springShowcaseTarget,
  springShowcaseTrace,
  springShowcaseY,
} from './spring-showcase'
import { track } from './spring'

const frames = S.seconds * S.fps

describe('the F1 showcase: one dot, four retargets', () => {
  it('retargets four times, each on a whole frame at 30 fps, the third while the second is still in flight', () => {
    expect(S.retargets).toHaveLength(4)
    expect(retargetFrames()).toEqual([18, 57, 66, 120])
    for (const r of S.retargets) expect(r.t * S.fps).toBeCloseTo(Math.round(r.t * S.fps), 9)
    // 0.3 s after the second, the dot is still well short of settled and still moving.
    const speed = (springShowcaseY(S.retargets[2].t - 1e-4) - springShowcaseY(S.retargets[2].t - 2e-4)) / 1e-4
    expect(Math.abs(speed)).toBeGreaterThan(300)
  })

  it('the dot is the spring: its y at every frame is track() of the same keys', () => {
    const keys = [[0, S.rest], ...S.retargets.map((r) => [r.t, r.y] as const)] as Array<readonly [number, number]>
    for (let f = 0; f < frames; f++) {
      const t = f / S.fps
      expect(springShowcaseY(t)).toBe(track(t, keys, S.spring))
      expect(springShowcaseState(t).dotY).toBeCloseTo(track(t, keys, S.spring), 3)
    }
  })

  it('the trace is the same function: every point is plotX / plotY of springShowcaseY at its time', () => {
    const trace = springShowcaseTrace()
    expect(trace).toHaveLength(S.seconds * 120 + 1)
    trace.forEach(([x, y], i) => {
      const t = i / 120
      expect(x).toBeCloseTo(plotX(t), 3)
      expect(y).toBeCloseTo(plotY(springShowcaseY(t)), 3)
    })
  })

  it('one value, read twice: the head sits on the trace at the dot’s own height on every frame', () => {
    for (let f = 0; f < frames; f++) {
      const t = f / S.fps
      const s = springShowcaseState(t)
      expect(s.headY).toBeCloseTo(plotY(s.dotY), 2)
      expect(s.headX).toBeCloseTo(plotX(t), 3)
      expect(s.reveal).toBeCloseTo(s.headX - S.plot.left, 3)
    }
  })

  it('the ring jumps on the frame of each retarget and nowhere else; the dot does not', () => {
    const landing = retargetFrames()
    for (let f = 1; f < frames; f++) {
      const jumped = springShowcaseTarget(f / S.fps) !== springShowcaseTarget((f - 1) / S.fps)
      expect(jumped).toBe(landing.includes(f))
    }
    // The dot never teleports: it moves under 140 px between two frames, retargets included.
    for (let f = 1; f < frames; f++) expect(Math.abs(springShowcaseY(f / S.fps) - springShowcaseY((f - 1) / S.fps))).toBeLessThan(140)
  })

  it('is a pure function of t: the same state in any order, and a state is plain numbers', () => {
    const ts = [4.4, 0, 2.2, 0.6, 5.9, 2.2]
    const first = ts.map((t) => springShowcaseState(t))
    expect([...ts].reverse().map((t) => springShowcaseState(t)).reverse()).toEqual(first)
    for (const s of first) for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true)
    expect(springShowcaseHtml()).toBe(springShowcaseHtml())
  })

  it('stays inside the safe band (S.safe, y 220 to 1540), dot and ring and plot and all', () => {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i <= frames * 8; i++) {
      const y = springShowcaseY(i / (S.fps * 8))
      lo = Math.min(lo, y)
      hi = Math.max(hi, y)
    }
    expect(lo - S.stage.ringR).toBeGreaterThanOrEqual(S.safe.top)
    expect(hi + S.stage.ringR).toBeLessThanOrEqual(S.stage.bottom + 40)
    for (const r of S.retargets) expect(r.y).toBeGreaterThanOrEqual(S.stage.top + S.stage.ringR)
    expect(S.stage.bottom).toBeLessThanOrEqual(S.safe.bottom)
    expect(S.stage.top).toBeGreaterThanOrEqual(S.safe.top)
    // The trace never leaves its plot, and the plot (ticks included) ends above the bottom 380 px.
    for (const [, y] of springShowcaseTrace()) {
      expect(y).toBeGreaterThanOrEqual(S.plot.top)
      expect(y).toBeLessThanOrEqual(S.plot.bottom)
    }
    expect(S.plot.bottom + 40).toBeLessThanOrEqual(S.safe.bottom)
  })

  it('the page is navy and cream only, draws no text and no figure, and has no clock, random or transition', () => {
    const html = springShowcaseHtml()
    const hex = html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(new Set(hex.map((h) => h.toLowerCase()))).toEqual(new Set([S.colors.navy, S.colors.cream]))
    for (const m of html.matchAll(/rgba?\(([^)]*)\)/g)) expect(m[1].replace(/\s/g, '')).toMatch(/^16,39,66,(0?\.\d+|1)$/)
    expect(html).not.toMatch(/<text|<tspan|<foreignObject|<span|<p>|<h\d/i)
    expect(html).not.toMatch(/Date|Math\.random|setTimeout|setInterval|requestAnimationFrame|transition|animation/)
    // No digit sits in any text node (there are no text nodes): the film draws no number at all.
    const body = html.slice(html.indexOf('<body>'), html.indexOf('<script>')).replace(/<[^>]*>/g, '')
    expect(body.trim()).toBe('')
  })
})
