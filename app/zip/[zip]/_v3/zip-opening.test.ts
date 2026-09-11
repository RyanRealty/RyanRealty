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
const ALERTS = readFileSync(join(HERE, 'ZipAlertsSheet.client.tsx'), 'utf8')
const CLAIM = readFileSync(join(HERE, 'ZipClaim.client.tsx'), 'utf8')
const CSS = readFileSync(join(HERE, 'zip-opening.css'), 'utf8')

describe('SITE-73 zip fold composition', () => {
  it('opens with Atlas drawing beside MOS + alerts figure (layout lock)', () => {
    expect(FIELD).toMatch(/zip-opening__stage/)
    expect(FIELD).toMatch(/zip-opening__drawing/)
    expect(FIELD).toMatch(/zip-opening__figure/)
    expect(FIELD).toMatch(/<V3Atlas/)
    expect(FIELD).toMatch(/id="atlas"/)
    expect(FIELD).toMatch(/<V3MosBars/)
    expect(FIELD).toMatch(/\{alerts\}/)
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
  })

  it('stacks alerts claim → ask (proof below) so the 30-day figure does not collide with MOS', () => {
    expect(CSS).toMatch(/\.zip-opening__figure \.v3\.v3-alerts \.v3-alerts__grid/)
    expect(CSS).toMatch(/grid-template-areas:\s*'lead' 'ask' 'figure'/)
    expect(CSS).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(CSS).toMatch(/\.zip-opening__figure \.v3\.v3-mos/)
    expect(CSS).toMatch(/min-height:\s*var\(--v3-tap\)/)
  })

  it('puts the alerts ask in the mobile first viewport (drop MOS source / extra thumbs)', () => {
    expect(CSS).toMatch(/@media \(max-width: 63\.99rem\)/)
    expect(CSS).toMatch(/\.zip-opening__figure \.v3-mos \.v3-source/)
    expect(CSS).toMatch(/\.zip-opening__figure \.v3-alerts__strip > li:nth-child\(n \+ 2\)/)
  })

  it('wires V3Number on the claim and alert types with proof listings', () => {
    expect(CLAIM).toMatch(/V3Number/)
    expect(ALERTS).toMatch(/V3AlertsStrip/)
    expect(ALERTS).toMatch(/types=\{types\}/)
    expect(PAGE).toMatch(/buildPlaceAlertTypes/)
    expect(PAGE).toMatch(/zipAlertBuckets/)
    expect(PAGE).toMatch(/types=\{alertTypes\}/)
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
