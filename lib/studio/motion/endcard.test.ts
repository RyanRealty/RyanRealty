import { describe, expect, it } from 'vitest'
import {
  ENDCARD,
  endcardBeats,
  endcardLayout,
  endcardState,
  endcardTimes,
  endcardWordBoxes,
  type EndcardOptions,
} from './endcard'
import { cueTexts, figureLeaks, frameState, planEndcardOnly, planMotion, stillTimes } from './cues'

/** Every frame of the card at fps, from its start to its out. */
function frames(opts: EndcardOptions = {}, fps = 30): number[] {
  const T = endcardTimes(opts)
  const out: number[] = []
  for (let f = Math.round(T.start * fps); f < Math.round(T.out * fps); f++) out.push(f / fps)
  return out
}

/** The spec's song-cue example: hits snapped to a song instead of the defaults. */
const SONG: EndcardOptions = { start: 34.521, at: { local: 34.93, service: 35.34, call: 36.165, out: 39.452 } }

describe('endcardTimes', () => {
  it('defaults: words at 0 / 0.4 / 0.8 s, Call now at 1.25 s, out at 3.05 s', () => {
    expect(endcardTimes()).toMatchObject({
      start: 0,
      quality: 0,
      local: 0.4,
      service: 0.8,
      call: 1.25,
      out: 3.05,
      loopFrom: 2.75,
      duration: 3.05,
      fps: 30,
      frames: { start: 0, quality: 0, local: 12, service: 24, call: 38, out: 92, loopFrom: 83 },
    })
  })

  it('carries the manifest endcard shape: start, quality, local, service, call, out', () => {
    const t = endcardTimes({ start: 24.45 })
    expect(Object.keys(t)).toEqual(expect.arrayContaining(['start', 'quality', 'local', 'service', 'call', 'out']))
    expect(t).toMatchObject({ start: 24.45, quality: 24.45, local: 24.85, service: 25.25, call: 25.7, out: 27.5 })
  })

  it('honours offsets from start and absolute times, absolute winning', () => {
    expect(endcardTimes({ start: 10, offsets: { local: 0.3, service: 0.7 } })).toMatchObject({ local: 10.3, service: 10.7, call: 11.25 })
    expect(endcardTimes(SONG)).toMatchObject({ start: 34.521, quality: 34.521, local: 34.93, service: 35.34, call: 36.165, out: 39.452 })
    expect(endcardTimes({ start: 5, offsets: { call: 1.3 }, at: { call: 6.4 }, duration: 3.5 })).toMatchObject({ call: 6.4, out: 8.5 })
  })

  it('throws when the words are out of order', () => {
    expect(() => endcardTimes({ offsets: { local: 0.9, service: 0.8 } })).toThrow(/out of order/)
    expect(() => endcardTimes({ start: 1, at: { quality: 0.5 } })).toThrow(/out of order/)
  })

  it('throws when the words run into the call', () => {
    expect(() => endcardTimes({ offsets: { service: 1.0 } })).toThrow(/run into call/)
  })

  it('throws when the hold after Call now is under 1.5 s', () => {
    expect(() => endcardTimes({ duration: 2.7 })).toThrow(/at least 1.5s/)
    expect(() => endcardTimes({ duration: 2.75 })).not.toThrow()
  })
})

describe('endcardLayout', () => {
  const L = endcardLayout()

  it('fits the words at 82 px with Local on the band centre, inside x 120..950', () => {
    expect(L.fs).toBe(82)
    expect(L.band).toBe(535)
    expect(L.words.map((w) => w.text)).toEqual(['Quality', 'Local', 'Service'])
    expect(L.words[1].cx).toBe(535)
    const left = L.words[0].cx - L.words[0].left
    const right = L.words[2].cx + L.words[2].right
    // The spec's "about 124..928": the line spans 130..922 with a 0.3 em gap.
    expect(left).toBeGreaterThanOrEqual(120)
    expect(left).toBeLessThan(135)
    expect(right).toBeLessThanOrEqual(950)
    expect(right).toBeGreaterThan(915)
  })

  it('holds Service at about 0.78x so it clears Quality by 22 px', () => {
    expect(L.serviceHoldScale).toBeGreaterThan(0.74)
    expect(L.serviceHoldScale).toBeLessThan(0.8)
    const qRight = L.words[0].cx + L.words[0].right
    const sLeft = L.band - L.serviceHoldScale * L.words[2].left
    expect(sLeft - qRight).toBeCloseTo(22, 6)
  })

  it('throws when the word line cannot fit at the minimum size', () => {
    expect(() => endcardLayout({ xMin: 300, xMax: 780 })).toThrow(/cannot fit/)
  })

  it('throws on empty or dashed copy, and on a word it has never measured', () => {
    expect(() => endcardLayout({ cta: '' })).toThrow(/empty/)
    expect(() => endcardLayout({ phone: '541-703-3095' })).toThrow(/dash/)
    expect(() => endcardLayout({ words: ['Quality', 'Local\u2014', 'Service'] })).toThrow(/dash/)
    expect(() => endcardLayout({ words: ['Quality', 'Local', '  '] })).toThrow(/empty/)
    expect(() => endcardLayout({ words: ['Quality', 'Honest', 'Service'] })).toThrow(/no measured metrics/)
  })
})

describe('endcardState, every frame', () => {
  for (const [name, opts] of [
    ['default timing', {}],
    ['song cues', SONG],
    ['looping', { loop: true }],
  ] as Array<[string, EndcardOptions]>) {
    it(`${name}: no two visible words closer than 8 px, none outside x 120..950`, () => {
      const L = endcardLayout(opts)
      let minGap = Number.POSITIVE_INFINITY
      for (const t of frames(opts)) {
        const boxes = endcardWordBoxes(endcardState(t, opts), L).filter((b) => b.opacity > 0.01)
        for (const b of boxes) {
          expect(b.left, `${b.word} at ${t}`).toBeGreaterThanOrEqual(ENDCARD.words.xMin)
          expect(b.right, `${b.word} at ${t}`).toBeLessThanOrEqual(ENDCARD.words.xMax)
        }
        // Words keep their order left to right whenever they are on screen together.
        const order = boxes.map((b) => b.word)
        expect(order).toEqual(['Quality', 'Local', 'Service'].filter((w) => order.includes(w)))
        for (let i = 1; i < boxes.length; i++) {
          const gap = boxes[i].left - boxes[i - 1].right
          minGap = Math.min(minGap, gap)
          expect(gap, `${boxes[i - 1].word} / ${boxes[i].word} at ${t}`).toBeGreaterThanOrEqual(ENDCARD.words.minGapPx)
        }
      }
      expect(minGap).toBeLessThan(Number.POSITIVE_INFINITY)
    })
  }

  it('nothing in the top 220 px: the logo never rises above y 220, even mid-spring', () => {
    for (const t of frames()) {
      const s = endcardState(t)
      const top = ENDCARD.frame.centreY + (ENDCARD.logo.top + s.logo.y - ENDCARD.frame.centreY) * s.card.scale
      expect(top).toBeGreaterThanOrEqual(ENDCARD.safe.top)
    }
  })

  it('the call block rests above the bottom 380 px', () => {
    const { pill, phoneTop, phonePx } = ENDCARD.call
    expect(pill.left).toBe(205)
    expect(pill.left + pill.width).toBe(865)
    expect(pill.top + pill.height).toBe(1290)
    expect(phoneTop + phonePx).toBeLessThan(ENDCARD.safe.bottom)
    expect(ENDCARD.frame.height - ENDCARD.safe.bottom).toBe(380)
  })

  it('runs in the order the spec gives', () => {
    const T = endcardTimes()
    const at = (t: number) => endcardState(t)
    // Before the end cue: nothing.
    expect(at(-0.01).card.opacity).toBe(0)
    // Quality pops at centre on the hit, alone.
    const q = at(T.quality)
    expect(q.card.opacity).toBe(1)
    expect(q.quality).toMatchObject({ opacity: 1, cx: 535 })
    expect(q.quality.scale).toBeLessThan(1)
    expect(q.local.opacity).toBe(0)
    expect(q.service.opacity).toBe(0)
    expect(q.pill.opacity).toBe(0)
    // Local flashes in at centre on its hit.
    expect(at(T.local).local).toMatchObject({ opacity: 1, cx: 535 })
    // Service flashes in at centre at its reduced scale; Local is hidden.
    const s = at(T.service)
    expect(s.service).toMatchObject({ opacity: 1, cx: 535 })
    expect(s.service.scale).toBeCloseTo(endcardLayout().serviceHoldScale, 4)
    expect(s.local.opacity).toBe(0)
    // It holds 0.12 s, then grows to full size as it slides right.
    expect(at(T.service + 0.1).service).toMatchObject({ cx: 535 })
    const slid = at(T.service + 0.12 + 0.3)
    expect(slid.service.scale).toBe(1)
    expect(slid.local.opacity).toBe(1)
    // Call now slams up from below and holds; everything is in by Call now + 0.5 s.
    expect(at(T.call - 0.01).pill.opacity).toBe(0)
    const call = at(T.call)
    expect(call.pill).toMatchObject({ opacity: 1, y: ENDCARD.call.slamPx })
    const held = at(T.call + 0.5)
    expect(held.pill.y).toBe(0)
    expect(held.phone.y).toBe(0)
    const L = endcardLayout()
    for (const [key, i] of [['quality', 0], ['local', 1], ['service', 2]] as const) {
      expect(held[key]).toMatchObject({ opacity: 1, scale: 1 })
      expect(held[key].cx).toBeCloseTo(L.words[i].cx, 1)
    }
  })

  it('Local returns only once Service has cleared it, and before Call now', () => {
    const T = endcardTimes()
    const L = endcardLayout()
    let returned: number | null = null
    for (const t of frames()) {
      if (t < T.service) continue
      const s = endcardState(t)
      if (s.local.opacity > 0) {
        returned ??= t
        const [, local, service] = endcardWordBoxes(s, L)
        expect(service.left - local.right).toBeGreaterThanOrEqual(ENDCARD.words.minGapPx)
      }
    }
    expect(returned).not.toBeNull()
    expect(returned!).toBeGreaterThan(T.service + ENDCARD.words.service.holdSeconds)
    expect(returned!).toBeLessThan(T.call)
  })

  it('the logo springs down with a small overshoot, then only bobs a few pixels', () => {
    const ys = frames().map((t) => endcardState(t).logo.y)
    expect(ys[0]).toBe(-ENDCARD.logo.dropPx)
    const overshoot = Math.max(...ys)
    expect(overshoot).toBeGreaterThan(0)
    expect(overshoot).toBeLessThanOrEqual(12)
    const settled = frames().filter((t) => t >= ENDCARD.logo.settleSeconds).map((t) => endcardState(t).logo.y)
    for (const y of settled) expect(Math.abs(y)).toBeLessThanOrEqual(ENDCARD.logo.bobPx + 0.5)
    expect(settled.some((y) => y > 1)).toBe(true)
  })

  it('never holds still: no run of identical frames longer than 0.1 s, so no stretch of the card is frozen', () => {
    const states = frames().map((t) => JSON.stringify(endcardState(t)))
    let run = 1
    for (let i = 1; i < states.length; i++) {
      run = states[i] === states[i - 1] ? run + 1 : 1
      expect(run, `frames ${i - run + 1}..${i} identical`).toBeLessThanOrEqual(3)
    }
  })

  it('is a pure function of t: same t, same numbers, in any order', () => {
    const ts = frames()
    const forward = ts.map((t) => JSON.stringify(endcardState(t)))
    const backward = [...ts].reverse().map((t) => JSON.stringify(endcardState(t))).reverse()
    expect(backward).toEqual(forward)
  })

  it('the loop iris closes over the last 0.3 s only when asked', () => {
    const T = endcardTimes({ loop: true })
    expect(endcardState(T.loopFrom - 0.01, { loop: true }).card.iris).toBeNull()
    const a = endcardState(T.loopFrom + 0.1, { loop: true }).card.iris!
    const b = endcardState(T.loopFrom + 0.2, { loop: true }).card.iris!
    expect(a).toBeGreaterThan(b)
    expect(endcardState(T.out, { loop: true }).card.iris).toBe(0)
    for (const t of frames()) expect(endcardState(t).card.iris).toBeNull()
  })

  it('bobs on the hits after the spring, then the kick grid after Call now', () => {
    const T = endcardTimes()
    expect(endcardBeats(T)).toEqual([0.8, 1.25, 1.7, 2.15, 2.6])
    expect(endcardBeats(T, { beat_s: 0.6 })).toEqual([0.8, 1.25, 1.85, 2.45])
    expect(endcardBeats(T, { beats: [1.0, 1.5, 2.9, 3.4] })).toEqual([0.8, 1.25, 1.5, 2.9])
  })

  it('is navy and cream only, with no dashes or dot separators in its copy', () => {
    expect(ENDCARD.colors).toEqual({ navy: '#102742', cream: '#faf8f4' })
    const copy = [...ENDCARD.copy.words, ENDCARD.copy.cta, ENDCARD.copy.phone]
    for (const text of copy) expect(text).not.toMatch(/[‐-―−·•-]/)
    expect(copy.join(' ')).not.toMatch(/ryan-realty\.com|https?:/)
  })
})

describe('the end card on the motion stage', () => {
  it('plans alone as a 3.05 s paper film with its golden still at Call now + 0.5 s', () => {
    const plan = planEndcardOnly()
    expect(plan.surface).toBe('paper')
    expect(plan.duration).toBe(3.05)
    expect(stillTimes(plan)).toEqual([{ cueId: 'endcard', t: 1.75 }])
  })

  it('drives every part, each from the pure state; the field never scales, the stage does', () => {
    const plan = planEndcardOnly()
    const states = frameState(plan, 1.75)
    expect(states.map((s) => s.id)).toEqual([
      'endcard-card',
      'endcard-stage',
      'endcard-logo',
      'endcard-quality',
      'endcard-local',
      'endcard-service',
      'endcard-pill',
      'endcard-phone',
    ])
    const pure = endcardState(1.75)
    expect(states.find((s) => s.id === 'endcard-quality')).toMatchObject({ x: pure.quality.x, scale: pure.quality.scale, opacity: 1 })
    const field = states.find((s) => s.id === 'endcard-card')!
    expect(field).toMatchObject({ opacity: 1, y: 0 })
    expect(field.scale).toBeUndefined()
    expect(field.clip).toBeUndefined()
    expect(states.find((s) => s.id === 'endcard-stage')).toMatchObject({ scale: pure.card.scale, opacity: 1 })
    // Half-size frames get half-size travel.
    const half = frameState(plan, 1.3, 0.5).find((s) => s.id === 'endcard-pill')!
    expect(half.y).toBeCloseTo(endcardState(1.3).pill.y / 2, 1)
  })

  it('its words and phone are authored copy, not figures', () => {
    const subject = { label: 'Bend, Oregon', figures: { 'months of supply': '4.1' }, citations: [{ figure: '4.1' }] }
    const plan = planMotion({ spec: { lead: 'market', closer: 'brand' }, subject, duration: 6 })
    const card = plan.cues.find((c) => c.kind === 'endcard')!
    expect(cueTexts(card)).toEqual(['Quality', 'Local', 'Service', 'Call now', '541.703.3095'])
    expect(figureLeaks(plan, subject)).toEqual([])
    expect(figureLeaks(plan, subject, ['Call now', '541.703.3095', '4.1'])).toEqual([])
    // A different number on the card is still a leak.
    expect(figureLeaks(plan, subject, ['541.555.0100'])).not.toEqual([])
  })
})
