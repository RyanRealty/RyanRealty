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
import { formatDate } from '@/lib/format/date'
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
  V3Drawing,
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
import { priceDropDistribution } from './_v3/drops-drawing'
import { priceDropDatasetSchemas } from './_v3/drops-jsonld'
import { PriceDropPhotos, PriceDropsOpening } from './_v3/PriceDropsField'

export const revalidate = 1800

export const metadata: Metadata = pageMetadata({
  title: 'Price Drops in Central Oregon | Last 7 Days | Homes Cut This Week',
  description:
    'Photographed asking-price cuts on active Central Oregon single-family homes from the last 7 days. ' +
    'See current list price, prior ask, drop percent, beds, baths, and sqft for each reduced home in Bend, Redmond, Sisters, Sunriver, and nearby cities.',
  path: '/price-drops',
  keywords: [
    'price reduced homes Central Oregon',
    'price drop homes Bend Oregon',
    'homes with price reductions Central Oregon',
    'reduced asking price Oregon homes',
    'price cut homes for sale Bend',
    'recently reduced homes Central Oregon',
  ],
})

/**
 * The pull's row cap. Named because the page prints BOTH counts — "60 price
 * cuts this week · 48 shown below" — and a reader who sees two numbers and no
 * reason is owed one (evaluator, 2026-09-09: "the 60-vs-48 gap is stated three
 * times and never explained"). The drawing's trace now says the pull is capped
 * and how many cuts that leaves off the page.
 */
const PRICE_DROPS_LIMIT = 48

export default async function PriceDropsRegionPage() {
  const { drops, total, fetchedAt } = await getPriceDrops({ limit: PRICE_DROPS_LIMIT, days: 7 })

  if (drops.length === 0) {
    noStore()
  }

  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const medianDropPct = medianPositive(drops.map((d) => d.lastDropPct))
  const fieldItems = priceDropFieldItems(drops)
  // SITE-49: the distribution the count implies, above the grid. Every mark is
  // a row the grid renders; a row with no percent is not plotted (§0).
  const distribution = priceDropDistribution({
    drops,
    total,
    cap: PRICE_DROPS_LIMIT,
    placeLabel: 'Central Oregon',
    windowDays: 7,
    fetchedAt: fetchedAt ? formatDate(fetchedAt) : null,
  })
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
    ...(fieldItems.length > 0
      ? [
          {
            type: 'itemList' as const,
            name: 'Central Oregon homes with a price cut in the last 7 days',
            items: fieldItems.slice(0, 24).map((item) => ({
              name: `${item.priceLabel} · ${item.title}`,
              url: item.href.startsWith('http') ? item.href : `${siteUrl}${item.href}`,
            })),
          },
        ]
      : []),
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
            {/* THE COUNT IS THE FULL POPULATION (2026-08-27 audit: the page said
                "48 price cuts this week" while its own Dataset told crawlers 60 —
                two answers to the page's headline question). The caption states
                the total; when the rendered list is capped, the label says so. */}
            <PriceDropsOpening
              heading="Price drops in Central Oregon"
              captionValue={total.toLocaleString('en-US')}
              captionLabel={
                total === 1
                  ? 'price cut this week'
                  : total > captionCount
                    ? `price cuts this week · ${captionCount} shown below`
                    : 'price cuts this week'
              }
              captionDrillHref={distribution ? '#spread' : '#cuts'}
              captionDrillLabel={
                distribution ? 'see how far each ask came down' : 'browse the cuts'
              }
            />
            {/* Photographs open the fold; drawing is the differentiator under the rail. */}
            <div className="pd-fold">
              <V3Field
                id="cuts"
                className="pd-homes-field"
                ariaLabel="Homes with a price cut in the last 7 days"
                items={fieldItems}
                mapSlot={<PriceDropPhotos items={fieldItems} />}
                emptyMessage="No price cut on this pull has both a street and a list price, so this list has nothing to name."
              />
              {distribution ? (
                <V3Drawing
                  id="spread"
                  className="pd-spread"
                  figures={[distribution]}
                  label="This week's price cuts by how far the ask came down"
                />
              ) : null}
            </div>
            {/* The "by how much" in text, not only in ld+json, and the stamp the
                Dataset already carried but the page never printed (same audit). */}
            <V3SourceLine
              className="pd-source"
              source={`${dropsTrace('Central Oregon')}${
                medianDropPctLabel ? `. Median drop ${medianDropPctLabel}` : ''
              }${totalReducedLabel ? `, ${totalReducedLabel} in asking prices cut this week` : ''}${
                fetchedAt ? ` · updated ${formatDate(fetchedAt)}` : ''
              }`}
            />
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
