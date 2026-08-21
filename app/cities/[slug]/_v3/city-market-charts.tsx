/**
 * CityMarketCharts — Chart Room Time / Relate / Rank on the city template.
 * Cards whose data cannot be verified render nothing.
 */

import { V3Chart, V3SourceDisclosure, v3Text } from '@/components/site/v3'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { getCityYearPricing } from '@/lib/data/pricing/getCityYearPricing'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  buildMosCard,
  buildRelateCard,
  buildYearCard,
  relatePeerSlug,
  type CityChartCard,
  type CityRankInput,
} from './city-market-charts-data'

export type CityMarketChartsProps = {
  citySlug: string
  geoSlug: string
  cityName: string
  publishedMos: number | null
  publishedDtp: number | null
  displayedActiveCount: number | null
}

function ChartCard({ card }: { card: CityChartCard }) {
  return (
    <article className="city-d-chart">
      <h3 className="city-d-display">{card.title}</h3>
      <V3Chart
        id={`city-chart-${card.key}`}
        caption={v3Text(card.displayLine)}
        kind={card.kind}
        rows={card.rows}
        series={card.series}
        bands={card.bands}
        clampMax={card.clampMax}
        refValue={card.refValue}
        refLabel={card.refLabel != null ? v3Text(card.refLabel) : undefined}
        rangeKeyLabel={card.rangeKeyLabel != null ? v3Text(card.rangeKeyLabel) : undefined}
        rangeBaseKeyLabel={
          card.rangeBaseKeyLabel != null ? v3Text(card.rangeBaseKeyLabel) : undefined
        }
        sampleKey={card.sampleKey != null ? v3Text(card.sampleKey) : undefined}
        marks={card.marks}
      />
      <V3SourceDisclosure className="mt-3" source={card.source} updatedAt={card.updatedAt} />
    </article>
  )
}

export async function CityMarketCharts({
  citySlug,
  geoSlug,
  cityName,
  publishedMos,
  publishedDtp,
  displayedActiveCount,
}: CityMarketChartsProps) {
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const peerSlug = relatePeerSlug(citySlug)
  const [towns, yearRows] = await Promise.all([
    withTimeoutFallback(getMarketPulseAllCitySnapshots(), [], 3500, 'city:townPulse'),
    withTimeoutFallback(getCityYearPricing(), [], 4000, 'city:yearPricing'),
  ])

  const rankInput: CityRankInput = {
    towns,
    region: null,
    subjectGeoSlug: geoSlug,
    subjectName: cityName,
    publishedMos,
    publishedDtp,
    displayedActiveCount,
  }
  const subjectYears = yearRows.filter((r) => r.citySlug === citySlug)
  const cards = [
    buildYearCard(subjectYears, {
      subjectName: cityName,
      currentYear,
      factsAsOf: null,
    }),
    buildRelateCard(yearRows, {
      subjectSlug: citySlug,
      subjectName: cityName,
      peerSlug,
      currentYear,
      factsAsOf: null,
    }),
    buildMosCard(rankInput),
  ].filter((c): c is CityChartCard => c != null)
  if (cards.length === 0) return null

  return (
    <div className="city-d-charts" aria-label={`${cityName} Chart Room Time, Relate, and Rank`}>
      {cards.map((card) => (
        <ChartCard key={card.key} card={card} />
      ))}
    </div>
  )
}
