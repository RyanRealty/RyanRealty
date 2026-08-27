/**
 * neighborhoodMarketChartCards — the approved chart-room forms on a Bend
 * district page, as V3ChartCard entries for the market Instrument's `cards`
 * slot (one market section per page, Matt 2026-07-29). The KB-era component
 * form rendered the same four cards inside KbMarketHud; the v3 Instrument
 * mounts cards itself, so this module now builds props instead of markup.
 * Additive: the cards sit under the Instrument figures and replace nothing.
 *
 * Four cards, all drawn by the V3Chart series atom (no new chart component, no
 * second geometry — lib/charts/plot.ts):
 *   1. This district's own closed history, 1997 forward — median close,
 *      median $/sqft, homes sold, as three views of one population behind a
 *      V3ChartSwitch (dollars and counts never share an axis).
 *   2. This district against all thirteen, both indexed to the same base year.
 *   3. Median close by district for the latest complete year.
 *   4. Median asking price by district, live.
 *
 * Cards 1–3 read the closed population (neighborhood_year_pricing_mv, the
 * polygon assignment). Card 4 reads the active population
 * (getBendNeighborhoodPublicInventory) — the same read behind this page's own
 * count and median asking price. The two are never mixed under one label.
 *
 * Nothing here charts a neighborhood pulse or stats-cache closed figure: both
 * under-count closings at this grain by 6x to 16x (see the data module and the
 * MV migration for the reconciliation). A card whose data cannot be verified
 * renders nothing — fewer charts, never an invented one (CLAUDE.md §0).
 */

import { v3Text, type V3ChartCardProps, type V3ChartProps } from '@/components/site/v3'
import {
  ALL_BEND_DISTRICTS_SLUG,
  getAllNeighborhoodYearPricing,
} from '@/lib/data/geo/getNeighborhoodYearPricing'
import { getBendNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { skippableRail } from '@/lib/build-phase'
import {
  buildAskingRankCard,
  buildClosedRankCard,
  buildDistrictHistoryCard,
  buildIndexedCard,
  type NeighborhoodChartCard,
  type NeighborhoodChartView,
} from './neighborhood-market-charts-data'

export type NeighborhoodMarketChartsProps = {
  /** `bend-<district>` boundary slug — the MV + inventory key. */
  geoSlug: string
  /** Display name, e.g. "Awbrey Butte". */
  districtName: string
}


/** One view as V3Chart props — same field mapping the KB card rendered. */
function viewChart(view: NeighborhoodChartView): V3ChartProps {
  return {
    caption: v3Text(view.caption),
    kind: view.kind,
    series: view.series,
    rows: view.rows,
    marks: view.marks,
    run: view.run,
    baselineLabel: view.baselineLabel != null ? v3Text(view.baselineLabel) : undefined,
    sampleKey: view.sampleKey != null ? v3Text(view.sampleKey) : undefined,
  }
}

function toCardProps(card: NeighborhoodChartCard, wide: boolean): V3ChartCardProps {
  const base = {
    id: `nbh-${card.key}`,
    title: v3Text(card.title),
    line: v3Text(card.displayLine),
    source: v3Text(card.source),
    wide,
  }
  if (card.views) {
    return {
      ...base,
      switcher: {
        label: v3Text(card.views.switchLabel),
        items: card.views.items.map((it) => ({ key: it.key, label: v3Text(it.label) })),
        panels: card.views.panels.map((panel) => viewChart(panel)),
      },
    }
  }
  return { ...base, chart: card.view ? viewChart(card.view) : undefined }
}

export async function neighborhoodMarketChartCards({
  geoSlug,
  districtName,
}: NeighborhoodMarketChartsProps): Promise<V3ChartCardProps[]> {
  // Skipped during SSG: empty rows -> no cards -> the chart room ships
  // nothing in the build HTML and ISR refills it on first revalidate.
  const [yearRows, inventory] = await Promise.all([
    skippableRail(() => getAllNeighborhoodYearPricing(), [], 4000, 'nbh:yearPricing'),
    skippableRail(() => getBendNeighborhoodPublicInventory(), [], 3500, 'nbh:inventoryBatch'),
  ])

  const currentYear = new Date().getUTCFullYear()
  const districtRows = yearRows.filter((r) => r.geoSlug === geoSlug)
  const allDistrictRows = yearRows.filter((r) => r.geoSlug === ALL_BEND_DISTRICTS_SLUG)
  const allLabel = allDistrictRows[0]?.geoLabel ?? 'All Bend districts'

  const cards = [
    buildDistrictHistoryCard(districtRows, { districtName, currentYear }),
    buildIndexedCard(districtRows, allDistrictRows, { districtName, allLabel, currentYear }),
    buildClosedRankCard(yearRows, { subjectGeoSlug: geoSlug, districtName, currentYear }),
    buildAskingRankCard(inventory, { subjectGeoSlug: geoSlug, districtName }),
  ].filter((c): c is NeighborhoodChartCard => c != null)
  if (cards.length === 0) return []

  // The two time series always run full width. With an odd number of the
  // remaining rank cards, the last one spans too, so the grid never ends on a
  // half-empty row.
  const rankCards = cards.filter((c) => !c.wide)
  const wideFor = (card: NeighborhoodChartCard): boolean =>
    Boolean(card.wide) ||
    (rankCards.length % 2 === 1 && rankCards[rankCards.length - 1]?.key === card.key)

  return cards.map((card) => toCardProps(card, wideFor(card)))
}
