import type { ReactNode } from 'react'
import { Price, TabularNumber, TextLink } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import { PRIMARY_CITIES } from '@/lib/cities'
import { slugify } from '@/lib/slug'
import { parseCommunitySlug } from '@/lib/community-slug'
import { MarketCoreCharts } from '@/components/market/MarketCoreCharts'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import type { ListingFace } from '@/lib/listing/listing-face'
import { ListingSectionHead } from './ListingSectionHead'

/**
 * Chart Room for this listing's place. Cream surface. V3Chart via
 * MarketCoreCharts. Series arrive already cleaned (no leftover labels).
 */

type Props = {
  geoName: string
  hubHref: string
  hud: LeftoverHudKpis | null
  pace?: PublicPaceRow | null
  publishedCharts?: CoreChartSeries | null
  thisListPrice: number | null
  refreshedAt?: string
  className?: string
  chartCitySlug?: string | null
  heading?: string | false
  face?: ListingFace
}

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

export function NeighborhoodMarketContext({
  geoName,
  hubHref,
  hud,
  pace,
  publishedCharts,
  thisListPrice,
  refreshedAt,
  className,
  chartCitySlug,
  heading = 'The market',
  face = 'house',
}: Props) {
  if (!hud) return null

  const citySlug = chartCitySlug ?? deriveCitySlugFromHubHref(hubHref)
  const cityLabel = citySlug ? cityDisplayName(citySlug) : null
  const chartScopeLabel = cityLabel && cityLabel !== geoName ? `${cityLabel} city` : undefined
  const paceRow = pace ?? EMPTY_PUBLIC_PACE

  const activeCount = hud.active
  const medianList = hud.medianList
  const daysToPending = hud.daysToPending
  const mos = hud.monthsSupply
  const freshnessLabel = formatFreshness(refreshedAt ?? null)
  const diffPct = diffPctVsMedian(thisListPrice, medianList)
  const aboveOrBelow = diffPct == null ? null : diffPct >= 0 ? 'above' : 'below'

  return (
    <section className={cn('section listing-market', className)}>
      <ListingSectionHead heading={heading} eyebrow={freshnessLabel ? `Updated ${freshnessLabel}` : undefined} />

      <div
        className="listing-market-kpis"
        style={{
          ['--kpi-cols' as string]: [activeCount, hud.pending, medianList, daysToPending, mos, paceRow.daysToContract].filter(
            (v) => v != null,
          ).length,
        }}
      >
        {activeCount != null ? (
          <KpiCell label={`Active in ${geoName}`} value={<TabularNumber value={activeCount} />} />
        ) : null}
        {hud.pending != null ? (
          <KpiCell label="Pending · now" value={<TabularNumber value={hud.pending} />} />
        ) : null}
        {medianList != null ? (
          <KpiCell label="Median list" value={<Price value={medianList} />} />
        ) : null}
        {daysToPending != null ? (
          <KpiCell
            label="Median to pending, 90 days"
            value={
              <>
                <TabularNumber value={daysToPending} /> days
              </>
            }
          />
        ) : null}
        {mos != null ? (
          <KpiCell label="Months of supply" value={<TabularNumber value={mos} fractionDigits={1} />} />
        ) : null}
        {paceRow.daysToContract != null ? (
          <KpiCell label="Days to contract, 12 months" value={<TabularNumber value={paceRow.daysToContract} />} />
        ) : null}
      </div>

      {publishedCharts ? (
        <div className="listing-market-chart">
          <MarketCoreCharts data={publishedCharts} scopeLabel={chartScopeLabel} />
        </div>
      ) : null}

      <p className="listing-market-note">
        {thisListPrice != null && medianList != null && diffPct != null && aboveOrBelow ? (
          <>
            {face === 'land' ? 'This lot is listed at' : 'This home is listed at'} <Price value={thisListPrice} />,{' '}
            <TabularNumber value={Math.abs(diffPct)} fractionDigits={1} />% {aboveOrBelow} the {geoName} median list
            price.{' '}
          </>
        ) : null}
        <TextLink href={hubHref} underline="on-hover">
          See the {geoName} market
        </TextLink>
      </p>
    </section>
  )
}

function KpiCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="listing-market-kpi">
      <div className="listing-market-kpi-lbl">{label}</div>
      <div className="listing-market-kpi-val">{value}</div>
    </div>
  )
}
