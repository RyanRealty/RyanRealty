import { describe, expect, it } from 'vitest'
import {
  ASK_IN_BAND_KIND,
  ASK_IN_BAND_REASON_PLAIN,
  askInBandHold,
  askInBandReason,
  recommendationGapHold,
} from '@/lib/cma/gap-hold'

describe('recommendationGapHold', () => {
  it('holds a recommendation more than 15% under the last ask', () => {
    expect(recommendationGapHold(618_000, 849_000).hold).toBe(true)
    expect(recommendationGapHold(755_000, 999_900).hold).toBe(true)
    expect(recommendationGapHold(791_000, 1_098_000).hold).toBe(true)
  })

  it('holds any recommendation above the last ask', () => {
    const gap = recommendationGapHold(1_000_001, 1_000_000)
    expect(gap.hold).toBe(true)
  })

  it('does not hold exactly 15% under, or a recommendation inside the band', () => {
    expect(recommendationGapHold(850_000, 1_000_000).hold).toBe(false)
    expect(recommendationGapHold(1_000_000, 1_000_000).hold).toBe(false)
    expect(recommendationGapHold(900_000, 1_000_000).hold).toBe(false)
  })

  it('does not invent a hold when the ask or the recommendation is missing', () => {
    expect(recommendationGapHold(null, 849_000).hold).toBe(false)
    expect(recommendationGapHold(618_000, null).hold).toBe(false)
  })
})

describe('askInBandHold (SKILL.md rule 22, Matt 2026-10-07: ask in band is a hold)', () => {
  it('holds a last ask inside the trimmed band, with the three dollar figures in the reason', () => {
    const hold = askInBandHold(925_000, 893_000, 951_000)
    expect(hold.hold).toBe(true)
    if (!hold.hold) return
    expect(hold.reason).toMatch(/inside the sales range/)
    expect(hold.reason).toContain('$925,000')
    expect(hold.reason).toContain('$893,000')
    expect(hold.reason).toContain('$951,000')
    expect(hold.reason).toContain('It was not queued and it was not sent.')
    expect(hold.reason).toBe(askInBandReason(925_000, 893_000, 951_000))
  })

  it('is inclusive at both ends', () => {
    expect(askInBandHold(893_000, 893_000, 951_000).hold).toBe(true)
    expect(askInBandHold(951_000, 893_000, 951_000).hold).toBe(true)
  })

  it('does not hold an ask under the low or over the high', () => {
    // Under the low is the existing failedAskBelowRange path; over the high
    // is rule 16's ordinary case.
    expect(askInBandHold(892_999, 893_000, 951_000).hold).toBe(false)
    expect(askInBandHold(951_001, 893_000, 951_000).hold).toBe(false)
  })

  it('reads the band either way round', () => {
    expect(askInBandHold(925_000, 951_000, 893_000).hold).toBe(true)
  })

  it('does not hold on a null ask, a null band, zero or NaN', () => {
    expect(askInBandHold(null, 893_000, 951_000).hold).toBe(false)
    expect(askInBandHold(925_000, null, 951_000).hold).toBe(false)
    expect(askInBandHold(925_000, 893_000, null).hold).toBe(false)
    expect(askInBandHold(0, 893_000, 951_000).hold).toBe(false)
    expect(askInBandHold(Number.NaN, 893_000, 951_000).hold).toBe(false)
    expect(askInBandHold(925_000, 0, 951_000).hold).toBe(false)
  })

  it('writes a reason with no em dash, for the queue and the contract', () => {
    expect(askInBandReason(925_000, 893_000, 951_000)).not.toMatch(/[—–]/)
    expect(ASK_IN_BAND_REASON_PLAIN).not.toMatch(/[—–]/)
  })
})

describe('recommendationGapHold with the band (the send gates, rule 22)', () => {
  it('holds a row whose build recorded the ask-in-band kind, with the plain reason when the dollars are missing', () => {
    const stored = recommendationGapHold(900_000, 925_000, { low: null, high: null, holdKind: ASK_IN_BAND_KIND })
    expect(stored.hold).toBe(true)
    if (stored.hold) expect(stored.reason).toBe(ASK_IN_BAND_REASON_PLAIN)
    const withDollars = recommendationGapHold(900_000, 925_000, { low: 893_000, high: 951_000, holdKind: ASK_IN_BAND_KIND })
    expect(withDollars.hold).toBe(true)
    if (withDollars.hold) expect(withDollars.reason).toContain('$925,000')
  })

  it('the stored kind wins even when the live numbers would not hold, and then says only the plain reason', () => {
    const held = recommendationGapHold(900_000, 1_200_000, { low: 893_000, high: 951_000, holdKind: ASK_IN_BAND_KIND })
    expect(held.hold).toBe(true)
    // $1,200,000 is not inside $893,000 to $951,000: no sentence says it is.
    if (held.hold) expect(held.reason).toBe(ASK_IN_BAND_REASON_PLAIN)
  })

  it('does not run the backstop on a row whose build decided no hold', () => {
    expect(
      recommendationGapHold(900_000, 925_000, { low: 893_000, high: 951_000, origin: 'expired', holdDecided: true }).hold,
    ).toBe(false)
    expect(
      recommendationGapHold(900_000, 925_000, { low: 893_000, high: 951_000, origin: 'expired', holdDecided: false }).hold,
    ).toBe(true)
  })

  it('holds an expired home whose ask sits inside the stored band (the backstop for rows built before the field)', () => {
    const live = recommendationGapHold(900_000, 925_000, { low: 893_000, high: 951_000, origin: 'expired' })
    expect(live.hold).toBe(true)
    if (live.hold) expect(live.reason).toMatch(/inside the sales range/)
  })

  it("does not hold an FSBO's current ask inside the band on the live check (rule 16's thesis is a home that did not sell)", () => {
    expect(recommendationGapHold(900_000, 925_000, { low: 893_000, high: 951_000, origin: 'fsbo' }).hold).toBe(false)
  })

  it('still applies the two rule 3 reasons before the backstop', () => {
    const over = recommendationGapHold(960_000, 925_000, { low: 893_000, high: 951_000, origin: 'expired' })
    expect(over.hold).toBe(true)
    if (over.hold) expect(over.reason).toMatch(/above the last ask/)
    const deep = recommendationGapHold(600_000, 925_000, { low: 593_000, high: 951_000, origin: 'expired' })
    expect(deep.hold).toBe(true)
    if (deep.hold) expect(deep.reason).toMatch(/more than 15% under/)
  })

  it('leaves the four existing cases unchanged with no band', () => {
    expect(recommendationGapHold(618_000, 849_000, null).hold).toBe(true)
    expect(recommendationGapHold(1_000_001, 1_000_000, undefined).hold).toBe(true)
    expect(recommendationGapHold(850_000, 1_000_000, null).hold).toBe(false)
    expect(recommendationGapHold(null, 849_000, null).hold).toBe(false)
  })
})
