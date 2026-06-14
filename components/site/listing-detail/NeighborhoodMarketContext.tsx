import {
  Body,
  Eyebrow,
  H3,
  Price,
  Stack,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { MarketPulse, MarketStats } from '@/lib/data/types/market'

/**
 * NeighborhoodMarketContext — THE Zillow beater per docs/EXECUTION_PLAN.md
 * §8 "What we BEAT" rank 1. No competitor surfaces live, geo-scoped
 * market stats inline on the listing detail page.
 *
 * Spec source:
 *   design_system/ryan-realty/ui_kits/listing-detail/index.html §nbhd-context
 *
 * Renders inside a navy-tinted card showing four stats for THIS
 * listing's subdivision / neighborhood / city: active count, median
 * list price, median DOM, months of supply. Below the grid, a one-line
 * value-transparency callout: "This home is listed at $X · Y% above
 * the median" with a link to the full market hub for that geo.
 *
 * Data comes from the cache tables only (per CLAUDE.md §0):
 *   - getMarketStats(geoType, geoSlug) → median list / median DOM / MoS
 *   - getMarketPulse(geoType, geoSlug) → active count, freshness
 * The page composes both upstream and passes them in.
 *
 * Returns null when no upstream data is available — we never
 * fabricate stats.
 */

type Props = {
  /** Display name for the geo (e.g. "Sunriver Resort", "Awbrey Butte"). */
  geoName: string
  /** Where the "See full market" link points (community / city / neighborhood hub). */
  hubHref: string
  pulse: MarketPulse | null
  stats: MarketStats | null
  /** This listing's list price for the comparison line. */
  thisListPrice: number | null
  /** Freshness timestamp source (defaults to pulse.refreshedAt). */
  refreshedAt?: string
  className?: string
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
  pulse,
  stats,
  thisListPrice,
  refreshedAt,
  className,
}: Props) {
  if (!pulse && !stats) return null

  const activeCount = pulse?.activeCount ?? null
  const medianList = pulse?.medianListPrice ?? stats?.medianListPrice ?? null
  // Median DOM + MoS come from market_pulse_live now (added to the
  // MarketPulse type 2026-05-28 alongside the schema fix). `stats` is
  // still a fallback for legacy callers but the listing-detail page
  // sources both from `pulse`.
  const medianDom = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null
  const mos = pulse?.monthsOfSupply ?? stats?.monthsOfSupply ?? null
  const freshness = refreshedAt ?? pulse?.refreshedAt ?? stats?.refreshedAt ?? null
  const freshnessLabel = formatFreshness(freshness)
  const diffPct = diffPctVsMedian(thisListPrice, medianList)
  const aboveOrBelow = diffPct == null ? null : diffPct >= 0 ? 'above' : 'below'

  return (
    <div
      className={cn(
        'rounded-[14px] border border-primary/15 bg-primary/4 p-6',
        className,
      )}
    >
      <Stack gap="tight">
        <Eyebrow>Live market context</Eyebrow>
        <H3>{geoName} market right now</H3>
        {freshnessLabel ? (
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Updated {freshnessLabel} · Oregon Data Share
          </div>
        ) : null}
      </Stack>

      <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
        <Stat label={`Active in ${geoName}`} value={<TabularNumber value={activeCount} />} />
        <Stat label="Median list" value={<Price value={medianList} compact />} />
        <Stat
          label="Median DOM"
          value={
            medianDom != null ? (
              <>
                <TabularNumber value={medianDom} /> days
              </>
            ) : (
              '—'
            )
          }
        />
        <Stat
          label="Months of supply"
          value={
            mos != null ? <TabularNumber value={mos} fractionDigits={1} /> : '—'
          }
        />
      </div>

      {thisListPrice != null && medianList != null && diffPct != null && aboveOrBelow ? (
        <Body size="small" tone="muted" className="mt-4">
          This home is listed at{' '}
          <b className="text-foreground">
            <Price value={thisListPrice} />
          </b>{' '}
          ·{' '}
          <span className="text-foreground">
            <TabularNumber value={Math.abs(diffPct)} fractionDigits={1} />% {aboveOrBelow}
          </span>{' '}
          the {geoName} median list.{' '}
          <TextLink href={hubHref} underline="on-hover" className="text-sm">
            See full {geoName} market →
          </TextLink>
        </Body>
      ) : (
        <Body size="small" tone="muted" className="mt-4">
          <TextLink href={hubHref} underline="on-hover" className="text-sm">
            See full {geoName} market →
          </TextLink>
        </Body>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[24px] font-bold tracking-[-0.01em] tabular-nums">
        {value}
      </div>
    </div>
  )
}
