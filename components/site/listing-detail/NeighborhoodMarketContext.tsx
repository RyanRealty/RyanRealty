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
import type { MarketPulse, MarketStats } from '@/lib/data/types/market'

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
  pulse: MarketPulse | null
  stats: MarketStats | null
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
  pulse,
  stats,
  thisListPrice,
  refreshedAt,
  className,
  chartCitySlug,
}: Props) {
  if (!pulse && !stats) return null

  // Tabbed core-chart module at the listing's CITY scope. City cache rows key
  // multi-word cities space-separated ("la pine"). Fails soft: no derivable
  // city, a timeout, or zero chartable series → no module, KPI cells unharmed.
  const citySlug = chartCitySlug ?? deriveCitySlugFromHubHref(hubHref)
  const coreCharts = citySlug
    ? await withTimeoutFallback(
        getCoreChartSeries({ geoType: 'city', geoSlug: citySlug.replace(/-/g, ' ') }),
        null,
        4000,
        'listing:coreCharts',
      )
    : null
  const cityLabel = citySlug ? cityDisplayName(citySlug) : null
  const chartScopeLabel = cityLabel && cityLabel !== geoName ? `${cityLabel} (city)` : undefined

  const activeCount = pulse?.activeCount ?? null
  const medianList = pulse?.medianListPrice ?? stats?.medianListPrice ?? null
  const medianDom = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null
  const mos = pulse?.monthsOfSupply ?? stats?.monthsOfSupply ?? null
  const freshness = refreshedAt ?? pulse?.refreshedAt ?? stats?.refreshedAt ?? null
  const freshnessLabel = formatFreshness(freshness)
  const diffPct = diffPctVsMedian(thisListPrice, medianList)
  const aboveOrBelow = diffPct == null ? null : diffPct >= 0 ? 'above' : 'below'

  return (
    <section className={cn('section mkt', className)} style={{ padding: 0 }}>
      <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {/* KB navy sec-head inside the mkt surface */}
        <div className="sec-head" style={{ borderBottomColor: 'rgba(250,248,244,0.28)' }}>
          <div>
            <div className="eyebrow sec-index" style={{ color: 'rgba(250,248,244,0.55)' }}>
              Live market context
            </div>
            <h2 className="sec-title display" style={{ color: 'var(--cream, #faf8f4)' }}>
              {geoName} market
            </h2>
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
          style={{ ['--kpi-cols' as string]: [activeCount, medianList, medianDom, mos].filter(v => v != null).length }}
        >
          {activeCount != null ? (
            <KpiCell label={`Active in ${geoName}`} value={<TabularNumber value={activeCount} />} />
          ) : null}
          {medianList != null ? (
            <KpiCell label="Median list" value={<Price value={medianList} compact />} />
          ) : null}
          {medianDom != null ? (
            <KpiCell label="Median DOM" value={<><TabularNumber value={medianDom} /> days</>} />
          ) : null}
          {mos != null ? (
            <KpiCell label="Months of supply" value={<TabularNumber value={mos} fractionDigits={1} />} />
          ) : null}
        </div>

        {/* Tabbed core-chart module under the KPI cells — city-scope trends,
            labeled when the scope differs from this section's subject. Renders
            nothing when no series is chartable. (§0) */}
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
              <b style={{ color: 'var(--cream, #faf8f4)' }}>
                <Price value={thisListPrice} />
              </b>
              {', '}
              <span style={{ color: 'var(--cream, #faf8f4)', fontVariantNumeric: 'tabular-nums' }}>
                <TabularNumber value={Math.abs(diffPct)} fractionDigits={1} />% {aboveOrBelow}
              </span>{' '}
              the {geoName} median.{' '}
              <TextLink href={hubHref} underline="on-hover" className="text-sm" style={{ color: 'rgba(250,248,244,0.7)' }}>
                See full {geoName} market →
              </TextLink>
            </p>
          ) : (
            <p className="mkt-fine" style={{ marginTop: 0 }}>
              <TextLink href={hubHref} underline="on-hover" className="text-sm" style={{ color: 'rgba(250,248,244,0.7)' }}>
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
