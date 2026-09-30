import { describe, expect, it } from 'vitest'
import { bandIdx, PRICE_BANDS, SUPPLY_TIERS } from './bands'

describe('price band ladder', () => {
  it('has 28 contiguous bands starting at zero', () => {
    expect(PRICE_BANDS).toHaveLength(28)
    PRICE_BANDS.forEach((b, i) => {
      expect(b.idx).toBe(i)
      if (i > 0) expect(b.min).toBe(PRICE_BANDS[i - 1]!.max)
    })
    expect(PRICE_BANDS[0]!.min).toBe(0)
    expect(PRICE_BANDS[27]!.max).toBeNull()
  })

  it('places every band floor in its own band and the cent below it in the band before', () => {
    for (const b of PRICE_BANDS) {
      if (b.min > 0) {
        expect(bandIdx(b.min)).toBe(b.idx)
        expect(bandIdx(b.min - 0.01)).toBe(b.idx - 1)
      }
    }
  })

  it('matches the SQL ladder at the boundaries named in the migration', () => {
    expect(bandIdx(99_999)).toBe(0)
    expect(bandIdx(100_000)).toBe(1)
    expect(bandIdx(999_999)).toBe(18)
    expect(bandIdx(1_000_000)).toBe(19)
    expect(bandIdx(1_799_999)).toBe(22)
    expect(bandIdx(1_800_000)).toBe(23)
    expect(bandIdx(2_000_000)).toBe(24)
    expect(bandIdx(2_500_000)).toBe(25)
    expect(bandIdx(3_000_000)).toBe(26)
    expect(bandIdx(4_000_000)).toBe(27)
    expect(bandIdx(0)).toBeNull()
    expect(bandIdx(null)).toBeNull()
  })

  it('labels bands the way a person says them', () => {
    expect(PRICE_BANDS[0]!.label).toBe('Under $100K')
    expect(PRICE_BANDS[1]!.label).toBe('$100K to $150K')
    expect(PRICE_BANDS[18]!.label).toBe('$950K to $1M')
    expect(PRICE_BANDS[19]!.label).toBe('$1M to $1.2M')
    expect(PRICE_BANDS[27]!.label).toBe('$4M and up')
  })

  it('builds supply tiers from whole, non-overlapping runs of bands covering the ladder', () => {
    let next = 0
    for (const t of SUPPLY_TIERS) {
      expect(t.from).toBe(next)
      expect(t.to).toBeGreaterThanOrEqual(t.from)
      next = t.to + 1
    }
    expect(next).toBe(PRICE_BANDS.length)
    const tierFloor = (key: string) => PRICE_BANDS[SUPPLY_TIERS.find((t) => t.key === key)!.from]!.min
    expect(tierFloor('400k-500k')).toBe(400_000)
    expect(tierFloor('600k-750k')).toBe(600_000)
    expect(tierFloor('750k-1m')).toBe(750_000)
    expect(tierFloor('1m-1.4m')).toBe(1_000_000)
    expect(tierFloor('1.4m-2m')).toBe(1_400_000)
    expect(tierFloor('2m-3m')).toBe(2_000_000)
    expect(tierFloor('3m-plus')).toBe(3_000_000)
  })
})
