import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import { buildPlaceMosView } from '@/lib/site/place-mos'
import { zipAlertBuckets, zipAlertListings } from './zip-constants'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = readFileSync(join(HERE, '../page.tsx'), 'utf8')
const FIELD = readFileSync(join(HERE, 'ZipHomesField.tsx'), 'utf8')
const MASONRY = readFileSync(join(HERE, 'ZipHomesMasonry.client.tsx'), 'utf8')
const CATALOG = readFileSync(join(HERE, 'zip-catalog.ts'), 'utf8')
const ALERTS = readFileSync(join(HERE, 'ZipAlertsSheet.client.tsx'), 'utf8')
const CLAIM = readFileSync(join(HERE, 'ZipClaim.client.tsx'), 'utf8')
const CSS = readFileSync(join(HERE, 'zip-opening.css'), 'utf8')
const CONSTANTS = readFileSync(join(HERE, 'zip-constants.ts'), 'utf8')
const INSIGHT = readFileSync(join(HERE, 'zip-insight.ts'), 'utf8')

describe('SITE-73 zip fold composition', () => {
  it('opens with Atlas drawing beside MOS + alerts figure (layout lock)', () => {
    expect(FIELD).toMatch(/zip-opening__stage/)
    expect(FIELD).toMatch(/zip-opening__drawing/)
    expect(FIELD).toMatch(/zip-opening__figure/)
    expect(FIELD).toMatch(/<V3Atlas/)
    expect(FIELD).toMatch(/id="atlas"/)
    expect(FIELD).toMatch(/<V3MosBars/)
    expect(FIELD).toMatch(/\{alerts\}/)
    expect(FIELD).toMatch(/<ZipHomesMasonry/)
    expect(FIELD).not.toMatch(/PlaceFieldMap|google\.com\/maps|MorphingSearch/)
  })

  it('keeps Atlas type toggles + price scrubber; hides competing key counts', () => {
    expect(CSS).toMatch(/\.zip-opening__drawing \.v3-atlas__key/)
    expect(CSS).toMatch(/\.zip-opening__drawing \.v3-atlas__dock/)
    expect(CSS).toMatch(/\.zip-opening__drawing \.v3-atlas__types/)
    expect(CSS).toMatch(/\.zip-opening__drawing \.v3-atlas__scrub/)
    // Dock stays for house-atlas interaction; key counts stay off so MOS owns inventory.
    const keyBlock = CSS.slice(CSS.indexOf('.zip-opening__drawing .v3-atlas__key'))
    expect(keyBlock.slice(0, 120)).toMatch(/display:\s*none/)
    expect(CSS).not.toMatch(
      /\.zip-opening__drawing \.v3-atlas__dock,\s*\n\s*\.zip-opening__drawing \.v3-atlas__aside,\s*\n\s*\.zip-opening__drawing \.v3-atlas__key \{\s*\n\s*display: none/,
    )
    expect(FIELD).toMatch(/keyPlacement="dock"/)
    expect(FIELD).toMatch(/foldAtlas(Dots|Types)/)
    expect(FIELD).toMatch(/recorded boundary\. Hover a mark for the home/)
    expect(FIELD).not.toMatch(/recorded boundary \u2014/)
  })

  it('stacks alerts claim → ask (proof below) so the 30-day figure does not collide with MOS', () => {
    expect(CSS).toMatch(/\.zip-opening__figure \.v3\.v3-alerts \.v3-alerts__grid/)
    expect(CSS).toMatch(/grid-template-areas:\s*'lead' 'ask' 'figure'/)
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(CSS).toMatch(/\.zip-opening__figure \.v3\.v3-mos/)
    expect(CSS).toMatch(/min-height:\s*var\(--v3-tap\)/)
  })

  it('keeps Atlas dock + one listing proof on the phone (no crushed stain)', () => {
    expect(CSS).toMatch(/@media \(max-width: 63\.99rem\)/)
    expect(CSS).toMatch(/min-height:\s*14rem/)
    expect(CSS).not.toMatch(/max-height:\s*min\(7vh/)
    expect(CSS).not.toMatch(/\.zip-opening__drawing \.v3-atlas__dock \{\s*display:\s*none/)
    expect(CSS).toMatch(/\.zip-opening__figure \.v3-alerts__strip > li:nth-child\(n \+ 2\)/)
  })

  it('installs catalog sources on the route (masonry, scroll-animation, number, insight-cards)', () => {
    expect(CATALOG).toContain("from '@/components/motion/infinite-masonry'")
    expect(CATALOG).toContain("from '@/components/motion/scroll-animation'")
    expect(CATALOG).toContain("from '@/components/motion/number'")
    expect(CATALOG).toContain("from '@/components/motion/digit-swap'")
    expect(CATALOG).toContain("from '@/components/motion/insight-cards'")
    expect(MASONRY).toContain("from '@/components/motion/infinite-masonry'")
    expect(MASONRY).toContain("from '@/components/motion/scroll-animation'")
    expect(MASONRY).toContain('id="masonry-open"')
    expect(CLAIM).toMatch(/V3Number/)
    expect(CLAIM).toMatch(/settle/)
    expect(CLAIM).toMatch(/DigitSwap/)
    expect(CLAIM).toContain('id="number-open"')
    expect(MASONRY).toMatch(/spring=\{false\}/)
    expect(MASONRY).toMatch(/zip-opening__progress-tools/)
    expect(CLAIM).toMatch(/glyphClassName/)
    expect(CSS).toMatch(/digit-swap-glyph/)
    expect(CSS).toMatch(/zip-opening__progress-tools/)
    expect(MASONRY).not.toMatch(/<SmoothScroll/)
    expect(PAGE).toMatch(/ZipInsight/)
    expect(PAGE).toMatch(/buildZipInsightBoard/)
    expect(PAGE).toMatch(/zipOpeningCaption/)
    expect(INSIGHT).not.toMatch(/lib\/data\/market-truth|lib\/supabase/)
    expect(ALERTS).toMatch(/V3AlertsStrip/)
    expect(ALERTS).toMatch(/types=\{types\}/)
    expect(PAGE).toMatch(/buildPlaceAlertTypes/)
    expect(PAGE).toMatch(/zipAlertBuckets/)
    expect(PAGE).toMatch(/types=\{alertTypes\}/)
    expect(PAGE).toMatch(/masonryItems=\{masonryItems\}/)
    expect(PAGE).not.toMatch(/populationNote/)
  })

  it('strips Undesignated before a neighborhood row is published', () => {
    expect(CONSTANTS).toMatch(/isVisitorPlaceNoiseLabel/)
  })

  it('keeps inventory counts agreeing: claim, MOS homes, market active', () => {
    expect(PAGE).toMatch(/claimCount=\{activeCount/)
    expect(PAGE).toMatch(/buildPlaceMosView\(\{[\s\S]*?active: hud\.active/)
    expect(PAGE).toMatch(/grain: 'zip'/)
    const view = buildPlaceMosView({
      active: 43,
      monthsSupply: 4.8,
      grain: 'zip',
      geoSlug: '97702',
      asOf: 'Sep 10, 2026',
    })
    expect(view).not.toBeNull()
    expect(view!.homesForSale).toBe(43)
    expect(view!.homesLabel).toBe('43')
    expect(view!.source).toContain('Oregon Data Share')
    expect(view!.source).not.toMatch(/leftoverHudKpis|market_metric/)
  })

  it('adds crawlable SEO doors without inventing a portal search hero', () => {
    expect(FIELD).toMatch(/housing-market/)
    expect(FIELD).toMatch(/months-of-supply/)
    expect(PAGE).toMatch(/Live single-family inventory in ZIP/)
    expect(PAGE).not.toMatch(/MorphingSearch|morphing-search/)
    expect(CSS).not.toMatch(/-webkit-line-clamp:\s*1/)
  })
})

describe('zipAlertBuckets (information increment)', () => {
  function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
    return {
      listNumber: '220000001',
      listPrice: 500000,
      streetNumber: '100',
      streetName: 'Main',
      streetSuffix: 'St',
      city: 'Bend',
      photoUrl: 'https://cdn.example/photo.jpg',
      lat: 44.05,
      lng: -121.3,
      beds: 3,
      baths: 2,
      sqft: 1800,
      subdivisionName: null,
      onMarketDate: '2026-09-01T00:00:00.000Z',
      status: 'Active',
      ...partial,
    } as ListingTile
  }

  it('publishes newest photographed houses with price + beds/baths/sqft', () => {
    const listings = zipAlertListings([
      tile({ listingKey: 'a', onMarketDate: '2026-09-01T00:00:00.000Z', listPrice: 600000 }),
      tile({ listingKey: 'b', onMarketDate: '2026-09-05T00:00:00.000Z', listPrice: 550000, beds: 4 }),
      tile({ listingKey: 'c', photoUrl: null }),
    ])
    expect(listings).toHaveLength(2)
    expect(listings[0]?.title).toMatch(/Main/)
    expect(listings[0]?.price).toBeTruthy()
    expect(listings[0]?.beds).toBe(4)
    expect(listings[0]?.baths).toBe(2)
    expect(listings[0]?.sqft).toBe(1800)
    expect(listings[0]?.photoSrc).not.toMatch(/320x240/)
  })

  it('builds a houses bucket for buildPlaceAlertTypes', () => {
    const buckets = zipAlertBuckets([tile({ listingKey: 'a' })])
    expect(buckets).toHaveLength(1)
    expect(buckets[0]?.key).toBe('houses')
    expect(buckets[0]?.listings.length).toBe(1)
  })
})
