/**
 * /price-drops/[city] - city-scoped 7-day price cuts, on the v3 barrel.
 *
 * Same contract as the region page. generateMetadata title still leads with
 * "Price Drops in". generateStaticParams over SITE_CITY_SLUGS.
 * dynamicParams stays false so an unknown city slug 404s.
 *
 * KB-era deletions: KbHero, KbFeatured, KbListingMap, HideAwareListingGrid,
 * sibling city chips as their own pattern (they go in Quiet), KbSell, CTABar,
 * DisplayHeading/PageBreadcrumb hidden parity hacks, SmoothScrollProvider.
 * Capture contract kept on the Sheet.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { formatPriceCompact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { PriceDropAlertsSheet } from '../_v3/PriceDropAlertsSheet.client'
import {
  DROPS_CITY_SLUGS,
  DROPS_FIELD_TRACE,
  DROPS_TRACE,
  cityLabel,
  medianPositive,
} from '../_v3/drops-constants'
import { priceDropFieldItems } from '../_v3/drops-field-items'
import { priceDropDatasetSchemas } from '../_v3/drops-jsonld'

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
    limit: 48,
    days: 7,
  }).catch(() => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }))

  if (drops.length === 0) {
    noStore()
  }

  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const medianDropPct = medianPositive(drops.map((d) => d.lastDropPct))
  const fieldItems = priceDropFieldItems(drops)
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
  const stamp =
    drops.length > 0
      ? (() => {
          const label = formatDate(fetchedAt)
          return /\d/.test(label) ? label : null
        })()
      : null

  const figures: V3InstrumentFigure[] = []
  if (total > 0) {
    figures.push({
      value: v3Text(total.toLocaleString('en-US')),
      label: v3Text(total === 1 ? `price cut in ${cityName}` : `price cuts in ${cityName}`),
      href: '#cuts',
    })
  }
  if (totalReducedLabel) {
    figures.push({
      value: v3Text(totalReducedLabel),
      label: v3Text('asking-price cuts this week'),
      href: '#cuts',
    })
  }
  if (medianDropPctLabel) {
    figures.push({
      value: v3Text(medianDropPctLabel),
      label: v3Text('median drop'),
      href: '#cuts',
    })
  }
  const [firstFigure, ...restFigures] = figures

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
      totalReducedLabel,
      medianDropPctLabel,
      fetchedAt: drops.length > 0 ? fetchedAt : null,
    }),
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

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="price-drops-city" />
        <TrackSearchView city={cityName} resultsCount={total} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Price drops', href: '/price-drops' },
            { label: cityName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="answer"
            level={1}
            eyebrow={v3Text(`${cityName} · last 7 days`)}
            headline={v3Text(`Price drops in ${cityName}`)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(DROPS_TRACE)}
            {...(stamp ? { updated: v3Text(stamp) } : {})}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(path),
              variant: 'primary',
            }}
          />
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

        <V3Field
          id="cuts"
          ariaLabel={`Homes in ${cityName} with a price cut in the last 7 days`}
          items={fieldItems}
          count={
            fieldItems.length > 0
              ? {
                  value: fieldItems.length.toLocaleString('en-US'),
                  label: fieldItems.length === 1 ? `home in ${cityName}` : `homes in ${cityName}`,
                  source: DROPS_FIELD_TRACE,
                }
              : undefined
          }
          emptyMessage={`No price cut in ${cityName} on this pull has both a street and a list price, so this list has nothing to name.`}
        />

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
