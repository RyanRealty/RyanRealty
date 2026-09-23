/**
 * COMMERCIAL SPACE FOR LEASE (Matt 2026-09-23). A commercial lease (MLS 'G')
 * is not for sale: it gets its own last section, after "Commercial property",
 * in every layout the place inventory supports, and in the homes block under a
 * place map. Each lease prints its rent with the unit, or "Lease rate not
 * published", under "For lease", and stays an <a href> in the served HTML.
 *
 * Founding case: /subdivisions/center-addition-to-bend listed three 671
 * Greenwood Avenue leases as "Single-family homes ... for sale".
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ListingTile } from '@/lib/data'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import { placeLeaseSectionFromTiles } from '@/lib/place/place-lease-stock'
import { V3PlaceInventory } from '@/components/site/v3/V3PlaceInventory'
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
    streetName: 'Greenwood',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Center Addition to Bend',
    subdivisionSlug: 'center-addition-to-bend',
    lat: 44.06,
    lng: -121.3,
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/800x600/true/a-o.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 322,
    lotSizeAcres: null,
    yearBuilt: 1950,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '12-greenwood-ave',
    ...over,
  } as ListingTile
}

const lease = (listingKey: string, listNumber: string, listPrice: number) =>
  tile({
    listingKey,
    listNumber,
    streetNumber: '671',
    listPrice,
    propertyType: 'G',
    propertySubType: null,
    beds: null,
    baths: null,
    sqft: 1200,
    pricePerSqft: null,
  })

const TILES = [
  tile({ listingKey: 'sfr-1' }),
  tile({ listingKey: 'office-1', streetNumber: '16', propertyType: 'F', propertySubType: 'Office', beds: null, baths: null }),
  lease('20260514121750306188000000', '220221001', 1.4),
  lease('20260514115056270451000000', '220221002', 1.3),
  lease('20260514123041461938000000', '220221003', 1.2),
]
const UNITS = {
  '20260514121750306188000000': '$/SF/Mo',
  '20260514115056270451000000': '$/SF/Mo',
  // The third lease carries no unit: its card may not print a bare 1.2.
  '20260514123041461938000000': null,
}
const SECTIONS = placeStockSectionsFromTiles(TILES)
const LEASE = placeLeaseSectionFromTiles(TILES, UNITS)!

function render(layout: 'rows' | 'rails' | 'dial') {
  return renderToStaticMarkup(
    <V3PlaceInventory
      id="homes"
      layout={layout}
      placeName="Center Addition to Bend"
      sections={SECTIONS}
      lease={LEASE}
      source="regional MLS through Oregon Data Share"
    />,
  )
}

describe.each(['rows', 'rails', 'dial'] as const)('V3PlaceInventory layout="%s" with leases', (layout) => {
  const html = render(layout)

  it('renders "Commercial space for lease" last, after "Commercial property"', () => {
    const commercial = html.indexOf('Commercial property')
    const leaseAt = html.indexOf('Commercial space for lease')
    expect(commercial).toBeGreaterThan(-1)
    expect(leaseAt).toBeGreaterThan(commercial)
    expect(html).toContain('id="homes-lease"')
  })

  it('prints each lease rate with its unit, and the withheld line where the unit is missing', () => {
    expect(html).toContain('$1.40/sq ft/mo')
    expect(html).toContain('$1.30/sq ft/mo')
    expect(html).toContain('Lease rate not published')
    expect(html).not.toMatch(/>\$1\.2</)
    expect(html).not.toMatch(/>\$1</)
  })

  it('labels leases "For lease" and counts them for lease, never for sale', () => {
    expect(html).toContain('For lease')
    expect(html).toContain('3 for lease')
    expect(html).not.toContain('4 for sale')
    expect(html).not.toContain('3 for sale')
  })

  it('keeps every lease a crawlable <a href> to its own page', () => {
    for (const row of LEASE.rows) {
      expect(html).toContain(`href="${row.href}"`)
    }
  })

  it('keeps the leases out of the for-sale sections', () => {
    const sfrStart = html.indexOf('Single-family homes')
    const commercialStart = html.indexOf('Commercial property')
    const between = html.slice(sfrStart, commercialStart)
    expect(between).not.toContain('671 Greenwood')
  })
})

describe('V3PlaceInventory with only leases', () => {
  const html = renderToStaticMarkup(
    <V3PlaceInventory
      layout="dial"
      placeName="Center Addition to Bend"
      sections={[]}
      lease={LEASE}
      source="regional MLS through Oregon Data Share"
    />,
  )

  it('shows the lease section instead of saying nothing is listed', () => {
    expect(html).toContain('Commercial space for lease')
    expect(html).not.toContain('Nothing listed')
  })
})

describe('V3PlaceInventory with no leases', () => {
  it('renders no lease section', () => {
    const html = renderToStaticMarkup(
      <V3PlaceInventory
        layout="rails"
        placeName="Center Addition to Bend"
        sections={SECTIONS}
        lease={null}
        source="regional MLS through Oregon Data Share"
      />,
    )
    expect(html).not.toContain('Commercial space for lease')
    expect(html).not.toContain('for lease')
  })
})

describe.each(['rails', 'dial'] as const)('PlaceSubdivisionHomes layout="%s" with leases', (layout) => {
  const homes = SECTIONS.flatMap((s) => s.rows)
  const html = renderToStaticMarkup(
    <PlaceSubdivisionMap
      placeName="Downtown"
      rail={[]}
      homes={homes}
      leases={LEASE.rows}
      keysBySlug={{}}
      source="regional MLS through Oregon Data Share"
    >
      <PlaceSubdivisionHomes id="homes" layout={layout} />
    </PlaceSubdivisionMap>,
  )

  it('counts only the for-sale homes as for sale', () => {
    expect(html).toContain('2 for sale')
  })

  it('shows the leases last under their own heading, with the rate and the label', () => {
    expect(html.indexOf('Commercial space for lease')).toBeGreaterThan(html.indexOf('2 for sale'))
    expect(html).toContain('3 for lease')
    expect(html).toContain('$1.40/sq ft/mo')
    expect(html).toContain('Lease rate not published')
    expect(html).toContain('For lease')
    for (const row of LEASE.rows) {
      expect(html).toContain(`href="${row.href}"`)
    }
  })

  it('says nothing is for sale, not that nothing is listed, when a place has only leases', () => {
    const onlyLeases = renderToStaticMarkup(
      <PlaceSubdivisionMap
        placeName="Downtown"
        rail={[]}
        homes={[]}
        leases={LEASE.rows}
        keysBySlug={{}}
        source="regional MLS through Oregon Data Share"
      >
        <PlaceSubdivisionHomes id="homes" layout={layout} />
      </PlaceSubdivisionMap>,
    )
    expect(onlyLeases).toContain('Nothing for sale in Downtown right now.')
    expect(onlyLeases).not.toContain('Nothing listed')
    expect(onlyLeases).toContain('Commercial space for lease')
  })
})
