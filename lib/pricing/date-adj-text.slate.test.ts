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
    // A concession is already inside timeAdjustedPrice. The percent has to
    // match the two dollars it sits between, not the raw close.
    const conceded = describeAppliedDateAdjustments([
      { address: '2642 Keats', closePrice: 637_000, timeAdjustment: -8_680, timeAdjustedPrice: 611_320 },
    ])
    expect(conceded).toMatch(/2642 Keats moved -1\.4 percent, from \$620,000 to \$611,320/)
    expect(conceded).not.toMatch(/from \$637,000/)
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
    expect(note).toMatch(/Living area was not adjusted/)
    expect(note).not.toMatch(/exclusive pocket|pump prices|story class|city index/i)
    expect(note).not.toMatch(/not applied here|Each sale stays on its own/)
    expect(note).not.toMatch(/[—–]/)

    const flat = exclusivePocketSetNote('Bend', false)
    expect(flat).toMatch(/not moved with other Bend sales/)
    expect(flat).toMatch(/Each sale stays at the price it sold for/)
    expect(flat).not.toMatch(/exclusive pocket|pump prices|story class|city index/i)
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
