import { getRegionPulse } from '@/lib/data/market/getRegionPulse'
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
  if (mos <= 4) return { kind: 'hot', text: 'Seller’s market' }
  if (mos >= 6) return { kind: 'buyer', text: 'Buyer’s market' }
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

export default async function MarketSnapshot() {
  const pulse = await getRegionPulse()
  const verdict = marketVerdict(pulse?.monthsOfSupply ?? null)

  return (
    <Section padding="default" divider>
      <Container>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <Stack gap="tight">
            <Eyebrow>Market snapshot</Eyebrow>
            <H2>Central Oregon housing market</H2>
            <Body size="small" tone="muted">
              Refreshed every 15 minutes from Oregon Data Share. SFR + condos +
              townhomes across the 11 Central Oregon communities we serve.
              {pulse?.updatedAt ? ` Updated ${fmtFreshness(pulse.updatedAt)}.` : ''}
            </Body>
          </Stack>
          <TextLink
            href="/housing-market"
            underline="on-hover"
            className="whitespace-nowrap text-sm"
          >
            Open the housing market hub →
          </TextLink>
        </div>

        <Grid cols={4} gap="default">
          <StatCard
            label="Active residential listings"
            value={<TabularNumber value={pulse?.activeCount ?? null} />}
            sub="Homes, condos, townhomes"
          />
          <StatCard
            label="Median list price"
            value={<Price value={pulse?.medianListPrice ?? null} />}
            sub="Central Oregon residential"
          />
          <StatCard
            label="Typical days to pending"
            value={<DaysCount value={pulse?.medianDaysToPending ?? null} fallback="—" />}
            sub="From list to under contract"
          />
          <StatCard
            label="Months of supply"
            value={
              <TabularNumber
                value={pulse?.monthsOfSupply ?? null}
                fractionDigits={1}
              />
            }
            sub={
              <>
                <TabularNumber value={pulse?.pendingCount ?? null} /> pending ·{' '}
                <TabularNumber value={pulse?.soldCount30d ?? null} /> closed last 30d
              </>
            }
            badge={verdict}
          />
        </Grid>
      </Container>
    </Section>
  )
}
