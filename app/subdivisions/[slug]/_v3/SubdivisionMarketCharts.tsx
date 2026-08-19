/**
 * SubdivisionMarketCharts — the approved chart-room forms on a plat page,
 * rendered INSIDE the existing sales-history section so the page still carries
 * one market section (same rule the city page follows in
 * app/cities/[slug]/_v3/city-market-charts.tsx). Additive: the year table it
 * sits above is unchanged.
 *
 * Three cards, all drawn by the V3Chart series atom through V3ChartCard. No
 * new chart component and no second geometry (lib/charts/plot.ts):
 *   1. The plat's own record, price against volume on a segmented control.
 *   2. The plat's median beside the market it sits inside, city when the
 *      parent city is known and carried in the mart, region otherwise.
 *   3. The rank form: this plat among the sibling plats of its resort
 *      community, every row carrying its own year-to-date population.
 *
 * A plat is a small-sample geography. Every floor and every withheld year is
 * stated in subdivision-charts-data.ts and named in each card's Source trace.
 * A card whose data cannot carry it returns undefined and nothing renders.
 */

import { slugify } from '@/lib/slug'
import { V3_ROOT_CLASS, V3ChartCard, type V3ChartCardProps } from '@/components/site/v3'
import { getMartAnnualSeries } from '@/lib/data/analytics/getCoMarketAnnual'
import { getMarketStatsCacheRowsForGeos } from '@/lib/data/market/getMarketStatsCacheRows'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import resortCommunitiesData from '@/data/resort-communities.json'
import {
  buildPeerPlatsCard,
  buildPlatHistoryCard,
  buildPlatVsAreaCard,
  type AreaSeries,
  type PeerPlatRow,
} from './subdivision-charts-data'

const REGION_SLUG = 'central-oregon'
const REGION_LABEL = 'Central Oregon'

type ResortEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases: string[]
}

/** The registry row whose alias set is the plat's peer group, or null. */
function resortEntryFor(resortSlug: string | null): ResortEntry | null {
  if (!resortSlug) return null
  const communities = (resortCommunitiesData as { communities: ResortEntry[] }).communities
  return communities.find((c) => c.slug === resortSlug) ?? null
}

/** The cache columns the rank card's rows and its trace both need. */
const PEER_COLUMNS =
  'geo_slug, geo_label, sold_count, median_sale_price, period_start, period_end, methodology_version, computed_at'

type PeerCacheRow = {
  geo_slug?: string | null
  geo_label?: string | null
  sold_count?: number | null
  median_sale_price?: number | string | null
  period_start?: string | null
  period_end?: string | null
  methodology_version?: string | null
  computed_at?: string | null
}

export type SubdivisionMarketChartsProps = {
  slug: string
  platName: string
  /** Route slug of the parent city when one is known, else null. */
  citySlug: string | null
  cityName: string
  /** Registry resort slug when this plat belongs to one, else null. */
  resortSlug: string | null
  history: readonly SubdivisionSalesYear[]
}

export async function SubdivisionMarketCharts({
  slug,
  platName,
  citySlug,
  cityName,
  resortSlug,
  history,
}: SubdivisionMarketChartsProps) {
  if (history.length === 0) return null

  const resort = resortEntryFor(resortSlug)
  const peerSlugs = resort
    ? [...new Set(resort.subdivision_aliases.map((a) => slugify(a)))]
    : []

  const [cityRows, regionRows, peerRows] = await Promise.all([
    citySlug
      ? withTimeoutFallback(
          getMartAnnualSeries({ geoType: 'city', geoSlug: citySlug, typeScope: 'sfr' }),
          [],
          4000,
          'sub:mart-city',
        )
      : Promise.resolve([]),
    withTimeoutFallback(
      getMartAnnualSeries({ geoType: 'region', geoSlug: REGION_SLUG, typeScope: 'sfr' }),
      [],
      4000,
      'sub:mart-region',
    ),
    peerSlugs.length > 1
      ? withTimeoutFallback(
          getMarketStatsCacheRowsForGeos({
            geoType: 'subdivision',
            geoSlugs: peerSlugs,
            periodType: 'ytd',
            columns: PEER_COLUMNS,
          }),
          [],
          4000,
          'sub:peer-stats',
        )
      : Promise.resolve([]),
  ])

  // Prefer the parent city. A plat with no derived city, or a city the cube
  // does not carry, is compared to the region rather than to nothing.
  const area: AreaSeries | null =
    cityRows.length >= 2 && citySlug
      ? { label: cityName, slug: citySlug, kind: 'city', rows: cityRows }
      : regionRows.length >= 2
        ? { label: REGION_LABEL, slug: REGION_SLUG, kind: 'region', rows: regionRows }
        : null

  const currentYear = new Date().getUTCFullYear()

  const peers: PeerPlatRow[] = []
  let unnamedCount = 0
  let periodStart: string | null = null
  let periodEnd: string | null = null
  let methodologyVersion: string | null = null
  let computedAt: string | null = null
  for (const raw of peerRows as unknown as PeerCacheRow[]) {
    const peerSlug = (raw.geo_slug ?? '').trim()
    if (!peerSlug) continue
    const name = publishPlatDisplayName(raw.geo_label ?? peerSlug)
    if (!name) {
      unnamedCount += 1
      continue
    }
    const median = raw.median_sale_price == null ? null : Number(raw.median_sale_price)
    peers.push({
      slug: peerSlug,
      name,
      soldCount: Number(raw.sold_count ?? 0),
      medianSalePrice: median != null && Number.isFinite(median) ? median : null,
    })
    if (raw.period_start && (periodStart == null || raw.period_start < periodStart)) {
      periodStart = raw.period_start
    }
    if (raw.period_end && (periodEnd == null || raw.period_end > periodEnd)) {
      periodEnd = raw.period_end
    }
    if (!methodologyVersion && raw.methodology_version) methodologyVersion = raw.methodology_version
    if (raw.computed_at && (computedAt == null || raw.computed_at > computedAt)) {
      computedAt = raw.computed_at
    }
  }

  const cards: V3ChartCardProps[] = []
  const historyCard = buildPlatHistoryCard(history, { platName, currentYear })
  if (historyCard) cards.push(historyCard)
  if (area) {
    const areaCard = buildPlatVsAreaCard(history, area, { platName, currentYear })
    if (areaCard) cards.push(areaCard)
  }
  if (resort && peers.length > 0) {
    const peerCard = buildPeerPlatsCard(peers, slug, {
      parentLabel: resort.label,
      unnamedCount,
      periodStart,
      periodEnd,
      methodologyVersion,
      computedAt,
    })
    if (peerCard) cards.push(peerCard)
  }
  if (cards.length === 0) return null

  return (
    <div className={V3_ROOT_CLASS}>
      <div
        className="v3-instrument__cards"
        aria-label={`${platName} closed-sale charts`}
        role="group"
      >
        {cards.map((card) => (
          <V3ChartCard key={card.id ?? card.title} {...card} />
        ))}
      </div>
    </div>
  )
}
