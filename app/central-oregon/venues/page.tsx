// @no-parity — content-engine route, not a Wave-3 mockup.
/**
 * /central-oregon/venues — live-music and performing-arts hub on the v3 barrel.
 *
 * Ledger of named venues fills the fold. Count is a caption. Seller lives on Sell.
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css cards, RegionalSfrAlertsBand, separate music/theater H2 sections
 * (type moved to the Ledger when column), the Instrument count hero.
 */

import type { Metadata } from 'next'
import { getVenuesForIndex, getVenuesCount } from '@/lib/data'
import { VENUE_TYPE_LABEL } from '@/data/co-venues'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
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

export const revalidate = 3600

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Live Music & Show Venues',
    description:
      'Where to see live music and shows across Central Oregon, from Hayden Homes Amphitheater and the Tower Theatre to brewery stages and neighborhood theaters. Each venue links to its live calendar, with the homes for sale nearby.',
    path: '/central-oregon/venues',
  })
}

export default function VenuesIndexPage() {
  const { music, performingArts } = getVenuesForIndex()
  const total = getVenuesCount()
  const caption = `${total.toLocaleString('en-US')} ${total === 1 ? 'venue' : 'venues'}`
  const listed = [...music, ...performingArts].filter(
    (v, i, arr) => arr.findIndex((x) => x.slug === v.slug) === i,
  )

  const rows: V3LedgerPlainRow[] = []
  for (const venue of listed) {
    const name = venue.name.trim()
    const slug = venue.slug.trim()
    if (!name || !slug) continue
    rows.push({
      href: `/central-oregon/venues/${slug}`,
      when: v3Text(VENUE_TYPE_LABEL[venue.venueType]),
      what: v3Text(name),
      detail: v3Text(venue.city),
      id: slug,
    })
  }
  const [firstRow, ...restRows] = rows

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Live music & shows', url: '/central-oregon/venues' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Live Music & Show Venues',
      description:
        'Live-music and performing-arts venues across Central Oregon, each with its live calendar and the homes for sale nearby.',
      url: '/central-oregon/venues',
    },
    {
      type: 'itemList',
      name: 'Central Oregon venues',
      items: listed.map((v) => ({ name: v.name, url: `/central-oregon/venues/${v.slug}` })),
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="venues" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[{ label: 'Home', href: '/' }, { label: 'Live music & shows' }]}
        />

        {firstRow ? (
          <V3Ledger
            id="venue-list"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon venues')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
          />
        ) : (
          <V3Ledger
            id="venue-list"
            headingLevel={1}
            heading={v3Text('Central Oregon venues')}
            note={v3Text(caption)}
            rows={[]}
            emptyMessage={v3Text('The venue guide is being updated. See events in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Events', href: '/central-oregon/events' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/central-oregon/venues') },
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
