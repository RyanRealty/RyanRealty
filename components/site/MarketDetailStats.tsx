/**
 * MarketDetailStats — fuller market stats section for the per-city market report.
 *
 * Surfaces the rich market_stats_cache data that the basic MarketSnapshot
 * (market_pulse_live) does not carry. Displays 9 high-value metrics drawn
 * directly from the MarketDetail type.
 *
 * §0 trace — every on-screen number traces to getCityMarketDetail
 * (lib/data/market/getCityMarketDetail.ts), which reads confirmed-existing
 * columns from market_stats_cache. No invented or hand-formatted numbers.
 *
 * Formatting contract (CLAUDE.md brand voice):
 *   Currency (median sale, median concessions, total volume):
 *     Price primitive — rounds to nearest $1,000, tabular-nums.
 *   Price per sqft:
 *     TabularNumber fractionDigits={0} — rounded to nearest $1, prefixed with "$",
 *     suffixed with "/sqft". $/sqft column does NOT use the Price primitive
 *     (Price rounds to thousands which is wrong for per-sqft values).
 *   Sale-to-list ratio:
 *     Stored as decimal (e.g. 0.9736). Rendered as "97.4%" by multiplying
 *     by 100 and using TabularNumber fractionDigits={1} + "%" suffix.
 *   YoY percent changes:
 *     PercentChange primitive — signed arrow (↑/↓), 1 decimal, "YoY" suffix.
 *     DOM YoY uses direction="invert" (lower DOM is better).
 *   Counts (sold, inventory):
 *     TabularNumber fractionDigits={0}.
 *   Cash-purchase share:
 *     TabularNumber fractionDigits={1} + "%" suffix.
 *
 * Render rules:
 *   - Renders nothing when `detail` prop is null (no data for this geo/period).
 *   - Intended for geoType === 'city' only (caller gates this in the page).
 *   - Uses Section + Container + Grid from primitives; stat-card pattern mirrors
 *     MarketSnapshot for visual consistency.
 */

import type { MarketDetail } from '@/lib/data/types/market'
import {
  Container,
  Eyebrow,
  Grid,
  H2,
  PercentChange,
  Price,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

// ─── Stat card ────────────────────────────────────────────────────────────────

type StatCardProps = {
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  yoy?: React.ReactNode
}

function StatCard({ label, value, sub, yoy }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition">
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <div className="tabular-nums text-[28px] font-bold tracking-[-0.01em] text-foreground mt-2 leading-tight">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      {yoy != null ? (
        <div className="mt-2.5 text-[12px] tabular-nums">{yoy}</div>
      ) : null}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format avg_sale_to_list_ratio (decimal, e.g. 0.9736) as "97.4%" */
function formatSaleToList(ratio: number | null): React.ReactNode {
  if (ratio == null || !Number.isFinite(ratio)) {
    return <span className="tabular-nums">—</span>
  }
  return (
    <span className="tabular-nums">
      <TabularNumber value={ratio * 100} fractionDigits={1} />%
    </span>
  )
}

/** Format a $/sqft value (integer) with leading $ and /sqft suffix. */
function formatPpsf(value: number | null): React.ReactNode {
  if (value == null || !Number.isFinite(value)) {
    return <span className="tabular-nums">—</span>
  }
  return (
    <span className="tabular-nums">
      $<TabularNumber value={Math.round(value)} fractionDigits={0} />/sqft
    </span>
  )
}

/** Format a plain percentage (e.g. cash_purchase_pct stored as 29.17). */
function formatPct(value: number | null, fractionDigits = 1): React.ReactNode {
  if (value == null || !Number.isFinite(value)) {
    return <span className="tabular-nums">—</span>
  }
  return (
    <span className="tabular-nums">
      <TabularNumber value={value} fractionDigits={fractionDigits} />%
    </span>
  )
}

/** Format a period label from ISO period_end. */
function fmtPeriodLabel(periodEnd: string | null, periodType: string | null): string {
  if (!periodEnd) return ''
  try {
    const d = new Date(periodEnd)
    const month = d.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    if (periodType === 'monthly') return month
    if (periodType === 'rolling_30d') return `30-day period ending ${month}`
    if (periodType === 'rolling_90d') return `90-day period ending ${month}`
    if (periodType === 'rolling_365d') return `365-day period ending ${month}`
    return month
  } catch {
    return ''
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  /** MarketDetail from getCityMarketDetail. Renders nothing when null. */
  detail: MarketDetail | null
  /** Display name of the geo, e.g. "Bend" or "Redmond". */
  geoName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketDetailStats({ detail, geoName }: Props) {
  if (!detail) return null

  const periodLabel = fmtPeriodLabel(detail.periodEnd, detail.periodType)

  return (
    <Section padding="default" divider tone="muted">
      <Container>
        <Stack gap="loose">
          <Stack gap="tight">
            <Eyebrow>Closed sales data</Eyebrow>
            <H2>{geoName} market detail</H2>
            <p className="text-[15px] text-muted-foreground">
              Closed single-family home transactions
              {periodLabel ? `, ${periodLabel}` : ''}.
              Source: closed MLS sales via Oregon Data Share{detail.methodologyVersion ? `, methodology ${detail.methodologyVersion}` : ''}.
            </p>
          </Stack>

          {/* Row 1 — price metrics: 4 cards */}
          <Grid cols={4} gap="default">
            <StatCard
              label="Median sale price"
              value={<Price value={detail.medianSalePrice} />}
              sub="Closed SFR transactions"
              yoy={
                detail.yoyMedianPriceDeltaPct != null ? (
                  <PercentChange
                    value={detail.yoyMedianPriceDeltaPct}
                    suffix="YoY"
                    direction="normal"
                  />
                ) : null
              }
            />
            <StatCard
              label="Median price per sqft"
              value={formatPpsf(detail.medianPricePerSqft)}
              sub="Closed SFR transactions"
              yoy={
                detail.yoyPpsfChangePct != null ? (
                  <PercentChange
                    value={detail.yoyPpsfChangePct}
                    suffix="YoY"
                    direction="normal"
                  />
                ) : null
              }
            />
            <StatCard
              label="Avg sale-to-list ratio"
              value={formatSaleToList(detail.avgSaleToListRatio)}
              sub="Closed price vs list price"
            />
            <StatCard
              label="Median days on market"
              value={
                detail.medianDom != null ? (
                  <span className="tabular-nums">
                    <TabularNumber value={detail.medianDom} fractionDigits={0} />
                    <span className="text-[18px] font-normal text-muted-foreground ml-1">days</span>
                  </span>
                ) : (
                  <span className="tabular-nums">—</span>
                )
              }
              sub="List to close"
              yoy={
                detail.yoyDomChange != null ? (
                  <PercentChange
                    value={detail.yoyDomChange}
                    suffix="days YoY"
                    direction="invert"
                  />
                ) : null
              }
            />
          </Grid>

          {/* Row 2 — volume, inventory, activity: 5 cards (wraps to 2 rows on mobile) */}
          <Grid cols={4} gap="default">
            <StatCard
              label="Homes sold this period"
              value={<TabularNumber value={detail.soldCount} fractionDigits={0} />}
              sub="Closed transactions"
            />
            <StatCard
              label="Total sales volume"
              value={<Price value={detail.totalVolume} compact />}
              sub="Sum of closed prices"
            />
            <StatCard
              label="Active inventory"
              value={
                <TabularNumber value={detail.endOfPeriodInventory} fractionDigits={0} />
              }
              sub="End of period"
            />
            <StatCard
              label="Cash purchase share"
              value={formatPct(detail.cashPurchasePct)}
              sub="Of closed transactions"
            />
          </Grid>

          {/* Row 3 — market health + concessions: 2 cards */}
          <Grid cols={4} gap="default">
            {detail.marketHealthLabel != null ? (
              <StatCard
                label="Market health"
                value={
                  <span className="text-[22px] font-bold text-foreground">
                    {detail.marketHealthLabel}
                  </span>
                }
                sub={
                  detail.marketHealthScore != null ? (
                    <>Score: <TabularNumber value={detail.marketHealthScore} fractionDigits={1} /></>
                  ) : (
                    'Overall market condition'
                  )
                }
              />
            ) : null}
            {detail.medianConcessionsAmount != null ? (
              <StatCard
                label="Median seller concessions"
                value={<Price value={detail.medianConcessionsAmount} />}
                sub="When concessions occurred"
              />
            ) : null}
          </Grid>
        </Stack>
      </Container>
    </Section>
  )
}
