import { describe, expect, it } from 'vitest'
import {
  impliedSixMonthCloses,
  publishMonthsOfSupply,
} from './publish-months-of-supply'
import {
  SOLD_ATTRIBUTION_TRUSTED_GRAINS,
  SOLD_ATTRIBUTION_UNTRUSTED_GRAINS,
} from './geo-grain-trust'

describe('publishMonthsOfSupply', () => {
  it('withholds when the pulse numerator is not the count on screen (Tetherow founding)', () => {
    expect(
      publishMonthsOfSupply({
        grain: 'city',
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
        grain: 'city',
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
        grain: 'city',
        pulseMos: 4.56,
        pulseActiveCount: 19,
        displayedActiveCount: 19,
        soldCount12mo: 36,
      }),
    ).toBe(4.56)
    expect(impliedSixMonthCloses(19, 4.56)).toBeLessThanOrEqual(36)
  })

  it('publishes MOS alone when no count or sold figure is on screen to contradict it', () => {
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 4.02 })).toBe(4.02)
  })

  it('returns null for missing or non-positive MOS', () => {
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: null, pulseActiveCount: 19, displayedActiveCount: 19 })).toBeNull()
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 0, pulseActiveCount: 19, displayedActiveCount: 19 })).toBeNull()
  })
  /**
   * The live defect this guard was added for. bend-century-west's pulse row read
   * 16 actives and 48.00 months of supply on 2026-08-19, and every internal
   * check above passes it: the numerator matches the count on screen, and the
   * implied 2.0 six-month closes sit under the 3 the year reported. Both figures
   * came off the same subdivision-name text join, which found 2 of the 42 closes
   * inside that boundary, so the row agreed with itself and with nothing else.
   * Only the grain catches it.
   */
  it('withholds a neighborhood figure that passes every self-consistency check', () => {
    const centuryWest = {
      pulseMos: 48,
      pulseActiveCount: 16,
      displayedActiveCount: 16,
      soldCount12mo: 3,
    } as const
    expect(publishMonthsOfSupply({ grain: 'city', ...centuryWest })).toBe(48)
    expect(publishMonthsOfSupply({ grain: 'neighborhood', ...centuryWest })).toBeNull()
  })

  it('withholds at every grain whose closed side is not attributed like its actives', () => {
    for (const grain of SOLD_ATTRIBUTION_UNTRUSTED_GRAINS) {
      expect(publishMonthsOfSupply({ grain, pulseMos: 4.02 })).toBeNull()
    }
    for (const grain of SOLD_ATTRIBUTION_TRUSTED_GRAINS) {
      expect(publishMonthsOfSupply({ grain, pulseMos: 4.02 })).toBe(4.02)
    }
  })

  it('publishes no verdict-bearing figure for any of the 28 live neighborhood rows', () => {
    // Real published values, market_pulse_live geo_type='neighborhood', 2026-08-19.
    const liveRows = [60, 53, 48, 43.2, 31.5, 21.43, 20.4, 17.62, 16.73, 12.39, 12.37, 12.32, 12, 11.76, 11.47, 10.41, 9.71, 8, 7.67, 6.86, 6.86, 6.23, 4.56, 2.18, 1.71]
    for (const mos of liveRows) {
      expect(publishMonthsOfSupply({ grain: 'neighborhood', pulseMos: mos })).toBeNull()
    }
  })

  it('publishes a same-source Market Truth neighborhood MOS when the printed count is the numerator', () => {
    // Sunriver 2026-08-23: 56 actives / 45 closes / 7.47, membership is_primary both sides.
    expect(
      publishMonthsOfSupply({
        grain: 'neighborhood',
        source: 'market-truth',
        pulseMos: 7.47,
        pulseActiveCount: 56,
        displayedActiveCount: 56,
      }),
    ).toBe(7.47)
  })

  it('still withholds Market Truth neighborhood MOS when the printed count is not the numerator', () => {
    expect(
      publishMonthsOfSupply({
        grain: 'neighborhood',
        source: 'market-truth',
        pulseMos: 7.47,
        pulseActiveCount: 56,
        displayedActiveCount: 79,
      }),
    ).toBeNull()
  })
})
