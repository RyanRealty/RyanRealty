/**
 * /price-drops/[city] - city-scoped 7-day price cuts, on the v3 barrel.
 *
 * Same contract as the region page. Opening is Field of this city's cut
 * houses. Count is a caption: the city's whole window, with "N shown below"
 * when the list is capped, and the drawing states the cap the read reports.
 * generateMetadata title still leads with "Price Drops in".
 * generateStaticParams over SITE_CITY_SLUGS. dynamicParams stays false so an
 * unknown city slug 404s.
 *
 * A read that did not answer is not an empty week (§0): getPriceDrops never
 * rejects, and a failed read comes back `degraded: true`. The page says it
 * could not load, publishes no count, Dataset or updated stamp, and
 * refuseDegradedIsr cuts that copy's ISR lifetime from 1800 s to
 * DEGRADED_ISR_REVALIDATE_S. Not noStore(), which throws inside a runtime ISR
 * render in Next 16 (an HTTP 500, lib/site/degraded-isr.ts), and not a
 * .catch() into an empty result, which published "Nothing in {city}".
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatDate } from '@/lib/format/date'
import { getPriceDrops } from '@/lib/data'
import { refuseDegradedIsr } from '@/lib/site/degraded-isr'
import { pageMetadata } from '@/lib/site/page-metadata'
import { homesForSalePath } from '@/lib/slug'
import { formatPriceCompact } from '@/lib/format/money'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Drawing,
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
import { PriceDropAlertsSheet } from '../_v3/PriceDropAlertsSheet.client'
import {
  DROPS_ALERT_FILTERS,
  DROPS_CITY_SLUGS,
  cityLabel,
  dropsTrace,
  dropsUnavailable,
  medianPositive,
} from '../_v3/drops-constants'
import { priceDropFieldItems } from '../_v3/drops-field-items'
import { priceDropDistribution } from '../_v3/drops-drawing'
import { priceDropDatasetSchemas } from '../_v3/drops-jsonld'
import { PriceDropsFold, PriceDropsOpening } from '../_v3/PriceDropsField'

export const revalidate = 1800
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return DROPS_CITY_SLUGS.map((slug) => ({ city: slug }))
}

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  if (!DROPS_CITY_SLUGS.includes(slug)) notFound()
  const cityName = cityLabel(slug)
  return pageMetadata({
    title: `Price Drops in ${cityName}, Oregon`,
    description:
      `Active homes in ${cityName}, Oregon where the seller reduced the asking price in the last 7 days. ` +
      `Current list price, prior ask, drop percent, beds, baths, and sqft from the regional MLS.`,
    path: `/price-drops/${slug}`,
    keywords: [
      `price reduced homes ${cityName} Oregon`,
      `price drop homes ${cityName}`,
      `homes with price reductions ${cityName} OR`,
      `reduced asking price ${cityName} Oregon`,
      `price cut homes ${cityName}`,
    ],
  })
}

export default async function PriceDropsCityPage({ params }: Props) {
  const { city: citySlug } = await params
  if (!DROPS_CITY_SLUGS.includes(citySlug)) notFound()
  const cityName = cityLabel(citySlug)
  const path = `/price-drops/${citySlug}`

  // @prerender-db-ok getPriceDrops is makeResilientCached: it never rejects, a failed read is `degraded`.
  const { drops, total, cap, fetchedAt, degraded } = await getPriceDrops({
    city: cityName,
    limit: 48,
    days: 7,
  })

  // Unknown is not empty: this copy stands for a minute, not the whole window.
  if (degraded) await refuseDegradedIsr(`price-drops/${citySlug}`, ['getPriceDrops'])

  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const medianDropPct = medianPositive(drops.map((d) => d.lastDropPct))
  const fieldItems = priceDropFieldItems(drops)
  const distribution = priceDropDistribution({
    drops,
    total,
    cap,
    placeLabel: cityName,
    windowDays: 7,
    fetchedAt: fetchedAt ? formatDate(fetchedAt) : null,
  })
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const pageUrl = `${siteUrl}${path}`

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
        { name: cityName, url: path },
      ],
    },
    // A read that did not answer has no count to state and no freshness to stamp.
    ...(degraded
      ? []
      : priceDropDatasetSchemas({
          pageUrl,
          placeName: cityName,
          total,
          shownCount: drops.length,
          totalReducedLabel,
          medianDropPctLabel,
          fetchedAt: drops.length > 0 ? fetchedAt : null,
        })),
    ...(fieldItems.length > 0
      ? [
          {
            type: 'itemList' as const,
            name: `${cityName} homes with a price cut in the last 7 days`,
            items: fieldItems.slice(0, 24).map((item) => ({
              name: `${item.priceLabel} · ${item.title}${item.dropLine ? ` · ${item.dropLine}` : ''}`,
              url: item.href.startsWith('http') ? item.href : `${siteUrl}${item.href}`,
            })),
          },
        ]
      : []),
  ]

  const siblingItems: V3QuietItem[] = DROPS_CITY_SLUGS.filter((slug) => slug !== citySlug).map(
    (slug) => ({
      label: cityLabel(slug),
      href: `/price-drops/${slug}`,
    }),
  )

  const edgeItems: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'The window',
      body: `Active single-family homes in ${cityName} whose asking price fell in the last 7 days. Drop is previous list price to current list price.`,
    },
    { label: 'All Central Oregon price drops', href: '/price-drops' },
    { label: `Homes for sale in ${cityName}`, href: homesForSalePath(cityName) },
    { label: `Open houses in ${cityName}`, href: `/open-houses/${citySlug}` },
    ...siblingItems,
  ]

  const captionCount = fieldItems.length

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <TrackSearchView city={cityName} resultsCount={degraded ? undefined : total} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Price drops', href: '/price-drops' },
            { label: cityName },
          ]}
        />

        {!degraded && captionCount > 0 ? (
          <>
            {/* The count is the city's whole window, as on the region page. It
                printed the rendered cards, so a capped list read as the city's
                total. When the list is capped, the label says so. */}
            <PriceDropsOpening
              heading={`Price drops in ${cityName}`}
              headline={`Price drops in ${cityName}`}
              captionValue={total.toLocaleString('en-US')}
              captionLabel={
                total === 1
                  ? `price cut in ${cityName}`
                  : total > captionCount
                    ? `price cuts in ${cityName} · ${captionCount} shown below`
                    : `price cuts in ${cityName}`
              }
            />
            <div className="pd-fold">
              <V3Field
                id="cuts"
                className="pd-homes-field"
                slotSurface="photos"
                ariaLabel={`Homes in ${cityName} with a price cut in the last 7 days`}
                items={fieldItems}
                mapSlot={
                  <PriceDropsFold
                    items={fieldItems}
                    railLabel={`Homes in ${cityName} with a price cut this week`}
                    showCityDoors={false}
                  />
                }
                emptyMessage={`No price cut in ${cityName} on this pull has both a street and a list price, so this list has nothing to name.`}
              />
              {distribution ? (
                <V3Drawing
                  id="spread"
                  className="pd-spread"
                  figures={[distribution]}
                  label={`${cityName} price cuts by how far the ask came down`}
                />
              ) : null}
            </div>
            <V3SourceLine
              className={`${V3_ROOT_CLASS} pd-source`}
              sourceName="Oregon Data Share"
              asOf={fetchedAt}
              source={`${dropsTrace(cityName)}${
                medianDropPctLabel ? `. Median drop ${medianDropPctLabel}` : ''
              }${totalReducedLabel ? `, ${totalReducedLabel} in asking prices cut this week` : ''}${
                fetchedAt ? ` · updated ${formatDate(fetchedAt)}` : ''
              }`}
            />
          </>
        ) : (
          <V3Quiet
            id="answer"
            heading={`Price drops in ${cityName}`}
            headingLevel={1}
            items={[
              degraded
                ? { kind: 'prose', ...dropsUnavailable(cityName) }
                : {
                    kind: 'prose',
                    term: `Nothing in ${cityName} this window`,
                    body: `No active single-family home in ${cityName} has a documented asking-price cut in the last 7 days on this pull.`,
                  },
              { label: 'All Central Oregon price drops', href: '/price-drops' },
            ]}
          />
        )}

        <PriceDropAlertsSheet
          placeLabel={cityName}
          city={cityName}
          extraFilters={DROPS_ALERT_FILTERS}
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
