/**
 * One home, one sale — the rule that stops a grid printing "60924 Targee"
 * twice at a $167,500 difference (tasteReview round three, §3).
 */
import { describe, expect, it } from 'vitest'
import { dropPriorSalesOfSameHome, isSameProperty, normalizeAddress } from './same-address'

/** The live cma-19968 set, keys and all. */
const TARGEE_JUNE = {
  listingKey: '20260527193628217804000000',
  address: '60924 Targee',
  closeDate: '2026-06-26',
  sqft: 1394,
}
const TARGEE_MARCH = {
  listingKey: '20260216224417444083000000',
  address: '60924 Targee',
  closeDate: '2026-03-17',
  sqft: 1394,
}
const OTHERS = [
  { listingKey: 'A', address: '61111 Chuckanut', closeDate: '2026-08-21', sqft: 1440 },
  { listingKey: 'B', address: '60931 Aspen', closeDate: '2026-04-15', sqft: 1782 },
  { listingKey: 'C', address: '19760 Mahogany', closeDate: '2026-03-06', sqft: 1344 },
]

describe('dropPriorSalesOfSameHome', () => {
  it('keeps the most recent close and drops the earlier sale of the same home', () => {
    const out = dropPriorSalesOfSameHome([OTHERS[0]!, TARGEE_JUNE, OTHERS[1]!, TARGEE_MARCH, OTHERS[2]!])
    expect(out.kept.map((s) => s.listingKey)).toEqual(['A', TARGEE_JUNE.listingKey, 'B', 'C'])
    expect(out.dropped).toHaveLength(1)
    expect(out.dropped[0]).toMatchObject({
      listingKey: TARGEE_MARCH.listingKey,
      address: '60924 Targee',
      keptListingKey: TARGEE_JUNE.listingKey,
    })
    expect(out.dropped[0]!.reason).toContain('sold again on 2026-06-26')
  })

  it('drops the earlier sale whichever order the two arrive in', () => {
    const a = dropPriorSalesOfSameHome([TARGEE_MARCH, TARGEE_JUNE])
    const b = dropPriorSalesOfSameHome([TARGEE_JUNE, TARGEE_MARCH])
    expect(a.kept.map((s) => s.listingKey)).toEqual([TARGEE_JUNE.listingKey])
    expect(b.kept.map((s) => s.listingKey)).toEqual([TARGEE_JUNE.listingKey])
  })

  it('keeps both when the record carries a unit number on either side', () => {
    const out = dropPriorSalesOfSameHome([
      { ...TARGEE_JUNE, unitNumber: 'A' },
      { ...TARGEE_MARCH, unitNumber: 'B' },
    ])
    expect(out.kept).toHaveLength(2)
    expect(out.dropped).toEqual([])
  })

  it('keeps both when the living areas say they are different homes', () => {
    const out = dropPriorSalesOfSameHome([TARGEE_JUNE, { ...TARGEE_MARCH, sqft: 2100 }])
    expect(out.kept).toHaveLength(2)
  })

  it('a remeasure inside two percent is still one home', () => {
    const out = dropPriorSalesOfSameHome([TARGEE_JUNE, { ...TARGEE_MARCH, sqft: 1410 }])
    expect(out.kept).toHaveLength(1)
  })

  it('leaves a set with no duplicate untouched', () => {
    const out = dropPriorSalesOfSameHome(OTHERS)
    expect(out.kept).toEqual(OTHERS)
    expect(out.dropped).toEqual([])
  })

  it('drops both older sales when a home sold three times', () => {
    const older = { ...TARGEE_MARCH, listingKey: 'OLD', closeDate: '2025-05-01' }
    const out = dropPriorSalesOfSameHome([TARGEE_MARCH, older, TARGEE_JUNE])
    expect(out.kept.map((s) => s.listingKey)).toEqual([TARGEE_JUNE.listingKey])
    expect(out.dropped.map((d) => d.listingKey).sort()).toEqual(
      ['OLD', TARGEE_MARCH.listingKey].sort(),
    )
  })

  it('normalizes case, spacing and trailing punctuation, and nothing else', () => {
    expect(normalizeAddress('  60924   Targee, ')).toBe('60924 targee')
    expect(isSameProperty(TARGEE_JUNE, { ...TARGEE_MARCH, address: '60924  TARGEE.' })).toBe(true)
    expect(isSameProperty(TARGEE_JUNE, { ...TARGEE_MARCH, address: '60924 Targee Ct' })).toBe(false)
  })
})
