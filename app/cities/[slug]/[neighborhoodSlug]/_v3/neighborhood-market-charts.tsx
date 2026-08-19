/**
 * NeighborhoodMarketCharts — the approved chart-room forms on a Bend district
 * page, rendered INSIDE the market HUD section (one market section per page,
 * Matt 2026-07-29 / ci:market-section-nesting). Additive: it sits under the
 * HUD figures and replaces nothing.
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

import { V3Chart, V3ChartSwitch, V3SourceDisclosure, v3Text } from '@/components/site/v3'
import {
  ALL_BEND_DISTRICTS_SLUG,
  getAllNeighborhoodYearPricing,
} from '@/lib/data/geo/getNeighborhoodYearPricing'
import { getBendNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
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

function Chart({ view, id }: { view: NeighborhoodChartView; id: string }) {
  return (
    <V3Chart
      id={id}
      caption={v3Text(view.caption)}
      kind={view.kind}
      series={view.series}
      rows={view.rows}
      marks={view.marks}
      run={view.run}
      baselineLabel={view.baselineLabel != null ? v3Text(view.baselineLabel) : undefined}
    />
  )
}

function ChartCard({ card, wide }: { card: NeighborhoodChartCard; wide: boolean }) {
  const views = card.views
  return (
    <article
      className={
        'rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-6' +
        (wide ? ' lg:col-span-2' : '')
      }
    >
      <h3 className="mb-1 text-base font-semibold text-primary">{card.title}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{card.displayLine}</p>
      {views ? (
        <V3ChartSwitch
          label={v3Text(views.switchLabel)}
          items={views.items.map((it) => ({ key: it.key, label: v3Text(it.label) }))}
        >
          {views.panels.map((panel, i) => (
            <Chart
              key={views.items[i]?.key ?? i}
              view={panel}
              id={`nbh-${card.key}-${views.items[i]?.key ?? i}`}
            />
          ))}
        </V3ChartSwitch>
      ) : null}
      {card.view ? <Chart view={card.view} id={`nbh-${card.key}`} /> : null}
      <V3SourceDisclosure className="mt-3" source={card.source} />
    </article>
  )
}

export async function NeighborhoodMarketCharts({
  geoSlug,
  districtName,
}: NeighborhoodMarketChartsProps) {
  const [yearRows, inventory] = await Promise.all([
    withTimeoutFallback(getAllNeighborhoodYearPricing(), [], 4000, 'nbh:yearPricing'),
    withTimeoutFallback(getBendNeighborhoodPublicInventory(), [], 3500, 'nbh:inventoryBatch'),
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
  if (cards.length === 0) return null

  // The two time series always run full width. With an odd number of the
  // remaining rank cards, the last one spans too, so the grid never ends on a
  // half-empty row.
  const rankCards = cards.filter((c) => !c.wide)
  const wideFor = (card: NeighborhoodChartCard): boolean =>
    Boolean(card.wide) ||
    (rankCards.length % 2 === 1 && rankCards[rankCards.length - 1]?.key === card.key)

  return (
    <div
      role="group"
      className="grid gap-4 pt-6 lg:grid-cols-2"
      aria-label={`${districtName} sales history and Bend district comparisons`}
    >
      {cards.map((card) => (
        <ChartCard key={card.key} card={card} wide={wideFor(card)} />
      ))}
    </div>
  )
}
