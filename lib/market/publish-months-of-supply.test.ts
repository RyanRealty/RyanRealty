import { describe, expect, it } from 'vitest'
import {
  MIN_MOS_SIX_MONTH_CLOSES,
  impliedSixMonthCloses,
  publishMonthsOfSupply,
} from './publish-months-of-supply'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'
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
        pulseActiveCount: 190,
        displayedActiveCount: 190,
        soldCount12mo: 360,
      }),
    ).toBe(4.56)
    expect(impliedSixMonthCloses(190, 4.56)).toBeLessThanOrEqual(360)
    // The original 19-active fixture implies 25 six-month closes: under the
    // Market Truth floor of 30 since DATA-7, so it no longer publishes.
    expect(
      publishMonthsOfSupply({ grain: 'city', pulseMos: 4.56, pulseActiveCount: 19, displayedActiveCount: 19, soldCount12mo: 36 }),
    ).toBeNull()
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
    // Since DATA-7 the sample floor also catches the live row at any grain
    // (16 * 6 / 48 = 2 implied six-month closes).
    expect(publishMonthsOfSupply({ grain: 'city', ...centuryWest })).toBeNull()
    expect(publishMonthsOfSupply({ grain: 'neighborhood', ...centuryWest })).toBeNull()
    // Scaled past the floor (400 active, 50 implied closes, 75 in the year), the
    // self-consistency checks still pass it, and only the grain withholds it.
    const scaled = { pulseMos: 48, pulseActiveCount: 400, displayedActiveCount: 400, soldCount12mo: 75 } as const
    expect(publishMonthsOfSupply({ grain: 'city', ...scaled })).toBe(48)
    expect(publishMonthsOfSupply({ grain: 'neighborhood', ...scaled })).toBeNull()
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

describe('publishMonthsOfSupply sample floor (DATA-7)', () => {
  it('takes its floor from the Market Truth registry, not a second copy', () => {
    expect(MIN_MOS_SIX_MONTH_CLOSES).toBe(STAT_BY_ID.get('months_of_supply')?.minN)
    expect(MIN_MOS_SIX_MONTH_CLOSES).toBe(30)
  })

  it('withholds the terrebonne row: 30.0 months on 5 actives and 1 close', () => {
    // market_pulse_live city/terrebonne, 2026-09-23: active 5, months_of_supply 30.
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 30, pulseActiveCount: 5, closedSixMonths: 1 })).toBeNull()
  })

  it('publishes at exactly the floor and above it', () => {
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 4.26, closedSixMonths: 30 })).toBe(4.26)
    // Bend Market Truth cell after the 2026-09-23 membership refresh: 754 / (1063 / 6).
    expect(
      publishMonthsOfSupply({
        grain: 'city',
        source: 'market-truth',
        pulseMos: 4.25587958607714,
        pulseActiveCount: 754,
        displayedActiveCount: 754,
        closedSixMonths: 1063,
      }),
    ).toBe(4.25587958607714)
  })

  it('withholds one close under the floor even at a trusted grain from Market Truth', () => {
    expect(
      publishMonthsOfSupply({ grain: 'city', source: 'market-truth', pulseMos: 3.91, closedSixMonths: 29 }),
    ).toBeNull()
  })

  it('leaves callers that pass neither the close count nor the active count on the existing checks', () => {
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 4.02, closedSixMonths: null })).toBe(4.02)
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 4.02 })).toBe(4.02)
  })

  it('recovers a pulse figure\'s close count from its own ratio when none is passed', () => {
    // terrebonne pulse row: 5 active, 30.0 months -> 5 * 6 / 30 = 1 close.
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 30, pulseActiveCount: 5 })).toBeNull()
    // 100 active, 20.00 months -> exactly 30 closes: publishes.
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 20, pulseActiveCount: 100 })).toBe(20)
    // Rounded 2-place ratio one hair under 30 (100 / (30/6) stored as 20.01) still publishes.
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 20.01, pulseActiveCount: 100 })).toBe(20.01)
    // 29 closes: withheld.
    expect(publishMonthsOfSupply({ grain: 'city', pulseMos: 20.69, pulseActiveCount: 100 })).toBeNull()
  })

  it('does not second-guess a Market Truth cell, which its writer already gated at min_n', () => {
    expect(
      publishMonthsOfSupply({ grain: 'neighborhood', source: 'market-truth', pulseMos: 6.47, pulseActiveCount: 55 }),
    ).toBe(6.47)
  })

  it('still refuses an untrusted grain before looking at the sample', () => {
    expect(publishMonthsOfSupply({ grain: 'neighborhood', pulseMos: 4.02, closedSixMonths: 500 })).toBeNull()
  })
})
