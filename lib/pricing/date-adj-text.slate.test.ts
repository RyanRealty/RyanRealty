import { describe, expect, it } from 'vitest'
import {
  exclusivePocketSetNote,
  floorExclusivePocketBandToSameSubCloses,
} from '@/lib/pricing/exclusive-pocket-date-adj'

describe('date-adjustment text vs math — Slate shape', () => {
  it('set note names cooling when cooling is applied, and does not claim it is skipped', () => {
    const cooling = exclusivePocketSetNote('Bend', true)
    expect(cooling).toMatch(/Flex-style cooling date adjustment is applied to every sale/)
    expect(cooling).not.toMatch(/does not walk/)
    expect(cooling).not.toMatch(/not applied here/)
    expect(cooling).not.toMatch(/[—–]/)
    const flat = exclusivePocketSetNote('Bend', false)
    expect(flat).toMatch(/Date adjustment is not applied along the Bend city index/)
    expect(flat).not.toMatch(/[—–]/)
  })

  it('Slate shape: band cannot sit below every same-subdivision close after cooling', () => {
    const out = floorExclusivePocketBandToSameSubCloses({
      valueLow: 594_000,
      valueHigh: 623_000,
      sameSubdivisionClosePrices: [621_000, 619_000, 630_000],
      coolingApplied: true,
    })
    expect(out.floored).toBe(true)
    expect(out.valueLow).toBe(619_000)
    expect(out.valueLow).toBeGreaterThanOrEqual(619_000)
    expect(out.valueHigh).toBe(623_000)
  })
})
