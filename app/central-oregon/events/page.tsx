// @no-parity — content-engine route, not a Wave-3 mockup contract.
/**
 * /central-oregon/events — events hub on the v3 barrel.
 *
 * Order: Breadcrumb, Ledger (every event fills the fold), Sheet, Quiet,
 * Footer outside main. Count is a caption. Seller lives on Sell.
 *
 * THE PAGE CONTRACT: pageMetadata, revalidate 3600, breadcrumb + webPage
 * CollectionPage + itemList via MetadataBlock, V3SectionTracker pageType="events".
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css card grid, RegionalSfrAlertsBand, per-category H2 sections (category
 * moved to the Ledger when column), the Instrument count hero.
 */

import type { Metadata } from 'next'
import { getEventsForIndex, getEventsCount } from '@/lib/data'
import { EVENT_CATEGORY_LABEL } from '@/data/co-events'
import { shortEventDate } from '@/lib/events-format'
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
    title: 'Central Oregon Events',
    description:
      'Festivals, races, markets, and seasonal events across Central Oregon, from Bend and Redmond to Sisters and Sunriver. Confirmed dates and the homes for sale near each one, from Ryan Realty.',
    path: '/central-oregon/events',
  })
}

export default function EventsIndexPage() {
  const { upcoming, anchors } = getEventsForIndex()
  const total = getEventsCount()
  const listed = [...upcoming, ...anchors]
  const caption = `${total.toLocaleString('en-US')} ${total === 1 ? 'event' : 'events'}`

  const rows: V3LedgerPlainRow[] = []
  for (const event of listed) {
    const name = event.name.trim()
    const slug = event.slug.trim()
    if (!name || !slug) continue
    const when = shortEventDate(event.nextConfirmedDate) ?? event.recurrence
    const where = event.venue.includes(event.city) ? event.venue : `${event.venue}, ${event.city}`
    rows.push({
      href: `/central-oregon/events/${slug}`,
      when: v3Text(when.trim() || EVENT_CATEGORY_LABEL[event.category]),
      what: v3Text(name),
      detail: v3Text(`${EVENT_CATEGORY_LABEL[event.category]} · ${where}`),
      id: slug,
    })
  }
  const [firstRow, ...restRows] = rows

  const itemListItems = listed.map((e) => ({
    name: e.name,
    url: `/central-oregon/events/${e.slug}`,
  }))

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Central Oregon events', url: '/central-oregon/events' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Events',
      description:
        'Festivals, races, markets, and seasonal events across Central Oregon, with the homes for sale near each one.',
      url: '/central-oregon/events',
    },
    { type: 'itemList', name: 'Central Oregon events', items: itemListItems },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="events" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[{ label: 'Home', href: '/' }, { label: 'Central Oregon events' }]}
        />

        {firstRow ? (
          <V3Ledger
            id="event-list"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon events')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
          />
        ) : (
          <V3Ledger
            id="event-list"
            headingLevel={1}
            heading={v3Text('Central Oregon events')}
            note={v3Text(caption)}
            rows={[]}
            emptyMessage={v3Text('The events calendar is being updated. See parks or cities in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Parks', href: '/parks' },
            { label: 'Cities', href: '/cities' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/central-oregon/events') },
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
