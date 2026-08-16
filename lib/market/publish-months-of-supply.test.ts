import { describe, expect, it } from 'vitest'
import {
  impliedSixMonthCloses,
  publishMonthsOfSupply,
} from './publish-months-of-supply'

describe('publishMonthsOfSupply', () => {
  it('withholds when the pulse numerator is not the count on screen (Tetherow founding)', () => {
    expect(
      publishMonthsOfSupply({
        pulseMos: 4.56,
        pulseActiveCount: 19,
        displayedActiveCount: 35,
        soldCount12mo: 36,
      }),
    ).toBeNull()
  })

  it('withholds when implied six-month closes exceed a printed 12-month sold count', () => {
    expect(
      publishMonthsOfSupply({
        pulseMos: 4.6,
        pulseActiveCount: 35,
        displayedActiveCount: 35,
        soldCount12mo: 36,
      }),
    ).toBeNull()
    expect(impliedSixMonthCloses(35, 4.6)).toBeGreaterThan(36)
  })

  it('publishes when the numerator matches and the year can hold the implied six-month closes', () => {
    expect(
      publishMonthsOfSupply({
        pulseMos: 4.56,
        pulseActiveCount: 19,
        displayedActiveCount: 19,
        soldCount12mo: 36,
      }),
    ).toBe(4.56)
    expect(impliedSixMonthCloses(19, 4.56)).toBeLessThanOrEqual(36)
  })

  it('publishes MOS alone when no count or sold figure is on screen to contradict it', () => {
    expect(publishMonthsOfSupply({ pulseMos: 4.02 })).toBe(4.02)
  })

  it('returns null for missing or non-positive MOS', () => {
    expect(publishMonthsOfSupply({ pulseMos: null, pulseActiveCount: 19, displayedActiveCount: 19 })).toBeNull()
    expect(publishMonthsOfSupply({ pulseMos: 0, pulseActiveCount: 19, displayedActiveCount: 19 })).toBeNull()
  })
})
