import { describe, expect, it } from 'vitest'
import { shapeOfficeClosings, type OfficeClosingInput } from './office-closings'

const base: OfficeClosingInput = {
  listNumber: '1',
  city: 'Bend',
  propertySubType: 'Single Family Residence',
  bedrooms: 3,
  listPrice: 500000,
  closePrice: 490000,
  onMarketDate: '2026-01-01',
  contractDate: '2026-01-11',
  closeDate: '2026-02-01',
}

describe('shapeOfficeClosings', () => {
  it('prints days to contract and sale to FINAL list', () => {
    const [row] = shapeOfficeClosings([base])
    expect(row.daysToContract).toBe(10)
    expect(row.saleToList).toBeCloseTo(0.98, 5)
    expect(row.enteredAfterContract).toBe(false)
  })

  it('never invents a market clock for a contract entered before market', () => {
    const [row] = shapeOfficeClosings([
      { ...base, onMarketDate: '2026-05-20', contractDate: '2026-05-15' },
    ])
    expect(row.daysToContract).toBeNull()
    expect(row.enteredAfterContract).toBe(true)
  })

  it('drops rows with no city or close price and caps at the limit', () => {
    const rows = shapeOfficeClosings(
      [
        { ...base, city: null },
        { ...base, closePrice: null },
        ...Array.from({ length: 9 }, (_, i) => ({ ...base, listNumber: String(i + 10) })),
      ],
      6,
    )
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.city === 'Bend')).toBe(true)
  })

  it('carries no street, date or name fields', () => {
    const [row] = shapeOfficeClosings([base])
    expect(Object.keys(row).sort()).toEqual(
      [
        'bedrooms',
        'city',
        'closePrice',
        'daysToContract',
        'enteredAfterContract',
        'key',
        'propertySubType',
        'saleToList',
      ].sort(),
    )
  })
})
