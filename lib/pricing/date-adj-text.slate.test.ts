import { describe, expect, it } from 'vitest'
import {
  describeAppliedDateAdjustments,
  exclusivePocketSetNote,
  floorExclusivePocketBandToSameSubCloses,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import { buildTimeAdjustmentBasis } from '@/lib/pricing/estimate'

describe('date-adjustment text vs math: Slate and Oakside', () => {
  it('names the comps and the percentage that were actually applied', () => {
    const rolen = describeAppliedDateAdjustments([
      { address: '61234 Slate Rolen', closePrice: 621_000, timeAdjustment: -27_000, timeAdjustedPrice: 594_000 },
      { address: '100 Other', closePrice: 620_000, timeAdjustment: 0, timeAdjustedPrice: 620_000 },
    ])
    expect(rolen).toMatch(/61234 Slate Rolen moved -4\.3 percent for date, from \$621,000 to \$594,000/)
    expect(rolen).not.toMatch(/not applied|stays on its own|no date adjustment/i)
    expect(rolen).not.toMatch(/[—–]/)

    const oakside = describeAppliedDateAdjustments([
      { address: '1 Meridian', closePrice: 505_000, timeAdjustment: -22_000, timeAdjustedPrice: 483_000 },
      { address: '2 Meridian', closePrice: 505_000, timeAdjustment: -22_000, timeAdjustedPrice: 483_000 },
      { address: '3 Meridian', closePrice: 505_000, timeAdjustment: -22_000, timeAdjustedPrice: 483_000 },
      { address: '2821 Aldrich', closePrice: 430_000, timeAdjustment: 0, timeAdjustedPrice: 430_000 },
    ])
    expect(oakside).toMatch(/Date adjustment was applied to 3 sales/)
    expect(oakside).toMatch(/1 Meridian moved -4\.4 percent/)
    expect(oakside).not.toMatch(/2821 Aldrich/)

    const note = exclusivePocketSetNote('Bend', true, [
      { address: '61234 Slate Rolen', closePrice: 621_000, timeAdjustment: -27_000, timeAdjustedPrice: 594_000 },
    ])
    expect(note).toMatch(/61234 Slate Rolen moved -4\.3 percent/)
    expect(note).not.toMatch(/not applied here|Each sale stays on its own/)
    expect(note).not.toMatch(/[—–]/)

    const flat = exclusivePocketSetNote('Bend', false)
    expect(flat).toMatch(/Date adjustment is not applied along the Bend city index/)
    expect(flat).not.toMatch(/[—–]/)

    const basis = buildTimeAdjustmentBasis({
      citySlug: 'bend',
      cityName: 'Bend',
      points: [],
      asOf: '2026-09-25',
      exclusivePocket: true,
      applied: [
        { address: '61234 Slate Rolen', closePrice: 621_000, timeAdjustment: -27_000, timeAdjustedPrice: 594_000 },
      ],
    })
    expect(basis.sentence).toMatch(/61234 Slate Rolen moved -4\.3 percent/)
    expect(basis.sentence).not.toMatch(/Each sale stays on its own/)
  })

  it('2382 Jackson: every "moved X percent, from A to B" is true of A and B', () => {
    // The stored pairs from cma-2382-jackson (2026-10-07): the date move runs
    // from the price after a recorded seller concession, and timeAdjustedPrice
    // is that start plus the move. The old line printed the move over the
    // close and ran it from the close: "2266 Jackson moved -8.1 percent, from
    // $690,000 to $619,448" ($690,000 to $619,448 is -10.2 percent) and
    // "2224 Indigo moved -1.4 percent, from $503,000 to $484,866" (-3.6).
    const moves = [
      { address: '2224 Indigo', closePrice: 503_000, timeAdjustment: -6_884, timeAdjustedPrice: 484_866 },
      { address: '2254 Indigo', closePrice: 670_000, timeAdjustment: -9_380, timeAdjustedPrice: 660_620 },
      { address: '2266 Jackson', closePrice: 690_000, timeAdjustment: -55_552, timeAdjustedPrice: 619_448 },
      { address: '2225 Indigo', closePrice: 545_000, timeAdjustment: -6_431, timeAdjustedPrice: 538_569 },
      { address: '2591 Purcell', closePrice: 575_000, timeAdjustment: -35_247, timeAdjustedPrice: 539_753 },
    ]
    const line = describeAppliedDateAdjustments(moves)!
    expect(line).toContain(
      '2266 Jackson moved -8.2 percent for date, from $675,000 to $619,448, after $15,000 in seller concessions came off its $690,000 sale',
    )
    expect(line).toContain(
      '2224 Indigo moved -1.4 percent for date, from $491,750 to $484,866, after $11,250 in seller concessions came off its $503,000 sale',
    )
    expect(line).toContain('2254 Indigo moved -1.4 percent for date, from $670,000 to $660,620')
    expect(line).not.toContain('from $690,000 to $619,448')
    expect(line).not.toContain('from $503,000 to $484,866')
    expect(line).not.toContain('-8.1 percent')

    // Every printed pair recomputes to its printed percent.
    const pairs = [...line.matchAll(/moved (-?[\d.]+) percent for date, from \$([\d,]+) to \$([\d,]+)/g)]
    expect(pairs).toHaveLength(5)
    for (const [, pct, from, to] of pairs) {
      const a = Number(from!.replaceAll(',', ''))
      const b = Number(to!.replaceAll(',', ''))
      expect((((b - a) / a) * 100).toFixed(1)).toBe(pct)
    }
  })

  it('Slate shape: the floor does not lift above a meaningful same-subdivision adjusted sale', () => {
    const out = floorExclusivePocketBandToSameSubCloses({
      valueLow: 594_000,
      valueHigh: 623_000,
      sameSubdivisionClosePrices: [621_000, 619_000, 630_000],
      sameSubdivisionAdjustedPrices: [594_000, 619_000, 623_000],
      coolingApplied: true,
    })
    expect(out.floored).toBe(false)
    expect(out.valueLow).toBe(594_000)
    expect(out.valueHigh).toBe(623_000)
  })

  it('still lifts a band that sits under every meaningful same-subdivision adjusted sale', () => {
    const out = floorExclusivePocketBandToSameSubCloses({
      valueLow: 560_000,
      valueHigh: 623_000,
      sameSubdivisionClosePrices: [621_000, 619_000],
      sameSubdivisionAdjustedPrices: [594_000, 619_000, 623_000],
      coolingApplied: true,
    })
    expect(out.floored).toBe(true)
    expect(out.valueLow).toBe(594_000)
    expect(out.valueHigh).toBe(623_000)
  })
})
