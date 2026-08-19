// @no-parity — analytics explorer; no mockup kit directory
/**
 * /housing-market/history — constrained unique closed-sales search (CO),
 * on the components/site/v3 barrel.
 *
 * Data: analyzeClosedSales (result_cache -> mart -> SQL aggregate RPC). No
 * listings paging. Amenity share for the selected year comes from
 * getCoFeatureAnnual (region, all types). That cube is a comparison
 * (chart inventory A20). Share bars use the shared plot (kind=bars).
 *
 * DROPPED: KbBreadcrumb, KbFooter, SmoothScrollProvider, the raw query
 * <form> / <input> / <button> plate (design-token lint in a new file),
 * H2 from primitives. The query is a V3Sheet that router.push-es the
 * same year/city/type/fireplace query string. min and max already on
 * the URL still apply.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { analyzeClosedSales } from '@/lib/data/analytics/analyzeClosedSales'
import {
  getCoFeatureAnnual,
  CO_FEATURE_LABELS,
  type CoFeatureKey,
} from '@/lib/data/analytics/getCoFeatureAnnual'
import { PUBLIC_CLOSED_SALES_METHODOLOGY } from '@/lib/market/publish-public-methodology'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { formatDate } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import { valuationHref } from '@/lib/site/valuation-href'
import { medianCloseLabel, volumeCompact } from '../_v3/closed-kpis'
import { buildAmenityShareChart } from '../_v3/market-charts'
import '../_v3/tremor-density.css'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { HistoryFilterSheet } from './_v3/HistoryFilterSheet.client'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: 'Central Oregon Closed Sales Explorer',
  description:
    'Query closed Central Oregon MLS sales by year, city, property type, and fireplace. Aggregate statistics only.',
  path: '/housing-market/history',
})

type Sp = Promise<Record<string, string | string[] | undefined>>

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function HousingMarketHistoryPage({ searchParams }: { searchParams: Sp }) {
  const sp = await searchParams
  const year = Math.min(2030, Math.max(1998, Number(one(sp.year)) || 2024))
  const city = one(sp.city)?.trim() || undefined
  const propertyType = one(sp.type)?.trim() as 'A' | 'B' | 'C' | 'D' | undefined
  const fireplace = one(sp.fireplace) === '1' || one(sp.fireplace) === 'true'
  const minPrice = one(sp.min) ? Number(one(sp.min)) : undefined
  const maxPrice = one(sp.max) ? Number(one(sp.max)) : undefined

  const [result, featureCube] = await Promise.all([
    analyzeClosedSales({
      year,
      city: city || undefined,
      propertyType: propertyType && 'ABCD'.includes(propertyType) ? propertyType : undefined,
      fireplace: fireplace || undefined,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    }),
    getCoFeatureAnnual({ year }),
  ])

  const filterBits = [
    String(year),
    city || 'All cities',
    propertyType ? labelPropertyType(propertyType) : 'All types',
    fireplace ? 'Fireplace only' : null,
    minPrice != null && Number.isFinite(minPrice) ? `min ${formatPrice(minPrice)}` : null,
    maxPrice != null && Number.isFinite(maxPrice) ? `max ${formatPrice(maxPrice)}` : null,
  ].filter((bit): bit is string => Boolean(bit))

  const unfiltered = !city && !propertyType && !fireplace && minPrice == null && maxPrice == null
  const hasKpis =
    result.source !== 'empty' && result.soldCount > 0 && result.totalVolume > 0
  const volume = hasKpis ? volumeCompact(result.totalVolume) : ''
  const kpiFigures: V3InstrumentFigure[] = []
  if (hasKpis && volume) {
    kpiFigures.push({
      value: v3Text(result.soldCount.toLocaleString('en-US')),
      label: v3Text(unfiltered ? 'ALL-TYPE closes' : 'closes'),
      href: `/housing-market/history?year=${year}`,
    })
    kpiFigures.push({
      value: v3Text(volume),
      label: v3Text(unfiltered ? 'ALL-TYPE volume' : 'volume'),
      href: `/housing-market/history?year=${year}`,
    })
    const median = medianCloseLabel(result.medianClose)
    if (median) {
      kpiFigures.push({
        value: v3Text(median),
        label: v3Text(unfiltered ? 'ALL-TYPE median close' : 'median close'),
        href: `/housing-market/history?year=${year}`,
      })
    }
  }
  const [firstKpi, ...restKpi] = kpiFigures

  const amenityFigures: V3InstrumentFigure[] = []
  if (featureCube && featureCube.source === 'mart' && featureCube.rows.length > 0) {
    for (const row of featureCube.rows) {
      const label = CO_FEATURE_LABELS[row.featureKey as CoFeatureKey] ?? row.featureKey
      const share =
        row.unitSharePct != null && Number.isFinite(row.unitSharePct)
          ? `${row.unitSharePct.toFixed(1)}% of CO closes`
          : `${row.soldCount.toLocaleString('en-US')} closes`
      const href =
        row.featureKey === 'fireplace'
          ? `/housing-market/history?year=${year}&fireplace=1`
          : `/housing-market/history?year=${year}`
      amenityFigures.push({
        value: v3Text(share),
        label: v3Text(label),
        href,
      })
      if (row.medianClose != null && Number.isFinite(row.medianClose) && row.medianClose > 0) {
        amenityFigures.push({
          value: v3Text(`$${Math.round(row.medianClose).toLocaleString('en-US')}`),
          label: v3Text(`${label} median close`),
          href,
        })
      }
    }
  }
  const [firstAmenity, ...restAmenity] = amenityFigures
  const amenityChart =
    featureCube && featureCube.source === 'mart'
      ? buildAmenityShareChart(
          featureCube.rows
            .filter(
              (row) =>
                row.unitSharePct != null && Number.isFinite(row.unitSharePct) && row.unitSharePct > 0,
            )
            .map((row) => ({
              name: CO_FEATURE_LABELS[row.featureKey as CoFeatureKey] ?? row.featureKey,
              sharePct: row.unitSharePct as number,
            })),
          `Amenity share of CO closes, ${year}`,
        )
      : undefined

  const computedLabel = result.computedAt ? formatDate(result.computedAt) : null

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
                { name: 'Housing market', url: '/housing-market' },
                { name: 'Closed sales explorer', url: '/housing-market/history' },
              ],
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Closed sales explorer' },
          ]}
        />

        {firstKpi ? (
          <V3Instrument
            id="results"
            level={1}
            className="hm-tremor"
            eyebrow={v3Text('Unique search · aggregates only')}
            headline={v3Text(`Closed sales explorer, ${year}`)}
            figures={[firstKpi, ...restKpi]}
            source={v3Text(
              `${PUBLIC_CLOSED_SALES_METHODOLOGY} ${filterBits.join(' · ')}. Aggregates only. No sold addresses on this page.`,
            )}
            updated={computedLabel ? v3Text(computedLabel) : undefined}
            action={{
              label: v3Text('Slice closed sales'),
              href: '#query',
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="results"
            heading={`Closed sales explorer, ${year}`}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No matching closes',
                body:
                  result.source === 'empty'
                    ? `No closed-sales row returned for this query. This page is not printing a close count or a dollar volume. Active query: ${filterBits.join(' · ')}.`
                    : `No closed sales matched this query. This page is not printing zeros as facts. Active query: ${filterBits.join(' · ')}.`,
              },
            ]}
          />
        )}

        <HistoryFilterSheet
          year={year}
          city={city}
          propertyType={propertyType && 'ABCD'.includes(propertyType) ? propertyType : undefined}
          fireplace={fireplace}
          minPrice={Number.isFinite(minPrice) ? minPrice : undefined}
          maxPrice={Number.isFinite(maxPrice) ? maxPrice : undefined}
        />

        {firstAmenity ? (
          <V3Instrument
            id="amenities"
            level={2}
            className="hm-tremor"
            eyebrow={v3Text(`Amenity share for CO ${year}`)}
            headline={v3Text(`Fireplace, garage, and HOA share, ${year}`)}
            figures={[firstAmenity, ...restAmenity]}
            source={v3Text(
              `Precomputed feature cubes (typed columns only). Region, all property types. Not filtered by the query above. Source ${featureCube?.source ?? 'mart'}. Fireplace uses fireplace_yn or fireplaces_total greater than zero. Garage uses garage_yn. Association uses association_yn (HOA)`,
            )}
            chart={amenityChart}
          />
        ) : featureCube?.source === 'missing' ? (
          <V3Quiet
            id="amenities"
            heading={`Fireplace, garage, and HOA share, ${year}`}
            items={[
              {
                kind: 'prose',
                term: 'Fireplace share did not return',
                body: `The feature mart row for calendar year ${year} did not return on this refresh. This page is not printing a fireplace share.`,
              },
            ]}
          />
        ) : null}

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: 'Housing market hub', href: '/housing-market' },
            { label: 'Central Oregon region report', href: '/housing-market/central-oregon' },
            { label: 'Value my home', href: valuationHref('/housing-market/history') },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
