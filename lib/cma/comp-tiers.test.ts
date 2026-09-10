import { describe, expect, it } from 'vitest'
import { compTierLadder, WIDENED_SQFT_BAND } from './comp-tiers'

describe('the disclosed widening (Matt 2026-09-09)', () => {
  it('is the last rung on both ladders, runs only when starved, and says what it traded', () => {
    for (const ladder of [compTierLadder('Awbrey Butte'), compTierLadder(null)]) {
      const widening = ladder.filter((t) => t.name.includes('widened-disclosed'))
      expect(widening.length).toBeGreaterThan(0)
      for (const t of widening) {
        expect(t.whenStarved).toBe(true)
        expect(t.relaxResort).toBe(true)
        expect(t.monthsBack).toBe(24)
        // The band the last rung may reach on size. Matt 2026-09-10 cut it
        // from 45% to 25%: a sale half again the subject's size cleared the
        // old band while only half the gap was ever adjusted back, and that
        // was behind most of the ranges still printing wider than 1.2x.
        expect(t.sqftBand).toBe(WIDENED_SQFT_BAND)
        expect(t.disclosure).toMatch(/widened one more step/)
        expect(t.disclosure).toMatch(/resort community this home is not part of/)
        expect(t.disclosure).toMatch(/Fannie Mae B4-1\.3-08/)
      }
      // Nothing bounded may follow it: it is the end of the ladder for its class.
      const lastIndex = ladder.map((t) => t.name).findLastIndex((n) => n.includes('widened-disclosed'))
      expect(lastIndex).toBe(ladder.length - 1)
    }
  })

  it('is the only rung allowed to cross the resort-membership rule', () => {
    for (const t of compTierLadder('Tetherow')) {
      expect(!!t.relaxResort).toBe(t.name.includes('widened-disclosed'))
      if (t.relaxResort) expect(t.whenStarved).toBe(true)
    }
  })
})
