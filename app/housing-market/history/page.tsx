// @no-parity — analytics explorer; no mockup kit directory
/**
 * /housing-market/history — constrained unique closed-sales search (CO),
 * on the components/site/v3 barrel.
 *
 * Data: analyzeClosedSales (result_cache -> mart -> SQL aggregate RPC). No
 * listings paging. Amenity share for the selected year comes from
 * getCoFeatureAnnual (region, all types). That cube is a comparison
 * (chart inventory A20) and stays figures, not one flattened number.
 * Amenity share is one year, not a time series, so it does not take chart.
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
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { formatDate } from '@/lib/format/date'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { valuationHref } from '@/lib/site/valuation-href'
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

  const kpiFigures: V3InstrumentFigure[] = [
    {
      value: v3Text(result.soldCount.toLocaleString('en-US')),
      label: v3Text('closes'),
      href: `/housing-market/history?year=${year}`,
    },
    {
      value: v3Text(formatPriceCompact(result.totalVolume)),
      label: v3Text('volume'),
      href: `/housing-market/history?year=${year}`,
    },
  ]
  if (result.medianClose != null && Number.isFinite(result.medianClose) && result.medianClose > 0) {
    kpiFigures.push({
      value: v3Text(`$${Math.round(result.medianClose).toLocaleString('en-US')}`),
      label: v3Text('median close'),
      href: `/housing-market/history?year=${year}`,
    })
  }
  const [firstKpi, ...restKpi] = kpiFigures

  const amenityFigures: V3InstrumentFigure[] = []
  if (featureCube && featureCube.rows.length > 0) {
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

  const computedLabel = result.computedAt ? formatDate(result.computedAt) : null

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="market-report" />
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
            eyebrow={v3Text('Unique search · aggregates only')}
            headline={v3Text(`Closed sales explorer, ${year}`)}
            figures={[firstKpi, ...restKpi]}
            source={v3Text(
              `${ANALYTICS_METHODOLOGY_V1}. Active query: ${filterBits.join(' · ')}. Aggregates only. No sold addresses on this page`,
            )}
            updated={computedLabel ? v3Text(computedLabel) : undefined}
            action={{
              label: v3Text('Slice closed sales'),
              href: '#query',
              variant: 'primary',
            }}
          />
        ) : null}

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
            eyebrow={v3Text(`Amenity share for CO ${year}`)}
            headline={v3Text(`Fireplace, garage, and HOA share, ${year}`)}
            figures={[firstAmenity, ...restAmenity]}
            source={v3Text(
              `Precomputed feature cubes (typed columns only). Region, all property types. Not filtered by the query above. Source ${featureCube?.source ?? 'mart'}. Fireplace uses fireplace_yn or fireplaces_total greater than zero. Garage uses garage_yn. Association uses association_yn (HOA)`,
            )}
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
