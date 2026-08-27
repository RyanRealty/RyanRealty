/**
 * cityMarketChartCards — the approved chart-room town charts on the city page,
 * as V3ChartCard entries for the market Instrument's `cards` slot (one market
 * section per page, Matt 2026-07-29). The KB-era component form rendered the
 * same five cards inside KbMarketHud; the v3 Instrument mounts cards itself,
 * so this module now builds props instead of markup. Additive: the cards sit
 * under the core trend switcher and replace nothing.
 *
 * Five cards, all drawn by the V3Chart series atom (no new chart component,
 * no second geometry — lib/charts/plot.ts):
 *   1. Months of supply by town — threshold bands, subject row bound to the
 *      SAME published figure the HUD verdict pill stamps.
 *   2. Days to pending by town — lollipop vs peers.
 *   3. Price-cut share by town — with the region reference rule.
 *   4. Sale-to-original-ask dumbbell — the latest quarter complete in BOTH
 *      years (§0: the same window across two years, never a partial).
 *   5. Median close price by complete year — the city-year read.
 *
 * Every figure arrives through the DAL; every card carries its full trace in
 * a collapsed Source disclosure (Matt 2026-08-19: never visible paragraphs).
 * A card whose data cannot be verified renders nothing — fewer charts, never
 * an invented one (CLAUDE.md section 0).
 */

import { v3Text, type V3ChartCardProps, type V3ChartProps } from '@/components/site/v3'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { getCityYearPricing } from '@/lib/data/pricing/getCityYearPricing'
import {
  getCityQuarterSaleToAsk,
  latestCompleteQuarter,
  pairCityQuarterRows,
} from '@/lib/data/pricing/getCityQuarterSaleToAsk'
import { skippableRail } from '@/lib/build-phase'
import {
  buildDtpCard,
  buildMosCard,
  buildStoCard,
  buildYearCard,
  type CityChartCard,
  type CityRankInput,
} from './city-market-charts-data'

export type CityMarketChartsProps = {
  /** Route slug (hyphenated) — the sale_pricing_facts city_slug form. */
  citySlug: string
  /** market_pulse_live geo_slug (space-separated) for the subject city. */
  geoSlug: string
  cityName: string
  /** The HUD's published months of supply (publishMonthsOfSupply output). */
  publishedMos: number | null
  /** The pulse median-days-to-pending the HUD prints. */
  publishedDtp: number | null
  /** The inventory count the page prints (publishCityInventory output). */
  displayedActiveCount: number | null
}


import { formatDate } from '@/lib/format/date'

/** One chart-room card as V3ChartCard props. The display line is the chart's
 *  caption, so the sentence prints once, and the stamp rides the source. */
function toCardProps(card: CityChartCard, wide: boolean): V3ChartCardProps {
  const chart: V3ChartProps = {
    caption: v3Text(card.displayLine),
    kind: card.kind,
    rows: card.rows,
    series: card.series,
    bands: card.bands,
    clampMax: card.clampMax,
    refValue: card.refValue,
    refLabel: card.refLabel != null ? v3Text(card.refLabel) : undefined,
    rangeKeyLabel: card.rangeKeyLabel != null ? v3Text(card.rangeKeyLabel) : undefined,
    rangeBaseKeyLabel:
      card.rangeBaseKeyLabel != null ? v3Text(card.rangeBaseKeyLabel) : undefined,
    sampleKey: card.sampleKey != null ? v3Text(card.sampleKey) : undefined,
    marks: card.marks,
  }
  return {
    id: `city-town-${card.key}`,
    title: v3Text(card.title),
    source: v3Text(
      card.updatedAt ? `${card.source} · updated ${formatDate(card.updatedAt)}` : card.source,
    ),
    wide,
    chart,
  }
}

export async function cityMarketChartCards({
  citySlug,
  geoSlug,
  cityName,
  publishedMos,
  publishedDtp,
  displayedActiveCount,
}: CityMarketChartsProps): Promise<V3ChartCardProps[]> {
  const now = new Date()
  const { quarter, year: quarterYear } = latestCompleteQuarter(now)
  // Skipped during SSG (yearPricing + quarterSto timed out on 7 of 7 build
  // renders): empty rows -> no cards -> the chart room ships nothing in the
  // build HTML and ISR refills it on first revalidate.
  const [towns, yearRows, quarterRows] = await Promise.all([
    skippableRail(() => getMarketPulseAllCitySnapshots(), [], 3500, 'city:townPulse'),
    skippableRail(() => getCityYearPricing({ citySlug }), [], 4000, 'city:yearPricing'),
    skippableRail(() => getCityQuarterSaleToAsk(quarter), [], 4000, 'city:quarterSto'),
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
  const pairs = pairCityQuarterRows(quarterRows, { quarter, currentYear: quarterYear })
  // Pulse weekly price-cut share is omitted: leftover HUD has no honest weekly
  // active cut series. MOS and DTP rows are leftover membership.
  const cards = [
    buildMosCard(rankInput),
    buildDtpCard(rankInput),
    buildStoCard(pairs, { subjectCitySlug: citySlug, subjectName: cityName, factsAsOf: null }),
    buildYearCard(yearRows, {
      subjectName: cityName,
      currentYear: now.getUTCFullYear(),
      factsAsOf: null,
    }),
  ].filter((c): c is CityChartCard => c != null)
  if (cards.length === 0) return []

  // The year line always runs full width. With an odd number of rank cards,
  // the last one also spans, so the two-column grid never leaves a hole.
  const rankCount = cards.filter((c) => c.key !== 'year').length
  const wide = (card: CityChartCard, index: number): boolean =>
    card.key === 'year' || (rankCount % 2 === 1 && index === rankCount - 1)

  return cards.map((card, i) => toCardProps(card, wide(card, i)))
}
