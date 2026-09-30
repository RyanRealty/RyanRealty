/**
 * The dial (Matt 2026-09-23): "a primary image and a description, like a
 * primary card ... a smaller dial with thumbnails of the other photos ...
 * some kind of indicator of how many total cards are in the dial."
 *
 * Server markup only (renderToStaticMarkup): what a crawler and a first
 * paint get. The turning, the keys and the swipe are exercised against a
 * running page; the arithmetic behind them is in V3ListingDial.logic.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { V3PlaceInventory } from '@/components/site/v3/V3PlaceInventory'
import { V3ListingDial } from '@/components/site/v3/V3ListingDial.client'
import {
  PlaceSubdivisionHomes,
  PlaceSubdivisionMap,
} from '@/components/site/v3/PlaceSubdivisionMap.client'

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 579_995,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '12',
    streetName: 'Porter',
    streetSuffix: 'Ln',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Porter James',
    subdivisionSlug: 'porter-james',
    lat: 44.05,
    lng: -121.25,
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/a-o.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 2026,
    garageSpaces: 2,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-porter-ln',
    ...over,
  } as ListingTile
}

const TILES = [
  tile({ listingKey: 'sfr-1' }),
  tile({ listingKey: 'sfr-2', streetNumber: '18', listPrice: 612_000, addressSlug: '18-porter-ln' }),
  tile({ listingKey: 'sfr-3', streetNumber: '22', listPrice: null, addressSlug: '22-porter-ln' }),
  tile({ listingKey: 'duplex-1', streetNumber: '14', propertyType: 'C', propertySubType: 'Duplex', addressSlug: '14-porter-ln' }),
  tile({
    listingKey: 'office-1',
    streetNumber: '16',
    propertyType: 'F',
    propertySubType: null,
    beds: null,
    baths: null,
    photoUrl: null,
    status: 'Active Under Contract',
    addressSlug: '16-porter-ln',
  }),
]

const SECTIONS = placeStockSectionsFromTiles(TILES)
const SFR = SECTIONS.find((s) => s.key === 'sfr')!

function count(html: string, re: RegExp): number {
  return html.match(re)?.length ?? 0
}

describe('V3ListingDial rail position and reel (SITE-194)', () => {
  const dial = (railPosition?: 'left' | 'right' | 'bottom') =>
    renderToStaticMarkup(
      <V3ListingDial id="pv" heading="Homes" label="Homes in Porter James" listings={SFR.rows} railPosition={railPosition} />,
    )

  it('the left rail is the default and carries no modifier; right and bottom do', () => {
    expect(dial()).not.toMatch(/v3-dial--rail-/)
    expect(dial('left')).not.toMatch(/v3-dial--rail-/)
    expect(dial('right')).toContain('v3-dial--rail-right')
    expect(dial('bottom')).toContain('v3-dial--rail-bottom')
  })

  it('a bottom rail is a horizontal tablist on every screen', () => {
    expect(dial('bottom')).toContain('aria-orientation="horizontal"')
    expect(dial('right')).toContain('aria-orientation="vertical"')
  })

  it('the served HTML carries the photograph only: no reel, no player, no play control', () => {
    const html = dial()
    expect(html).not.toContain('v3-dial__reel')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('Play video')
  })
})

describe('V3PlaceInventory layout="dial"', () => {
  const html = renderToStaticMarkup(
    <V3PlaceInventory
      id="homes"
      layout="dial"
      placeName="Porter James"
      sections={SECTIONS}
      source="regional MLS through Oregon Data Share"
    />,
  )

  it('renders one dial per live type, in the stock order, commercial and multi-family included', () => {
    expect(html).toContain('v3-place-stock--dial')
    const order = ['homes-sfr', 'homes-multifamily', 'homes-commercial'].map((id) => html.indexOf(`id="${id}"`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain('Single-family homes')
    expect(html).toContain('Multifamily homes')
    expect(html).toContain('Commercial property')
    expect(count(html, /<h2 /g)).toBe(3)
  })

  it('keeps every listing an <a href> in the served HTML, the hidden cards included', () => {
    for (const row of SECTIONS.flatMap((s) => s.rows)) {
      expect(html).toContain(`href="${row.href}"`)
    }
    expect(count(html, /class="v3-dial__card/g)).toBe(TILES.length)
  })

  it('models the dial as tabs: one tablist, a tab per listing, each controlling its card', () => {
    expect(count(html, /role="tablist"/g)).toBe(1) // only the three-listing type has a dial
    expect(count(html, /role="tab"/g)).toBe(SFR.rows.length)
    expect(count(html, /role="tabpanel"/g)).toBe(SFR.rows.length)
    expect(html).toContain('aria-orientation="vertical"')
    expect(html).toContain('aria-label="Single-family homes in Porter James"')
    for (let i = 0; i < SFR.rows.length; i += 1) {
      expect(html).toContain(`id="homes-sfr-tab-${i}"`)
      expect(html).toContain(`aria-controls="homes-sfr-card-${i}"`)
      expect(html).toContain(`id="homes-sfr-card-${i}"`)
      expect(html).toContain(`aria-labelledby="homes-sfr-tab-${i}"`)
    }
  })

  it('puts the dial before its cards in the DOM (tabs pattern order), the readout in the head', () => {
    // On a wide screen the dial stands on the LEFT of the card, so reading and
    // focus order run dial, then card, the order the eye does; a phone lays
    // the strip under the card with CSS and keeps the same order.
    const start = html.indexOf('id="homes-sfr"')
    const end = html.indexOf('id="homes-multifamily"')
    const one = html.slice(start, end)
    const pos = one.indexOf('class="v3-dial__pos"')
    const rail = one.indexOf('class="v3-dial__rail"')
    const tablist = one.indexOf('role="tablist"')
    const firstPanel = one.indexOf('role="tabpanel"')
    const stage = one.indexOf('class="v3-dial__stage"')
    expect(pos).toBeGreaterThan(one.indexOf('class="v3-dial__head"'))
    expect(pos).toBeLessThan(one.indexOf('class="v3-dial__body"'))
    expect(rail).toBeGreaterThan(-1)
    expect(rail).toBeLessThan(stage)
    expect(tablist).toBeLessThan(firstPanel)
    // Previous, the thumbnails, next: in that order inside the dial.
    const prev = one.indexOf('aria-label="Previous listing"')
    const next = one.indexOf('aria-label="Next listing"')
    expect(prev).toBeGreaterThan(rail)
    expect(prev).toBeLessThan(tablist)
    expect(next).toBeGreaterThan(tablist)
    expect(next).toBeLessThan(stage)
  })

  it('leaves the cut-caption mark to the browser: no thumbnail is served marked', () => {
    expect(html).not.toContain('data-clipped')
  })

  it('opens on the first listing: it alone is selected, tabbable and shown', () => {
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g) ?? []
    expect(tabs).toHaveLength(SFR.rows.length)
    expect(tabs[0]).toContain('aria-selected="true"')
    expect(tabs[0]).toContain('tabindex="0"')
    for (const t of tabs.slice(1)) {
      expect(t).toContain('aria-selected="false"')
      expect(t).toContain('tabindex="-1"')
    }
    const cards = html.match(/<div id="homes-sfr-card-\d+"[^>]*>/g) ?? []
    expect(cards[0]).not.toMatch(/\shidden=/)
    for (const c of cards.slice(1)) expect(c).toMatch(/\shidden=""/)
  })

  it('names each thumbnail by its ask and its street, and never invents an ask', () => {
    const [first, second, third] = SFR.rows
    expect(html).toContain(`aria-label="$579,995, ${first!.addressLine}"`)
    expect(html).toContain(`aria-label="$612,000, ${second!.addressLine}"`)
    expect(html).toContain(`aria-label="Price not published, ${third!.addressLine}"`)
    expect(html).not.toMatch(/Price on request/)
  })

  it('shows the count for the whole dial: "01 / 03", with the rule filled a third', () => {
    expect(html).toMatch(/v3-dial__pos-now">01</)
    expect(html).toMatch(/v3-dial__pos-of"> \/ 03</)
    expect(html).toContain('--v3-dial-p:33.33%')
  })

  it('a type with one listing is the card alone: no dial, no count, no tabs', () => {
    const start = html.indexOf('id="homes-multifamily"')
    const end = html.indexOf('id="homes-commercial"')
    const one = html.slice(start, end)
    expect(one).toContain('v3-dial--single')
    expect(one).not.toContain('role="tab')
    expect(one).not.toContain('v3-dial__pos')
    expect(one).not.toContain('v3-dial__step')
    expect(one).toContain('Duplex')
  })

  it('asks the thumbnail bucket for a thumbnail and the lead bucket for the card', () => {
    const thumbs = html.match(/class="v3-dial__thumb-media"><img[^>]*src="([^"]+)"/g) ?? []
    expect(thumbs.length).toBeGreaterThan(0)
    for (const t of thumbs) expect(t).toContain('/320x240/')
    expect(html).toMatch(/v3-lrow__photo-link[^>]*><img[^>]*src="[^"]*\/800x600\//)
  })

  it('loads no photograph eagerly: the inventory sits far below the fold', () => {
    const imgs = html.match(/<img [^>]*>/g) ?? []
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) expect(img).toContain('loading="lazy"')
  })

  it('prints the row’s facts and "Pending" for an under-contract listing', () => {
    expect(html).toContain('3 bd · 2 ba · 1,800 sqft · $322/sqft')
    expect(html).toContain('Pending')
    expect(html).toContain('No photo published')
  })

  it('keeps the source line, and no em dash reaches the copy', () => {
    expect(html).toContain('Oregon Data Share')
    expect(html).not.toContain('—')
  })

  it('leaves rows and rails as they were', () => {
    const rows = renderToStaticMarkup(
      <V3PlaceInventory placeName="Porter James" sections={SECTIONS} source="regional MLS" />,
    )
    expect(rows).toContain('v3-place-stock__rows')
    expect(rows).not.toContain('v3-dial')
    const rails = renderToStaticMarkup(
      <V3PlaceInventory layout="rails" placeName="Porter James" sections={SECTIONS} source="regional MLS" />,
    )
    expect(rails).toContain('home-rail')
    expect(rails).not.toContain('v3-dial')
  })
})

describe('V3ListingDial on its own', () => {
  it('renders a headless dial as a plain container when the section around it names the set', () => {
    const html = renderToStaticMarkup(
      <V3ListingDial id="d" label="Homes in Porter James" listings={SFR.rows} />,
    )
    expect(html.startsWith('<div id="d"')).toBe(true)
    expect(html).not.toMatch(/<h[23] /)
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Homes in Porter James"')
    expect(html).toContain('aria-live="polite"')
  })

  it('renders an h3 when it sits inside a section that has its own h2', () => {
    const html = renderToStaticMarkup(
      <V3ListingDial id="d" heading="Homes" headingLevel={3} label="Homes" listings={SFR.rows} />,
    )
    expect(html).toMatch(/<section id="d"[^>]*aria-labelledby="d-heading"/)
    expect(html).toContain('<h3 id="d-heading"')
  })

  it('gives the previous and next controls names', () => {
    const html = renderToStaticMarkup(<V3ListingDial id="d" label="x" listings={SFR.rows} />)
    expect(html).toContain('aria-label="Previous listing"')
    expect(html).toContain('aria-label="Next listing"')
  })
})

describe('PlaceSubdivisionHomes layout="dial" (neighborhood pages)', () => {
  const homes = SECTIONS.flatMap((s) => s.rows)
  const render = (layout?: 'rails' | 'dial') =>
    renderToStaticMarkup(
      <PlaceSubdivisionMap
        placeName="River West"
        rail={[]}
        homes={homes}
        keysBySlug={{}}
        source="regional MLS through Oregon Data Share"
      >
        <PlaceSubdivisionHomes id="homes" layout={layout} />
      </PlaceSubdivisionMap>,
    )

  it('turns each buyer group into a dial with its own h3 and count', () => {
    const html = render('dial')
    expect(html).toContain('place-homes--dial')
    expect(html).not.toContain('v3-carousel')
    expect(count(html, /<h3 /g)).toBeGreaterThan(1)
    expect(html).toContain('River West')
    for (const row of homes) expect(html).toContain(`href="${row.href}"`)
  })

  it('keeps the carousel as the default for city and community pages', () => {
    const html = render()
    expect(html).toContain('v3-carousel')
    expect(html).not.toContain('v3-dial')
  })
})
