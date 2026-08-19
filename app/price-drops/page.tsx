/**
 * /price-drops - last 7 days of documented asking-price cuts, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Homes grain.
 * Opening is Field of the cut houses. Count is a caption.
 * Rhythm: Field, Sheet, Quiet. Chrome exempt.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata through pageMetadata,
 * MetadataBlock JSON-LD (BreadcrumbList + Dataset + webPage), a rendered
 * V3SectionTracker with pageType="price-drops", TrackSearchView, revalidate 1800,
 * getPriceDrops({ limit: 48, days: 7 }) with no .catch() empty swallow.
 *
 * EMPTY WINDOW: getPriceDrops is resilient-cached and can answer with an empty
 * array plus a now() stamp. noStore() opts this render out of ISR so a cold
 * cache cannot pin "no reductions this week" for 30 minutes. Dataset, updated
 * stamp, and any count figure are omitted when drops.length === 0.
 */

import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingsBrowsePath } from '@/lib/slug'
import { formatPriceCompact } from '@/lib/format/money'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { PriceDropAlertsSheet } from './_v3/PriceDropAlertsSheet.client'
import {
  DROPS_CITY_SLUGS,
  cityLabel,
  dropsTrace,
  medianPositive,
} from './_v3/drops-constants'
import { priceDropFieldItems } from './_v3/drops-field-items'
import { priceDropDatasetSchemas } from './_v3/drops-jsonld'
import { PriceDropPhotos, PriceDropsOpening } from './_v3/PriceDropsField'

export const revalidate = 1800

export const metadata: Metadata = pageMetadata({
  title: 'Price Drops in Central Oregon | Last 7 Days',
  description:
    'Active single-family homes in Central Oregon where the seller cut the asking price in the last 7 days. ' +
    'Current price, original list price, and drop percentage from the regional MLS. Bend, Redmond, Sisters, Sunriver, and nearby cities.',
  path: '/price-drops',
  keywords: [
    'price reduced homes Central Oregon',
    'price drop homes Bend Oregon',
    'homes with price reductions Central Oregon',
    'reduced asking price Oregon homes',
    'price cut homes for sale Bend',
  ],
})

export default async function PriceDropsRegionPage() {
  const { drops, total, fetchedAt } = await getPriceDrops({ limit: 48, days: 7 })

  if (drops.length === 0) {
    noStore()
  }

  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const medianDropPct = medianPositive(drops.map((d) => d.lastDropPct))
  const fieldItems = priceDropFieldItems(drops)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const pageUrl = `${siteUrl}/price-drops`

  const totalReducedLabel =
    totalReduced > 0
      ? (() => {
          const label = formatPriceCompact(totalReduced)
          return /\$/.test(label) ? label : null
        })()
      : null
  const medianDropPctLabel =
    medianDropPct != null ? `${medianDropPct.toFixed(1)}%` : null

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Price drops', url: '/price-drops' },
      ],
    },
    ...priceDropDatasetSchemas({
      pageUrl,
      placeName: 'Central Oregon',
      total,
      totalReducedLabel,
      medianDropPctLabel,
      fetchedAt: drops.length > 0 ? fetchedAt : null,
    }),
  ]

  const cityItems: V3QuietItem[] = DROPS_CITY_SLUGS.map((slug) => ({
    label: cityLabel(slug),
    href: `/price-drops/${slug}`,
  }))

  const edgeItems: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'The window',
      body: 'Active single-family homes whose asking price fell in the last 7 days. Drop is previous list price to current list price. Recovered and relisted prices stay off this list.',
    },
    { label: 'All Central Oregon homes for sale', href: listingsBrowsePath() },
    { label: 'Open houses this week', href: '/open-houses' },
    ...cityItems,
  ]

  const captionCount = fieldItems.length

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <TrackSearchView resultsCount={total} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Price drops' }]} />

        {captionCount > 0 ? (
          <>
            <PriceDropsOpening
              heading="Price drops in Central Oregon"
              captionValue={captionCount.toLocaleString('en-US')}
              captionLabel={captionCount === 1 ? 'price cut this week' : 'price cuts this week'}
            />
            <V3Field
              id="cuts"
              className="pd-homes-field"
              ariaLabel="Homes with a price cut in the last 7 days"
              items={fieldItems}
              mapSlot={<PriceDropPhotos items={fieldItems} />}
              emptyMessage="No price cut on this pull has both a street and a list price, so this list has nothing to name."
            />
            <V3SourceLine source={dropsTrace('Central Oregon')} />
          </>
        ) : (
          <V3Quiet
            id="answer"
            heading="Price drops in Central Oregon"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'Nothing in this window',
                body: 'No active single-family home in the Central Oregon service area has a documented asking-price cut in the last 7 days on this pull. The homes-for-sale list is still live.',
              },
              { label: 'All Central Oregon homes for sale', href: listingsBrowsePath() },
            ]}
          />
        )}

        <PriceDropAlertsSheet
          placeLabel="Central Oregon"
          city=""
          extraFilters={{ propertyType: 'A' }}
        />

        <V3Quiet id="edges" heading="Keep looking" items={edgeItems} />
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
