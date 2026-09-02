import {
  Price,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { PRIMARY_CITIES } from '@/lib/cities'
import { slugify } from '@/lib/slug'
import { parseCommunitySlug } from '@/lib/community-slug'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'
import { MarketCoreCharts } from '@/components/market/MarketCoreCharts'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { PublicProductTypes } from '@/app/cities/[slug]/PublicProductTypes'

/**
 * NeighborhoodMarketContext — THE Zillow beater. KB section style:
 * navy surface, Amboqia heading, mono KPI cells, and the tabbed core-chart
 * module (MarketCoreCharts) under the KPI cells at the listing's CITY scope
 * (city monthly cache series are dense; subdivision series are too sparse to
 * chart honestly).
 *
 * Server component: it fetches the core-chart series itself (timeout-guarded,
 * fails soft to no module — the KPI cells never depend on it).
 *
 * Spec: design_system/ryan-realty/ui_kits/listing-detail/index.html §nbhd-context
 */

type Props = {
  geoName: string
  hubHref: string
  hud: LeftoverHudKpis | null
  leftoverPace?: PublicPaceRow | null
  thisListPrice: number | null
  refreshedAt?: string
  className?: string
  /**
   * The listing's city slug (hyphenated, e.g. "la-pine") for the chart module
   * scope. Optional: when absent it is derived from hubHref ("/cities/<slug>"
   * directly, "/communities/<slug>" via the community registry). Underivable →
   * the module is simply omitted.
   */
  chartCitySlug?: string | null
}

/** Derive the city slug behind this market context from its hub link. */
export function deriveCitySlugFromHubHref(hubHref: string): string | null {
  const city = hubHref.match(/^\/cities\/([^/?#]+)/)
  if (city) return city[1]!
  const community = hubHref.match(/^\/communities\/([^/?#]+)/)
  if (community) {
    const parsed = parseCommunitySlug(community[1]!, new Set(PRIMARY_CITIES.map((name) => slugify(name))))
    if (parsed) return slugify(parsed.city)
  }
  return null
}

function cityDisplayName(citySlug: string): string {
  return citySlug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function formatFreshness(iso?: string | null): string {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes} min ago`
    const hours = Math.round(diffMinutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

function diffPctVsMedian(price: number | null, median: number | null): number | null {
  if (price == null || median == null || median <= 0) return null
  return ((price - median) / median) * 100
}

export async function NeighborhoodMarketContext({
  geoName,
  hubHref,
  hud,
  leftoverPace,
  thisListPrice,
  refreshedAt,
  className,
  chartCitySlug,
}: Props) {
  if (!hud) return null

  // Tabbed core-chart module at the listing's CITY scope. City cache rows key
  // multi-word cities space-separated ("la pine"). Fails soft: no derivable
  // city, a timeout, or zero chartable series → no module, KPI cells unharmed.
  const citySlug = chartCitySlug ?? deriveCitySlugFromHubHref(hubHref)
  const [coreCharts, leftover, publicSegments] = await Promise.all([
    citySlug
      ? withTimeoutFallback(
          getCoreChartSeries({ geoType: 'city', geoSlug: citySlug.replace(/-/g, ' ') }),
          null,
          4000,
          'listing:coreCharts',
        )
      : Promise.resolve(null),
    leftoverPace
      ? Promise.resolve(leftoverPace)
      : citySlug
        ? withTimeoutFallback(
            getPublicDetachedPace({ geoType: 'city', geoSlug: citySlug }),
            EMPTY_PUBLIC_PACE,
            3000,
            'listing:pace',
          )
        : Promise.resolve(EMPTY_PUBLIC_PACE),
    citySlug
      ? withTimeoutFallback(
          getPublicPlaceSegments({ geoType: 'city', geoSlug: citySlug }),
          [],
          3000,
          'listing:segments',
        )
      : Promise.resolve([]),
  ])
  const cityLabel = citySlug ? cityDisplayName(citySlug) : null
  const chartScopeLabel = cityLabel && cityLabel !== geoName ? `${cityLabel} (city)` : undefined

  const activeCount = hud.active
  const medianList = hud.medianList
  const daysToPending = hud.daysToPending
  const mos = hud.monthsSupply
  const freshness = refreshedAt ?? null
  const freshnessLabel = formatFreshness(freshness)
  const diffPct = diffPctVsMedian(thisListPrice, medianList)
  const aboveOrBelow = diffPct == null ? null : diffPct >= 0 ? 'above' : 'below'

  return (
    <section className={cn('section mkt', className)} style={{ padding: 0 }}>
      <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {/* Leftover HUD as compact fact rows. */}
        <div className="sec-head">
          <div>
            <div className="eyebrow sec-index">Live market context</div>
            <h2 className="sec-title">{geoName} market</h2>
          </div>
          {freshnessLabel ? (
            <div
              className="mkt-live"
              style={{ flexShrink: 0 }}
            >
              <span className="dot" aria-hidden />
              <span className="txt">Updated {freshnessLabel}</span>
            </div>
          ) : null}
        </div>

        {/* KPI cells — column count drives the desktop layout via a CSS var so
            the responsive rule in kb.css can collapse to 2-up on mobile (an inline
            grid-template-columns would override that and overflow at 375px). */}
        <div
          className="mkt-kpis"
          style={{ ['--kpi-cols' as string]: [activeCount, hud.pending, medianList, daysToPending, mos, leftover.daysToContract].filter(v => v != null).length }}
        >
          {activeCount != null ? (
            <KpiCell label={`Active in ${geoName}`} value={<TabularNumber value={activeCount} />} />
          ) : null}
          {hud.pending != null ? (
            <KpiCell label="Under contract now" value={<TabularNumber value={hud.pending} />} />
          ) : null}
          {medianList != null ? (
            <KpiCell label="Median list" value={<Price value={medianList} compact />} />
          ) : null}
          {daysToPending != null ? (
            <KpiCell
              label="Median to pending · 90 days"
              value={<><TabularNumber value={daysToPending} /> days</>}
            />
          ) : null}
          {mos != null ? (
            <KpiCell label="Months of supply" value={<TabularNumber value={mos} fractionDigits={1} />} />
          ) : null}
          {leftover.daysToContract != null ? (
            <KpiCell
              label="Days to contract · 12 months"
              value={<TabularNumber value={leftover.daysToContract} />}
            />
          ) : null}
        </div>

        {/* Tabbed core-chart module under the KPI cells — city-scope trends,
            labeled when the scope differs from this section's subject. Renders
            nothing when no series is chartable. (§0) */}
        {citySlug && publicSegments.length > 0 ? (
          <div className="mt-4 mb-2">
            <PublicProductTypes
              cityName={cityLabel ?? geoName}
              citySlug={citySlug}
              rows={publicSegments}
            />
          </div>
        ) : null}

        {coreCharts ? (
          <div className="mt-6 mb-2">
            <MarketCoreCharts data={toPublicCoreChartSeries(coreCharts)} scopeLabel={chartScopeLabel} />
          </div>
        ) : null}

        {/* Comparison line */}
        <div style={{ paddingBottom: 'clamp(22px,3vw,36px)' }}>
          {thisListPrice != null && medianList != null && diffPct != null && aboveOrBelow ? (
            <p className="mkt-fine" style={{ marginTop: 0 }}>
              This home is listed at{' '}
              <b>
                <Price value={thisListPrice} />
              </b>
              {', '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                <TabularNumber value={Math.abs(diffPct)} fractionDigits={1} />% {aboveOrBelow}
              </span>{' '}
              the {geoName} median list price.{' '}
              <TextLink href={hubHref} underline="on-hover" className="text-sm">
                See full {geoName} market →
              </TextLink>
            </p>
          ) : (
            <p className="mkt-fine" style={{ marginTop: 0 }}>
              <TextLink href={hubHref} underline="on-hover" className="text-sm">
                See full {geoName} market →
              </TextLink>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function KpiCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mkt-kpi">
      <div className="mkt-kpi-lbl">{label}</div>
      <div className="mkt-kpi-val">{value}</div>
    </div>
  )
}
