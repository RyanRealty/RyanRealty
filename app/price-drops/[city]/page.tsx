/**
 * /price-drops/[city] - city-scoped 7-day price cuts, on the v3 barrel.
 *
 * Same contract as the region page. Opening is Field of this city's cut
 * houses. Count is a caption. generateMetadata title still leads with
 * "Price Drops in". generateStaticParams over SITE_CITY_SLUGS.
 * dynamicParams stays false so an unknown city slug 404s.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { homesForSalePath } from '@/lib/slug'
import { formatDate } from '@/lib/format/date'
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
import { PriceDropAlertsSheet } from '../_v3/PriceDropAlertsSheet.client'
import { DROPS_CITY_SLUGS, cityLabel, dropsTrace } from '../_v3/drops-constants'
import {
  pageDeepestCut,
  pageMedianCut,
  priceDropFieldItems,
} from '../_v3/drops-field-items'
import { priceDropDistribution } from '../_v3/drops-drawing'
import { priceDropDatasetSchemas } from '../_v3/drops-jsonld'
import { PriceDropPhotos, PriceDropsOpening, priceDropsDeck } from '../_v3/PriceDropsField'

export const revalidate = 1800
export const dynamicParams = false

/** The pull's row cap. Named because the caption prints both counts. */
const PRICE_DROPS_LIMIT = 48

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
      `Active homes in ${cityName}, Oregon where the seller has reduced the asking price in the last 7 days. ` +
      `Current list price, original list price, and drop percentage from the regional MLS.`,
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

  const { drops, total, fetchedAt } = await getPriceDrops({
    city: cityName,
    limit: PRICE_DROPS_LIMIT,
    days: 7,
  }).catch(() => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }))

  if (drops.length === 0) {
    noStore()
  }

  const fieldItems = priceDropFieldItems(drops)
  // ONE median and ONE deepest over ONE population, the same way the region
  // page does it: the rows this page renders (§0).
  const medianDropPct = pageMedianCut(fieldItems)
  const deepestShownPct = pageDeepestCut(fieldItems)
  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const distribution = priceDropDistribution({
    drops,
    total,
    cap: PRICE_DROPS_LIMIT,
    placeLabel: cityName,
    windowDays: 7,
    fetchedAt: fetchedAt ? formatDate(fetchedAt) : null,
    medianPct: medianDropPct,
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
    ...priceDropDatasetSchemas({
      pageUrl,
      placeName: cityName,
      total,
      shownCount: fieldItems.length,
      totalReducedLabel,
      medianDropPctLabel,
      fetchedAt: drops.length > 0 ? fetchedAt : null,
    }),
    ...(fieldItems.length > 0
      ? [
          {
            type: 'itemList' as const,
            name: `${cityName} homes with a price cut in the last 7 days`,
            items: fieldItems.map((item) => ({
              name: [item.cutLabel, item.priceLabel, item.title]
                .filter((part): part is string => Boolean(part))
                .join(' · '),
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
        <TrackSearchView city={cityName} resultsCount={total} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Price drops', href: '/price-drops' },
            { label: cityName },
          ]}
        />

        {captionCount > 0 ? (
          <>
            {/* THE COUNT IS THE FULL POPULATION. Until SITE-108 this caption
                published `captionCount` — the capped, rendered slice — as
                "40 price cuts in Bend" while the window held 115. The region
                page fixed the same figure on 2026-09-15 and this route was
                missed; two counts for one question is the §0 failure. */}
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
              captionDrillHref={distribution ? '#spread' : '#cuts'}
              captionDrillLabel={
                distribution ? 'see how far each ask came down' : 'browse the cuts'
              }
              deck={priceDropsDeck({
                placeLabel: cityName,
                shownCount: captionCount,
                medianPct: medianDropPct,
                deepestPct: deepestShownPct,
              })}
            />
            <div className="pd-fold">
              <V3Field
                id="cuts"
                className="pd-homes-field"
                ariaLabel={`Homes in ${cityName} with a price cut in the last 7 days`}
                items={fieldItems}
                mapSlot={<PriceDropPhotos items={fieldItems} />}
                emptyMessage={`No price cut in ${cityName} on this pull has both a street and a list price, so this list has nothing to name.`}
              />
              {distribution ? (
                <V3Drawing
                  id="spread"
                  className="pd-spread"
                  figures={[distribution]}
                  label={`This week's ${cityName} price cuts by how far the ask came down`}
                />
              ) : null}
            </div>
            <V3SourceLine
              className="pd-source"
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
              {
                kind: 'prose',
                term: `Nothing in ${cityName} this window`,
                body: `No active single-family home in ${cityName} has a documented asking-price cut in the last 7 days on this pull.`,
              },
              { label: 'All Central Oregon price drops', href: '/price-drops' },
            ]}
          />
        )}

        <PriceDropAlertsSheet placeLabel={cityName} city={cityName} />

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
