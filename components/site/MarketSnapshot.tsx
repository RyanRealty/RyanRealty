import { getRegionPulse } from '@/lib/data/market/getRegionPulse'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import {
  Body,
  Container,
  DaysCount,
  Eyebrow,
  Grid,
  H2,
  Price,
  Section,
  Stack,
  TabularNumber,
  TextLink,
} from '@/components/site/primitives'

/**
 * Site v2 market snapshot — 4 stat cards on the homepage.
 *
 * Data path (per EXECUTION_PLAN.md Wave 1 / CLAUDE.md §0 data accuracy):
 *   single SELECT against market_pulse_live where geo_type='region' AND
 *   geo_slug='central-oregon' AND property_type='A'. Indexed lookup.
 *   refresh_market_pulse() repopulates this row every 10 to 15 min, so the
 *   numbers shown trace to the same pre-aggregated source the cron writes.
 *
 * No raw `listings` aggregation. No per-city fan-out. One round-trip.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27:
 *   - Container/Section own the outer chrome
 *   - Eyebrow + H2 + Body cover the heading region
 *   - Grid handles the 4-up responsive stat layout (lg:4 / sm:2 / xs:1)
 *   - Price, TabularNumber, DaysCount own the numeric formatting; the
 *     three exempt cases (em-dash placeholder, $1k rounding, days-suffix)
 *     are now enforced by the primitives instead of by ad-hoc fmt helpers.
 *
 * Soft pastel direction-badge palette stays inline pending a future
 * BadgePill "soft" tone extension. Tracked as Wave 2 Layer 3 follow-up.
 */

type DirectionBadgeKind = 'up' | 'down' | 'hot' | 'balanced' | 'buyer'

type StatCardProps = {
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  badge?: { kind: DirectionBadgeKind; text: string }
}

const BADGE_CLASS: Record<DirectionBadgeKind, string> = {
  up: 'bg-success/10 text-[oklch(0.35_0.15_149)] border-success/25',
  down: 'bg-destructive/10 text-destructive border-destructive/20',
  hot: 'bg-destructive/10 text-destructive border-destructive/25',
  balanced: 'bg-muted text-foreground border-border',
  buyer: 'bg-warning/15 text-foreground border-warning/30',
}

function StatCard({ label, value, sub, badge }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition">
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <div className="tabular-nums text-[32px] font-bold tracking-[-0.01em] text-foreground mt-2">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      {badge ? (
        <span className={`inline-block mt-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_CLASS[badge.kind]}`}>
          {badge.text}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Months of supply classifies the market per the locked CLAUDE.md threshold:
 *   value of 4 or less is a seller's market, 4 to 6 is balanced, 6 or more is a
 *   buyer's market. Verdict copy matches the threshold, not the snapshot's
 *   `market_health_label` field, which is computed elsewhere and can be opinionated.
 */
function marketVerdict(mos: number | null): { kind: 'hot' | 'balanced' | 'buyer'; text: string } | undefined {
  if (mos == null) return undefined
  if (mos <= 4) return { kind: 'hot', text: "Seller's market" }
  if (mos >= 6) return { kind: 'buyer', text: "Buyer's market" }
  return { kind: 'balanced', text: 'Balanced' }
}

function fmtFreshness(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short',
    })
  } catch {
    return ''
  }
}

type Props = {
  /**
   * When provided, the snapshot fetches city-scoped data from
   * market_pulse_live instead of the region aggregate. Pass the
   * city's slug (e.g. "bend", "redmond"). Omit for the homepage
   * region-level snapshot.
   */
  citySlug?: string
  cityName?: string
}

export default async function MarketSnapshot({ citySlug, cityName }: Props = {}) {
  // City-scoped path — getMarketPulse reads market_pulse_live for the city row.
  // Region path — getRegionPulse reads the pre-aggregated central-oregon row.
  let activeCount: number | null = null
  let medianListPrice: number | null = null
  let medianDaysToPending: number | null = null
  let monthsOfSupply: number | null = null
  let closedLast30Days: number | null = null
  let updatedAt = ''

  if (citySlug) {
    const pulse = await getMarketPulse({ geoType: 'city', geoSlug: citySlug })
    if (pulse) {
      activeCount = pulse.activeCount
      medianListPrice = pulse.medianListPrice
      medianDaysToPending = pulse.medianDaysToPending
      monthsOfSupply = pulse.monthsOfSupply
      closedLast30Days = pulse.closedLast30Days
      updatedAt = pulse.refreshedAt
    }
  } else {
    const regionPulse = await getRegionPulse()
    if (regionPulse) {
      activeCount = regionPulse.activeCount
      medianListPrice = regionPulse.medianListPrice
      medianDaysToPending = regionPulse.medianDaysToPending
      monthsOfSupply = regionPulse.monthsOfSupply
      closedLast30Days = regionPulse.soldCount30d
      updatedAt = regionPulse.updatedAt
    }
  }

  const verdict = marketVerdict(monthsOfSupply)
  const geoLabel = cityName ?? 'Central Oregon'
  const marketHubHref = citySlug ? `/housing-market/${citySlug}` : '/housing-market'

  return (
    <Section padding="default" divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>Market snapshot</Eyebrow>
            <H2>{geoLabel} housing market</H2>
            <Body size="small" tone="muted">
              Refreshed every 15 minutes from Oregon Data Share. Single-family homes only.
              {updatedAt ? ` Updated ${fmtFreshness(updatedAt)}.` : ''}
            </Body>
          </Stack>
          <TextLink
            href={marketHubHref}
            underline="on-hover"
            className="whitespace-nowrap text-sm"
          >
            {cityName ? `Open ${cityName} market report →` : 'Open the housing market hub →'}
          </TextLink>
        </div>

        <Grid cols={4} gap="default">
          <StatCard
            label="Active single-family homes"
            value={<TabularNumber value={activeCount} />}
            sub="For sale now"
          />
          <StatCard
            label="Median list price"
            value={<Price value={medianListPrice} />}
            sub={`${geoLabel} single-family`}
          />
          <StatCard
            label="Typical days to pending"
            value={<DaysCount value={medianDaysToPending} fallback="—" />}
            sub="From list to under contract"
          />
          <StatCard
            label="Months of supply"
            value={
              <TabularNumber
                value={monthsOfSupply}
                fractionDigits={1}
              />
            }
            sub={
              <>
                <TabularNumber value={closedLast30Days} /> closed last 30 days
              </>
            }
            badge={verdict}
          />
        </Grid>
      </Container>
    </Section>
  )
}
