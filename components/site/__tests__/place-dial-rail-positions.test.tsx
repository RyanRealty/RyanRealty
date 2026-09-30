/**
 * Matt 2026-09-24: not every dial on a page is the same interaction. A place
 * page that stacks several listing dials hands each one
 * railPosition={dialRailPositionAt(order)}, which cycles bottom, left, right,
 * so two dials one above the other never stand their rails the same way.
 *
 * The dial is replaced here by a recorder, so this reads the prop each place
 * block passes whatever the primitive does with it.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { placeLeaseSectionFromTiles } from '@/lib/place/place-lease-stock'

vi.mock('@/components/site/v3/V3ListingDial.client', () => ({
  V3ListingDial: (props: { id: string; railPosition?: string }) => (
    <div data-dial={props.id} data-rail={props.railPosition ?? 'unset'} />
  ),
}))

const { PlaceSubdivisionHomes, PlaceSubdivisionMap, PlaceSubdivisionRail } = await import(
  '@/components/site/v3/PlaceSubdivisionMap.client'
)
const { V3PlaceInventory } = await import('@/components/site/v3/V3PlaceInventory')

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
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/800x600/true/a-o.jpg',
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
  tile({ listingKey: 'sfr-2', streetNumber: '18', addressSlug: '18-porter-ln' }),
  tile({ listingKey: 'condo-1', streetNumber: '20', propertySubType: 'Condominium', addressSlug: '20-porter-ln' }),
  tile({ listingKey: 'duplex-1', streetNumber: '14', propertyType: 'C', propertySubType: 'Duplex', addressSlug: '14-porter-ln' }),
  tile({ listingKey: 'lot-1', streetNumber: '30', propertyType: 'B', propertySubType: null, beds: null, baths: null, addressSlug: '30-porter-ln' }),
  tile({ listingKey: 'lease-1', streetNumber: '671', propertyType: 'G', propertySubType: null, beds: null, baths: null, listPrice: 1.4, addressSlug: '671-porter-ln' }),
]
const SECTIONS = placeStockSectionsFromTiles(TILES)
const LEASE = placeLeaseSectionFromTiles(TILES, { 'lease-1': '$/SF/Mo' })!
const CYCLE = ['bottom', 'left', 'right']

function rails(html: string): Array<{ id: string; rail: string }> {
  return Array.from(html.matchAll(/data-dial="([^"]+)" data-rail="([^"]+)"/g)).map((m) => ({ id: m[1]!, rail: m[2]! }))
}

function expectCycled(seen: Array<{ rail: string }>) {
  expect(seen.length).toBeGreaterThan(2)
  seen.forEach((dial, order) => expect(dial.rail).toBe(CYCLE[order % 3]))
  for (let i = 1; i < seen.length; i += 1) expect(seen[i]!.rail).not.toBe(seen[i - 1]!.rail)
}

describe('rail position by dial order (Matt 2026-09-24)', () => {
  it('PlaceSubdivisionHomes (city, community, neighborhood): each buyer group, then the lease dial', () => {
    const html = renderToStaticMarkup(
      <PlaceSubdivisionMap
        placeName="Bend"
        rail={[]}
        homes={SECTIONS.flatMap((s) => s.rows)}
        leases={LEASE.rows}
        keysBySlug={{}}
        source="regional MLS through Oregon Data Share"
      >
        <PlaceSubdivisionHomes id="homes" />
      </PlaceSubdivisionMap>,
    )
    const seen = rails(html)
    expect(seen[seen.length - 1]!.id).toBe('homes-lease')
    expectCycled(seen)
  })

  it('PlaceSubdivisionHomes with one buyer group: the one dial is first, the lease dial second', () => {
    const html = renderToStaticMarkup(
      <PlaceSubdivisionMap
        placeName="Bend"
        rail={[]}
        homes={placeStockSectionsFromTiles([TILES[0]!, TILES[1]!]).flatMap((s) => s.rows)}
        leases={LEASE.rows}
        keysBySlug={{}}
        source="regional MLS through Oregon Data Share"
      >
        <PlaceSubdivisionHomes id="homes" />
      </PlaceSubdivisionMap>,
    )
    expect(rails(html)).toEqual([
      { id: 'homes-all', rail: 'bottom' },
      { id: 'homes-lease', rail: 'left' },
    ])
  })

  it('V3PlaceInventory layout="dial" (plat pages, the all-leases page): each type, then the lease dial', () => {
    const html = renderToStaticMarkup(
      <V3PlaceInventory
        id="homes"
        layout="dial"
        placeName="Porter James"
        sections={SECTIONS}
        lease={LEASE}
        source="regional MLS through Oregon Data Share"
      />,
    )
    const seen = rails(html)
    expect(seen[seen.length - 1]!.id).toBe('homes-lease')
    expectCycled(seen)
  })
})

// Matt 2026-09-25, "fix first, then ship": a class below its taste mark with
// the dial keeps what production showed, by one explicit prop.
describe('held presentations', () => {
  const RAIL = [
    { id: 'heath', name: 'Heath', detail: '2 for sale' },
    { id: 'the-ridge', name: 'The Ridge', detail: '1 for sale' },
  ]
  const KEYS = { heath: ['sfr-1', 'sfr-2'], 'the-ridge': ['condo-1'] }
  const render = (layout?: 'rails') =>
    renderToStaticMarkup(
      <PlaceSubdivisionMap
        placeName="Tetherow"
        rail={RAIL}
        homes={SECTIONS.flatMap((s) => s.rows)}
        leases={LEASE.rows}
        keysBySlug={KEYS}
        source="regional MLS through Oregon Data Share"
        layout={layout}
      >
        <PlaceSubdivisionRail id="child-places" nameOnly />
        <PlaceSubdivisionHomes id="homes" />
      </PlaceSubdivisionMap>,
    )

  it('PlaceSubdivisionMap layout="rails" (community pages): a carousel per buyer group, no dial, no rail bars', () => {
    const html = render('rails')
    expect(rails(html)).toEqual([])
    expect(html).toContain('place-homes--rails')
    expect(html).toContain('place-subdiv-rail--held')
    expect(html.match(/class="place-homes__type[ "]/g)?.length).toBe(SECTIONS.length + 1)
    expect(html).toContain('id="homes-lease"')
    expect(html).toContain('>5 for sale<')
    expect(html).not.toContain('place-subdiv-rail__bar')
    expect(html).not.toContain('place-subdiv-rail__key')
  })

  it('PlaceSubdivisionMap default: the dials and the rail count bars', () => {
    const html = render()
    expect(rails(html).length).toBe(SECTIONS.length + 1)
    expect(html).not.toContain('place-homes--rails')
    expect(html).toContain('place-subdiv-rail__bar')
  })

  it('V3PlaceInventory dialRail="left" (/commercial-space-for-lease): every dial on the left', () => {
    const html = renderToStaticMarkup(
      <V3PlaceInventory
        id="lease"
        layout="dial"
        dialRail="left"
        placeName="Central Oregon"
        sections={SECTIONS}
        source="regional MLS through Oregon Data Share"
      />,
    )
    const seen = rails(html)
    expect(seen.length).toBeGreaterThan(2)
    expect(seen.every((dial) => dial.rail === 'left')).toBe(true)
  })
})
