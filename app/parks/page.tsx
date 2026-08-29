/**
 * /parks — Central Oregon parks index, on the v3 barrel.
 *
 * Named park rows fill the fold. City is a label on the row. Count is a
 * caption. Seller lives on Sell.
 *
 * THE PAGE CONTRACT: pageMetadata, revalidate 3600, breadcrumb + webPage
 * JSON-LD via MetadataBlock, V3SectionTracker pageType="parks". Data through
 * @/lib/data (getParks, getParksCount). Capture: submitSearchAlertSignup with
 * city="" and propertyType A.
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider,
 * kb.css, ParksIndexStyles card grid, RegionalSfrAlertsBand, per-city H2
 * sections (city grouping moved to the Ledger when column), the Instrument
 * count hero.
 */

import type { Metadata } from 'next'
import { getParks, getParksCount, getParkBoundaryGeoJSON } from '@/lib/data'
import { placeListThumbDataUri } from '@/lib/place/publish-place-list-thumb'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import { RegionalAlertSheet } from '@/app/central-oregon/_v3/RegionalAlertSheet.client'
import type { ParkType } from '@/data/co-parks'

export const revalidate = 3600

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Parks',
    description:
      'State, city, and natural-area parks across Central Oregon, from Smith Rock and Tumalo to Drake Park and Shevlin. Homes for sale near each park, with trails, river access, and amenities.',
    path: '/parks',
  })
}

export default async function ParksIndexPage() {
  const cities = getParks()
  const total = getParksCount()
  const caption = `${total.toLocaleString('en-US')} ${total === 1 ? 'park' : 'parks'}`

  const drafted: Array<{
    href: string
    when: ReturnType<typeof v3Text>
    what: ReturnType<typeof v3Text>
    detail: ReturnType<typeof v3Text>
    id: string
    lat: number
    lng: number
    slug: string
    hasPolygon: boolean
  }> = []
  for (const group of cities) {
    const city = group.city.trim()
    if (!city) continue
    for (const park of group.parks) {
      const name = park.name.trim()
      const slug = park.slug.trim()
      if (!name || !slug) continue
      const parts = [TYPE_LABEL[park.type]]
      if (typeof park.acres === 'number') {
        parts.push(`${park.acres.toLocaleString('en-US')} acres`)
      }
      drafted.push({
        href: `/parks/${slug}`,
        when: v3Text(city),
        what: v3Text(name),
        detail: v3Text(parts.join(' · ')),
        id: slug,
        lat: park.lat,
        lng: park.lng,
        slug,
        hasPolygon: park.hasPolygon,
      })
    }
  }
  const thumbs = await Promise.all(
    drafted.map(async (row) => {
      const geometry = row.hasPolygon
        ? await getParkBoundaryGeoJSON(row.slug).catch(() => null)
        : null
      return placeListThumbDataUri({ lat: row.lat, lng: row.lng, geometry })
    }),
  )
  const rows: V3LedgerPlainRow[] = drafted.map((row, i) => ({
    href: row.href,
    when: row.when,
    what: row.what,
    detail: row.detail,
    id: row.id,
    media: { src: thumbs[i]! },
  }))
  const [firstRow, ...restRows] = rows

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Parks', url: '/parks' },
              ],
            },
            {
              type: 'webPage',
              name: 'Central Oregon Parks',
              description:
                'Central Oregon parks by city, with the homes for sale near each one.',
              url: '/parks',
            },
          ]}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Parks' }]} />

        {firstRow ? (
          <V3Ledger
            id="park-list"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon parks')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
          />
        ) : (
          <V3Ledger
            id="park-list"
            headingLevel={1}
            heading={v3Text('Central Oregon parks')}
            note={v3Text(caption)}
            rows={[]}
            emptyMessage={v3Text('The park list is being updated. See cities or search homes in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Homes near open space"
          items={[
            { label: 'Central Oregon homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Search with filters', href: listingsBrowsePath() },
            { label: 'Bend homes', href: '/search?city=Bend' },
            { label: 'Cities', href: '/cities' },
            { label: 'Value my home', href: valuationHref('/parks') },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
