import { describe, expect, it } from 'vitest'
import { compTierLadder, WIDENED_SQFT_BAND } from './comp-tiers'

describe('the disclosed widening (Matt 2026-09-09)', () => {
  it('stays off a named plat, and is the last rung when the subject has no plat', () => {
    const named = compTierLadder('Awbrey Butte')
    expect(named.some((t) => t.name.includes('widened-disclosed'))).toBe(false)
    expect(named[named.length - 1]?.name).toBe('adjacent-subdivision-24mo')
    expect(named.map((t) => t.name).indexOf('subdivision-24mo')).toBeLessThan(
      named.map((t) => t.name).indexOf('adjacent-subdivision-6mo'),
    )

    const ladder = compTierLadder(null)
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
      expect(t.disclosure).toMatch(/resort community your home is not part of/)
      expect(t.disclosure).toMatch(/Fannie Mae B4-1\.3-08/)
    }
    // Nothing bounded may follow it: it is the end of the ladder for its class.
    const lastIndex = ladder.map((t) => t.name).findLastIndex((n) => n.includes('widened-disclosed'))
    expect(lastIndex).toBe(ladder.length - 1)
  })

  it('is the only rung allowed to cross the resort-membership rule', () => {
    for (const t of compTierLadder('Tetherow')) {
      expect(!!t.relaxResort).toBe(t.name.includes('widened-disclosed'))
      if (t.relaxResort) expect(t.whenStarved).toBe(true)
    }
  })
})

describe('a 2-4 unit home walks past its plats (Matt 2026-10-14, the multi-unit ladder)', () => {
  it('a named duplex finishes its plat and the touching plats, then the neighborhood, the community, the rings and the widening', () => {
    const names = compTierLadder('Center Addition', { multiUnit: true }).map((t) => t.name)
    expect(names.slice(0, 8)).toEqual([
      'subdivision-6mo',
      'subdivision-12mo',
      'subdivision-18mo',
      'subdivision-24mo',
      'adjacent-subdivision-6mo',
      'adjacent-subdivision-12mo',
      'adjacent-subdivision-18mo',
      'adjacent-subdivision-24mo',
    ])
    expect(names[8]).toBe('neighborhood-6mo')
    for (const rung of ['neighborhood-24mo', 'community-24mo', 'competing-area-12mo', 'citywide-12mo', 'widened-disclosed-24mo']) {
      expect(names).toContain(rung)
    }
    // No pocket or quarter-mile ring: those are for a home with no recorded plat.
    expect(names.some((n) => n.startsWith('pocket-') || n.startsWith('nearby-'))).toBe(false)
    expect(names.indexOf('adjacent-subdivision-24mo')).toBeLessThan(names.indexOf('neighborhood-6mo'))
    expect(names.indexOf('citywide-12mo')).toBeLessThan(names.indexOf('widened-disclosed-24mo'))
  })

  it('a named house still stops at the touching plats, and an unnamed home\'s ladder is unchanged', () => {
    expect(compTierLadder('Center Addition').map((t) => t.name)).toEqual(compTierLadder('Center Addition', { multiUnit: false }).map((t) => t.name))
    expect(compTierLadder('Center Addition')[compTierLadder('Center Addition').length - 1]?.name).toBe('adjacent-subdivision-24mo')
    expect(compTierLadder(null, { multiUnit: true }).map((t) => t.name)).toEqual(compTierLadder(null).map((t) => t.name))
  })
})
