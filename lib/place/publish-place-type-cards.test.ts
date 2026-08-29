import { describe, expect, it } from 'vitest'
import { publishPlaceTypeCards } from './publish-place-type-cards'
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'

const land: PublicSegmentRow = {
  segment: 'land',
  activeCount: 40,
  pendingCount: null,
  closedCount: null,
  medianList: 250000,
  monthsOfSupply: null,
  verdict: null,
  sampleN: 40,
  daysToContract: null,
  saleToOriginal: null,
  yoyMedian: null,
  priceCutShare: null,
}

describe('publishPlaceTypeCards', () => {
  it('leads with single-family then extra types, and marks the active card', () => {
    const cards = publishPlaceTypeCards({
      path: '/cities/redmond',
      search: 'propertyType=Land',
      placeName: 'Redmond',
      sfrCount: 255,
      sfrMedian: 598900,
      sfrMos: 4.6,
      segments: [land],
    })
    expect(cards[0]?.key).toBe('sfr')
    expect(cards[0]?.active).toBe(false)
    expect(cards[0]?.href).toContain('propertySubTypes=Single+Family+Residence')
    expect(cards.some((c) => c.key === 'land' && c.active)).toBe(true)
    expect(cards.find((c) => c.key === 'land')?.href).toContain('propertyType=Land')
  })
})
