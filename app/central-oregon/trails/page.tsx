// @no-parity — content-engine route, not a Wave-3 mockup.
/**
 * /central-oregon/trails — trails hub on the v3 barrel.
 *
 * Ledger of named trails fills the fold. Count is a caption. Seller lives on Sell.
 *
 * KB-era deletions: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider, kb.css,
 * events.css cards, RegionalSfrAlertsBand, separate hiking/biking H2 sections
 * (use moved to the Ledger when column), the Instrument count hero.
 */

import type { Metadata } from 'next'
import { getTrailsForIndex, getTrailsCount, getTrailLineGeoJSON } from '@/lib/data'
import { placeListThumbDataUri } from '@/lib/place/publish-place-list-thumb'
import { TRAIL_USE_LABEL } from '@/data/co-trails'
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
    title: 'Central Oregon Hiking & Mountain Bike Trails',
    description:
      'The marquee hiking and mountain-bike trails across Central Oregon, from Pilot Butte and the Deschutes River Trail to Green Lakes, South Sister, Smith Rock, and the Phil’s network. Each trail pairs with the homes for sale nearby, from Ryan Realty.',
    path: '/central-oregon/trails',
  })
}

export default async function TrailsIndexPage() {
  const { hiking, biking } = getTrailsForIndex()
  const total = getTrailsCount()
  const caption = `${total.toLocaleString('en-US')} ${total === 1 ? 'trail' : 'trails'}`
  const listed = [...hiking, ...biking].filter(
    (t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i,
  )

  const drafted = listed.flatMap((trail) => {
    const name = trail.name.trim()
    const slug = trail.slug.trim()
    if (!name || !slug) return []
    const dist =
      typeof trail.lengthMiles === 'number'
        ? `${trail.lengthMiles} mi${trail.distanceNote ? ` ${trail.distanceNote}` : ''}`
        : trail.landManager
    return [{
      href: `/central-oregon/trails/${slug}`,
      when: v3Text(TRAIL_USE_LABEL[trail.use]),
      what: v3Text(name),
      detail: v3Text(`${trail.city} · ${dist}`),
      id: slug,
      lat: trail.lat,
      lng: trail.lng,
      slug,
    }]
  })
  const thumbs = await Promise.all(
    drafted.map(async (row) => {
      const geometry = await getTrailLineGeoJSON(row.slug).catch(() => null)
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

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Trails', url: '/central-oregon/trails' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Hiking & Mountain Bike Trails',
      description:
        'Hiking and mountain-bike trails across Central Oregon, each with the homes for sale nearby.',
      url: '/central-oregon/trails',
    },
    {
      type: 'itemList',
      name: 'Central Oregon trails',
      items: listed.map((t) => ({ name: t.name, url: `/central-oregon/trails/${t.slug}` })),
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Trails' }]} />

        {firstRow ? (
          <V3Ledger
            id="trail-list"
            headingLevel={1}
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Central Oregon trails')}
            note={v3Text(caption)}
            rows={[firstRow, ...restRows]}
          />
        ) : (
          <V3Ledger
            id="trail-list"
            headingLevel={1}
            heading={v3Text('Central Oregon trails')}
            note={v3Text(caption)}
            rows={[]}
            emptyMessage={v3Text('The trail guide is being updated. See events in the meantime.')}
          />
        )}

        <RegionalAlertSheet placeLabel="Central Oregon" city="" />

        <V3Quiet
          id="explore"
          eyebrow="Next"
          heading="Keep exploring Central Oregon"
          items={[
            { label: 'Events', href: '/central-oregon/events' },
            { label: 'Parks', href: '/parks' },
            { label: 'Search homes', href: listingsBrowsePath() },
            { label: 'Value my home', href: valuationHref('/central-oregon/trails') },
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
