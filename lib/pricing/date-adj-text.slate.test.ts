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
    expect(rolen).toMatch(/61234 Slate Rolen moved -4\.3 percent, from \$621,000 to \$594,000/)
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
