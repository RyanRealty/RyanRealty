import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildOregonCityBuyerPlace,
  buildOregonCityClaim,
  buildOregonCityHonestyDescription,
  buildOregonCityItemListName,
  buildOregonCityListingReveal,
  buildOregonCitySupplyDrawing,
  buildOregonCityTitle,
} from './oregon-city-fold'

const PAGE = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const ROUTE_CSS = readFileSync(new URL('../oregon-city.css', import.meta.url), 'utf8')
const HONESTY = readFileSync(new URL('./OregonCityHonesty.tsx', import.meta.url), 'utf8')
const HONESTY_CSS = readFileSync(new URL('./OregonCityHonesty.css', import.meta.url), 'utf8')
const CATALOG = readFileSync(new URL('../../../../design_system/public/taste-catalog.json', import.meta.url), 'utf8')
const LISTINGS = readFileSync(new URL('./OregonCityListings.tsx', import.meta.url), 'utf8')
const LISTINGS_CSS = readFileSync(new URL('./OregonCityListings.css', import.meta.url), 'utf8')

describe('oregon-city fold helpers', () => {
  it('puts the live count in the title for SEO', () => {
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 725 })).toBe(
      '725 Medford homes for sale, outside our market',
    )
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 0 })).toBe(
      'Medford homes for sale, outside our market',
    )
    expect(buildOregonCityTitle({ name: 'Medford', activeAllCount: 725 })).not.toContain('\u2014')
  })

  it('states the out-of-market claim without orphaned snapshot numerals', () => {
    const claim = buildOregonCityClaim({ name: 'Medford' })
    expect(claim).toBe(
      'Live listings from the statewide MLS. We work Central Oregon, not Medford. Hover a bar for the window and the stamp.',
    )
    expect(claim).not.toMatch(/\d/)
    expect(claim).not.toMatch(/\$/)
  })

  it('states the live count in the honesty description', () => {
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 718 })).toBe(
      '718 live listings below are from the statewide MLS. We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
    expect(buildOregonCityHonestyDescription({ name: 'Medford', activeAllCount: 0 })).toBe(
      'We work Central Oregon, not Medford. Ask for a local broker introduction.',
    )
  })

  it('draws two hoverable bars whose notes are a catalog data window', () => {
    const drawing = buildOregonCitySupplyDrawing({
      name: 'Medford',
      activeAllCount: 718,
      activeSfrCount: 339,
      source: 'snapshot',
      asOf: 'Sep 14, 2026',
      medianAsk: '$469,000',
    })
    expect(drawing?.draw).toBe('pair')
    expect(drawing?.bars).toHaveLength(2)
    expect(drawing?.bars?.[0]?.value).toBe(718)
    expect(drawing?.bars?.[1]?.value).toBe(339)
    expect(drawing?.claim).not.toMatch(/718|339|\$469/)
    expect(drawing?.bars?.[0]?.note).toBe('718 · all types · Sep 14, 2026')
    expect(drawing?.bars?.[1]?.note).toBe('339 · houses · $469,000')
    expect(drawing?.bars?.[0]?.note).not.toMatch(/sold pace/)
    expect(drawing?.bars?.[1]?.note).not.toMatch(/newest twelve/)
    expect(
      buildOregonCitySupplyDrawing({
        name: 'Medford',
        activeAllCount: 0,
        activeSfrCount: 0,
        source: 'snapshot',
      }),
    ).toBeNull()
  })

  it('turns MLS plat slugs into buyer language', () => {
    expect(
      buildOregonCityBuyerPlace({ subdivisionName: 'EARHART PARK SUBDIVISION', city: 'Medford' }),
    ).toBe('Earhart Park')
    expect(
      buildOregonCityBuyerPlace({ subdivisionName: "D'ANJOU VILLAGE UNIT NO 1", city: 'Medford' }),
    ).toBe("D'Anjou Village")
    expect(
      buildOregonCityBuyerPlace({ subdivisionName: 'KERRISDALE RIDGE SUBDIVISION', city: 'Medford' }),
    ).toBe('Kerrisdale Ridge')
    expect(buildOregonCityBuyerPlace({ subdivisionName: null, city: 'Medford' })).toBeNull()
    expect(buildOregonCityBuyerPlace({ subdivisionName: 'MEDFORD', city: 'Medford' })).toBeNull()
  })

  it('reveals a sourced extra fact the resting row does not already say', () => {
    expect(
      buildOregonCityListingReveal({
        yearBuilt: 1998,
        lotSizeAcres: 0.24,
        garageSpaces: 2,
        pricePerSqft: 245,
        city: 'Medford',
      }),
    ).toBe('Built in 1998')
    expect(
      buildOregonCityListingReveal({
        yearBuilt: null,
        lotSizeAcres: 0.24,
        garageSpaces: 2,
        pricePerSqft: 245,
        city: 'Medford',
      }),
    ).toBe('0.24 acres')
    expect(
      buildOregonCityListingReveal({
        yearBuilt: null,
        lotSizeAcres: null,
        garageSpaces: null,
        pricePerSqft: null,
        city: 'Medford',
      }),
    ).toBeNull()
  })

  it('puts price and beds/baths/sqft on the ItemList name', () => {
    expect(
      buildOregonCityItemListName({
        address: '3311 Biddle Rd, Medford',
        price: '$1,850,000',
        detail: '4 bd · 3 ba · 3,200 sqft',
      }),
    ).toBe('3311 Biddle Rd, Medford · $1,850,000 · 4 bd · 3 ba · 3,200 sqft')
  })
})

describe('oregon-city page holds the SITE-105 catalog object', () => {
  it('puts an interactive drawing first and does not fold a KPI grid', () => {
    expect(PAGE).toContain('chartFirst={placeMos != null || supplyDrawing != null}')
    expect(PAGE).toContain('V3MosBars')
    expect(PAGE).toContain('V3Drawing')
    expect(PAGE).toContain('getMarketPulse')
    expect(PAGE).toContain('buildPlaceMosView')
    expect(PAGE).toContain('buildOregonCitySupplyDrawing')
    expect(ROUTE_CSS).toContain('.v3-instrument__figures')
    expect(ROUTE_CSS).toContain('display: none')
    expect(PAGE).not.toMatch(/foldAfter=/)
    expect(PAGE).not.toMatch(/v3-instrument__fold-summary/)
    expect(PAGE).not.toMatch(/kind:\s*'range'/)
    expect(PAGE).not.toContain("label: v3Text('Get a broker introduction')")
    expect(ROUTE_CSS).toContain('.v3-instrument__source')
    expect(ROUTE_CSS).not.toContain('#listings.v3-ledger--magazine')
    expect(PAGE).toContain('buildOregonCityItemListName')
    expect(PAGE).toContain('buildOregonCityTitle')
    expect(PAGE).toContain('OregonCityHonesty')
    expect(PAGE).toContain('OregonCityListings')
    expect(PAGE).toContain('headline={v3Text(headline)}')
    expect(PAGE).toContain('buildOregonCityTitle({ name: city.name, activeAllCount: city.activeAllCount })')
    expect(LISTINGS).toContain("from '@/components/ui/card'")
    expect(LISTINGS).toContain("from '@/components/ui/empty'")
    expect(LISTINGS).toContain('<CardFooter>')
    expect(LISTINGS).toContain('<CardContent>')
    expect(LISTINGS).not.toContain('hidden group-hover/card:block')
    expect(LISTINGS).not.toContain('oregon-city-listings__lead')
    expect(LISTINGS_CSS).not.toContain('grid-column: 1 / -1')
    expect(LISTINGS_CSS).not.toContain('grid-template-columns: minmax(0, 1.35fr)')
    expect(PAGE).toContain('id="about"')
    expect(PAGE).toContain('id="listings"')
    expect(PAGE).not.toContain('layout="magazine"')
    expect(PAGE).not.toContain('buildOregonCityBuyerPlace')
    expect(PAGE).toContain('buildOregonCityListingReveal')
    expect(PAGE.indexOf('id="listings"')).toBeLessThan(PAGE.indexOf('HOME_MARKET_EDGES]}'))
  })

  it('uses the installed Alert composition with no house Action restack', () => {
    expect(HONESTY).toContain("from '@/components/ui/alert'")
    expect(HONESTY).toContain("from '@/components/ui/button'")
    expect(HONESTY).toContain("from 'lucide-react'")
    expect(HONESTY).toContain('<AlertAction')
    expect(HONESTY).toContain('variant="outline"')
    expect(HONESTY).toContain('oregon-city-honesty')
    expect(HONESTY).not.toContain('v3-quiet')
    expect(HONESTY).not.toContain('V3Quiet.css')
    expect(HONESTY).not.toContain('has-data-[slot=alert-action]:pr-2.5')
    expect(HONESTY).not.toContain('static top-auto right-auto')
    expect(HONESTY_CSS).not.toMatch(/background:\s*var\(--v3-cream\)/)
    expect(HONESTY_CSS).not.toMatch(/position:\s*static/)
    expect(HONESTY_CSS).not.toMatch(/grid-column:\s*2/)
    expect(HONESTY_CSS).not.toMatch(/padding:\s*var\(--v3-space-md\)/)
    expect(HONESTY_CSS).toContain('max-width: var(--v3-measure)')
    expect(HONESTY_CSS).not.toContain('max-width: 32rem')
  })

  it('asks the judge to hover the bars, a Card, and the empty listing states', () => {
    expect(CATALOG).toContain('figures-open=#top .v3-instrument__drawing button!hover')
    expect(CATALOG).toContain('listings=#listings [data-slot=card]:has([data-slot=card-content])!hover')
    expect(CATALOG).toContain('empty=#listings [data-demo-state=empty]!click')
    expect(CATALOG).toContain('feed-miss=#listings [data-demo-state=feed-miss]!click')
    expect(CATALOG).not.toContain('v3-instrument__fold-summary!click')
  })
})
