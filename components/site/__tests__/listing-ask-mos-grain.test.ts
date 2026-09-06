import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { buildListingAskClaim } from '@/components/site/listing-detail/listing-ask'

const HUD: LeftoverHudKpis = {
  active: 12,
  pending: 3,
  closed30: 4,
  new30: null,
  medianList: 1_000_000,
  saleToList: 98.2,
  daysToPending: 19,
  monthsSupply: 4.4,
  sold12mo: 40,
}

describe('listing ask claim MOS grain trust', () => {
  it('withholds months of supply at neighborhood / community grain', () => {
    const claim = buildListingAskClaim({
      ask: 1_200_000,
      wholePropertyPrice: 1_200_000,
      hud: HUD,
      grain: {
        name: 'Tetherow',
        hubHref: '/communities/tetherow',
        geoSlug: 'tetherow',
        geoType: 'neighborhood',
      },
    })
    expect(claim?.figures.some((f) => f.label === 'months of supply')).toBe(false)
    expect(claim?.figures.some((f) => f.label === 'homes for sale')).toBe(true)
    expect(claim?.figures.some((f) => String(f.label).includes('median list'))).toBe(true)
  })

  it('prints months of supply at city grain', () => {
    const claim = buildListingAskClaim({
      ask: 700_000,
      wholePropertyPrice: 700_000,
      hud: HUD,
      grain: { name: 'Bend', hubHref: '/cities/bend', geoSlug: 'bend', geoType: 'city' },
    })
    expect(claim?.figures.some((f) => f.label === 'months of supply')).toBe(true)
  })
})
