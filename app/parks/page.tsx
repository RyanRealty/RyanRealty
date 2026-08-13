/**
 * /parks — Central Oregon parks index, on the v3 barrel.
 *
 * Places open on Instrument. Order: Breadcrumb, Instrument (registry count),
 * Ledger (every park), Sheet (SFR alerts), Quiet, Footer outside main.
 *
 * THE PAGE CONTRACT: pageMetadata, revalidate 3600, breadcrumb + webPage
 * JSON-LD via MetadataBlock, V3SectionTracker pageType="parks". Data through
 * @/lib/data (getParks, getParksCount). Capture: submitSearchAlertSignup with
 * city="" and propertyType A.
 *
 * KB-era deletions: KbHero (owned parks photo, Places open on Instrument and
 * the Sheet is the capture), KbBreadcrumb, KbFooter, SmoothScrollProvider,
 * kb.css, ParksIndexStyles card grid, RegionalSfrAlertsBand, per-city H2
 * sections (city grouping moved to the Ledger when column).
 */

import type { Metadata } from 'next'
import { getParks, getParksCount } from '@/lib/data'
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
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerFigureRow,
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

export default function ParksIndexPage() {
  const cities = getParks()
  const total = getParksCount()

  const rows: V3LedgerFigureRow[] = []
  for (const group of cities) {
    const city = group.city.trim()
    if (!city) continue
    for (const park of group.parks) {
      const name = park.name.trim()
      const slug = park.slug.trim()
      if (!name || !slug) continue
      const acres =
        typeof park.acres === 'number' ? `${park.acres.toLocaleString('en-US')} acres` : TYPE_LABEL[park.type]
      rows.push({
        href: `/parks/${slug}`,
        when: v3Text(city),
        what: v3Text(name),
        detail: v3Text(TYPE_LABEL[park.type]),
        value: v3Text(acres),
        id: slug,
      })
    }
  }
  const [firstRow, ...restRows] = rows

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="parks" />
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

        <V3Instrument
          id="parks"
          level={1}
          eyebrow={v3Text('Central Oregon')}
          headline={v3Text('Parks, and the homes next to them')}
          figures={[
            {
              value: v3Text(total.toLocaleString('en-US')),
              label: v3Text('parks in the registry'),
              href: '#park-list',
            },
          ]}
          source={v3Text(
            'verified park registry (data/co-parks.ts). State-park facts from Oregon State Parks, city parks from BPRD and city sites plus OpenStreetMap. Nothing here is a live MLS figure.',
          )}
          action={{
            label: v3Text('Value my home'),
            href: valuationHref('/parks'),
          }}
        />

        {firstRow ? (
          <V3Ledger
            id="park-list"
            eyebrow={v3Text('By city')}
            heading={v3Text('Central Oregon parks')}
            rows={[firstRow, ...restRows]}
            source={v3Text(
              'the same verified park registry as the count above. Acreage is printed only when the registry carries a number.',
            )}
            action={{
              label: v3Text('Search homes'),
              href: listingsBrowsePath(),
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Ledger
            id="park-list"
            heading={v3Text('Central Oregon parks')}
            rows={[]}
            emptyMessage={v3Text('The park registry is being updated. See cities or search homes in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Homes near open space"
          items={[
            { label: 'Central Oregon homes for sale', href: '/homes-for-sale' },
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
