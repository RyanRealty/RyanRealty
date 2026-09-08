import { describe, it, expect } from 'vitest'
import {
  answerScaleGeometry,
  answerScaleReadAt,
  answerTallyCount,
  formatScaleValue,
  isTallyGroupEnd,
  SNAP_PCT,
  TALLY_MAX,
  type V3AnswerScale,
} from './V3Answers.marks'

const mos = (at: number): V3AnswerScale => ({
  kind: 'scale',
  min: 0,
  max: 12,
  at,
  minLabel: '0 months',
  maxLabel: '12 months',
  bands: [
    { to: 4, label: "seller's" },
    { to: 6, label: 'balanced' },
    { to: 12, label: "buyer's" },
  ],
})

describe('answerScaleGeometry', () => {
  it('places the mark by proportion, not by band', () => {
    expect(answerScaleGeometry(mos(4.9))?.atPct).toBeCloseTo(40.833, 3)
    expect(answerScaleGeometry(mos(0))?.atPct).toBe(0)
    expect(answerScaleGeometry(mos(12))?.atPct).toBe(100)
  })

  it('tiles the bands with no gap and no overlap', () => {
    const bands = answerScaleGeometry(mos(4.9))?.bands ?? []
    expect(bands).toHaveLength(3)
    // Each band starts where the previous one ended, and together they fill the
    // rule: a gap would draw a verdict boundary the thresholds do not have.
    let cursor = 0
    for (const band of bands) {
      expect(band.fromPct).toBeCloseTo(cursor, 6)
      cursor += band.widthPct
    }
    expect(cursor).toBeCloseTo(100, 6)
    expect(bands.map((b) => Math.round(b.widthPct * 100) / 100)).toEqual([33.33, 16.67, 50])
  })

  it('lights the band lib/market/classify.ts would name, at every boundary', () => {
    // Upper bound inclusive, matching marketVerdict: 4.0 is a seller's market,
    // 6.0 is a buyer's. The drawn verdict and the printed word cannot disagree.
    const active = (at: number) =>
      answerScaleGeometry(mos(at))?.bands.find((b) => b.active)?.label
    expect(active(0)).toBe("seller's")
    expect(active(3.9)).toBe("seller's")
    expect(active(4)).toBe("seller's")
    expect(active(4.02)).toBe('balanced')
    expect(active(5.97)).toBe('balanced')
    expect(active(6)).toBe('balanced')
    expect(active(6.01)).toBe("buyer's")
    expect(active(12)).toBe("buyer's")
  })

  it('refuses a value outside its own domain rather than pinning it to an end', () => {
    // A dot on the end of a rule reads as "at the end of the rule". 130 days on
    // a 0-120 rule is not 120 days, so the row ships its sentence alone.
    expect(answerScaleGeometry({ ...mos(4.9), at: 12.5 })).toBeNull()
    expect(answerScaleGeometry({ ...mos(4.9), at: -1 })).toBeNull()
  })

  it('refuses a broken domain or a non-finite value', () => {
    expect(answerScaleGeometry({ ...mos(4.9), min: 12, max: 12 })).toBeNull()
    expect(answerScaleGeometry({ ...mos(4.9), min: 12, max: 0 })).toBeNull()
    expect(answerScaleGeometry({ ...mos(Number.NaN) })).toBeNull()
  })

  it('refuses bands that do not ascend or do not finish at the domain max', () => {
    expect(
      answerScaleGeometry({ ...mos(4.9), bands: [{ to: 6, label: 'a' }, { to: 4, label: 'b' }] }),
    ).toBeNull()
    expect(answerScaleGeometry({ ...mos(4.9), bands: [{ to: 4, label: 'a' }] })).toBeNull()
    expect(answerScaleGeometry({ ...mos(4.9), bands: [{ to: 4, label: '  ' }, { to: 12, label: 'b' }] })).toBeNull()
  })

  it('places a context mark and refuses one outside the domain', () => {
    const withCtx = answerScaleGeometry({
      kind: 'scale',
      min: 0,
      max: 120,
      at: 29,
      minLabel: '0 days',
      maxLabel: '120 days',
      context: { at: 23, label: 'Bend 23' },
    })
    expect(withCtx?.contextPct).toBeCloseTo((23 / 120) * 100, 6)
    expect(
      answerScaleGeometry({
        kind: 'scale',
        min: 85,
        max: 105,
        at: 95,
        minLabel: '85%',
        maxLabel: '105%',
        context: { at: 130, label: 'nope' },
      }),
    ).toBeNull()
  })

  it('draws a bandless rule', () => {
    const g = answerScaleGeometry({
      kind: 'scale',
      min: 0,
      max: 100,
      at: 39.2,
      minLabel: '0%',
      maxLabel: '100%',
    })
    expect(g?.bands).toEqual([])
    expect(g?.atPct).toBeCloseTo(39.2, 6)
    expect(g?.contextPct).toBeNull()
  })
})

describe('answerTallyCount', () => {
  it('draws one mark per home', () => {
    expect(answerTallyCount({ kind: 'tally', count: 60, unitLabel: 'home' })).toBe(60)
    expect(answerTallyCount({ kind: 'tally', count: 1, unitLabel: 'home' })).toBe(1)
  })

  it('refuses a count nobody can read as a count, and an empty one', () => {
    expect(answerTallyCount({ kind: 'tally', count: TALLY_MAX + 1, unitLabel: 'home' })).toBeNull()
    expect(answerTallyCount({ kind: 'tally', count: 0, unitLabel: 'home' })).toBeNull()
    expect(answerTallyCount({ kind: 'tally', count: Number.NaN, unitLabel: 'home' })).toBeNull()
  })
})

/* ── Reading the rule (SITE-08 pass 2) ─────────────────────────────────────
   The crosshair may only ever say two things: a figure this page published,
   or a coordinate the reader chose. These lock that down. */

const saleToList: V3AnswerScale = {
  kind: 'scale',
  min: 85,
  max: 105,
  at: 95,
  minLabel: '85%',
  maxLabel: '105%',
  subjectLabel: 'Awbrey Butte',
  format: { unit: '%', decimals: 1 },
  context: { at: 100, label: 'the asking price' },
}

describe('answerScaleReadAt', () => {
  it('snaps to the published subject rather than reading a coordinate beside it', () => {
    // The subject sits at 50% of this rule. A pointer a hair off it means it.
    const read = answerScaleReadAt(saleToList, 0.5 + (SNAP_PCT - 1) / 100)
    expect(read?.named).toBe('subject')
    expect(read?.value).toBe(95)
    expect(read?.namedLabel).toBe('Awbrey Butte')
    expect(read?.atPct).toBeCloseTo(50, 6)
  })

  it('snaps to the named context mark', () => {
    const read = answerScaleReadAt(saleToList, 0.75)
    expect(read?.named).toBe('context')
    expect(read?.value).toBe(100)
    expect(read?.namedLabel).toBe('the asking price')
  })

  it('reads a free position as a position, with no name attached to it', () => {
    const read = answerScaleReadAt(saleToList, 0.2)
    expect(read?.named).toBeNull()
    expect(read?.namedLabel).toBeNull()
    expect(read?.value).toBeCloseTo(89, 6)
  })

  it('clamps to the ends instead of running off the domain', () => {
    expect(answerScaleReadAt(saleToList, -3)?.value).toBe(85)
    expect(answerScaleReadAt(saleToList, 9)?.value).toBe(105)
  })

  it('names the band the pointer is in, which is not always the band the value is in', () => {
    // 4.9 months lands in "balanced"; the pointer at the far right is in
    // "buyer's". The difference is the reason to run a pointer down the rule.
    expect(answerScaleReadAt(mos(4.9), 0.9)?.band).toBe("buyer's")
    expect(answerScaleReadAt(mos(4.9), 0.408)?.band).toBe('balanced')
    expect(answerScaleReadAt(mos(4.9), 0)?.band).toBe("seller's")
  })

  it('refuses to read a rule that cannot be drawn', () => {
    expect(answerScaleReadAt({ ...saleToList, at: 200 }, 0.5)).toBeNull()
    expect(answerScaleReadAt(saleToList, Number.NaN)).toBeNull()
  })
})

describe('formatScaleValue', () => {
  it('writes a position in the units the figure printed in', () => {
    expect(formatScaleValue(95.04, { unit: '%', decimals: 1 })).toBe('95.0%')
    expect(formatScaleValue(29.6, { unit: ' days', decimals: 0 })).toBe('30 days')
    expect(formatScaleValue(4.86, { unit: ' months', decimals: 1 })).toBe('4.9 months')
  })

  it('survives a missing format and a nonsense one', () => {
    expect(formatScaleValue(60)).toBe('60')
    expect(formatScaleValue(60, { decimals: -2 })).toBe('60')
    expect(formatScaleValue(Number.NaN, { unit: '%' })).toBe('')
  })
})

describe('isTallyGroupEnd', () => {
  it('breaks the run every fifth mark, which is what makes it a tally', () => {
    expect(isTallyGroupEnd(4, 60)).toBe(true)
    expect(isTallyGroupEnd(9, 60)).toBe(true)
    expect(isTallyGroupEnd(3, 60)).toBe(false)
  })

  it('never hangs a gap off the last mark', () => {
    expect(isTallyGroupEnd(59, 60)).toBe(false)
    expect(isTallyGroupEnd(4, 5)).toBe(false)
  })
})
