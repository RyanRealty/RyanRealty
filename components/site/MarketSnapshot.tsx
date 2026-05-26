import Link from 'next/link'
import { getRegionPulse } from '@/lib/data/market/getRegionPulse'

/**
 * Site v2 market snapshot — 4 stat cards on the homepage.
 *
 * Data path (per EXECUTION_PLAN.md Wave 1 / CLAUDE.md §0 data accuracy):
 *   single SELECT against market_pulse_live where geo_type='region' AND
 *   geo_slug='central-oregon' AND property_type='A'. Indexed lookup.
 *   refresh_market_pulse() repopulates this row every 10–15 min, so the
 *   numbers shown trace to the same pre-aggregated source the cron writes.
 *
 * No raw `listings` aggregation. No per-city fan-out. One round-trip.
 *
 * Unavailable values render as em-dash per brand voice. Currency rounded
 * to the nearest $1k. Tabular numerals throughout.
 */

type StatCardProps = {
  label: string
  value: string
  sub: string
  badge?: { kind: 'up' | 'down' | 'hot' | 'balanced' | 'buyer'; text: string }
}

const BADGE_CLASS: Record<NonNullable<StatCardProps['badge']>['kind'], string> = {
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

function fmtMoneyRound1k(n: number | null): string {
  if (n == null) return '—'
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

function fmtInt(n: number | null): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString()
}

/**
 * Months of supply classifies the market per the locked CLAUDE.md threshold:
 *   ≤ 4 → seller's market · 4–6 → balanced · ≥ 6 → buyer's market.
 * Verdict copy matches the threshold, not the snapshot's `market_health_label`
 * field — that label is computed elsewhere and can be opinionated.
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

  return (
    <section className="py-14 border-t border-border first:border-t-0">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="rr-eyebrow">Market snapshot</div>
            <h2 className="mt-1.5 text-[clamp(1.5rem,2vw+0.5rem,1.875rem)] font-bold tracking-[-0.01em] text-foreground">
              Central Oregon housing market
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Refreshed every 15 minutes from Oregon Data Share. SFR + condos +
              townhomes across the 11 Central Oregon communities we serve.
              {pulse?.updatedAt ? ` Updated ${fmtFreshness(pulse.updatedAt)}.` : ''}
            </p>
          </div>
          <Link
            href="/housing-market"
            className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Open the housing market hub →
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active residential listings"
            value={fmtInt(pulse?.activeCount ?? null)}
            sub="Homes, condos, townhomes"
          />
          <StatCard
            label="Median list price"
            value={fmtMoneyRound1k(pulse?.medianListPrice ?? null)}
            sub="Central Oregon residential"
          />
          <StatCard
            label="Typical days to pending"
            value={fmtInt(pulse?.medianDaysToPending ?? null)}
            sub="From list to under contract"
          />
          <StatCard
            label="Months of supply"
            value={
              pulse?.monthsOfSupply != null
                ? pulse.monthsOfSupply.toFixed(1)
                : '—'
            }
            sub={`${fmtInt(pulse?.pendingCount ?? null)} pending · ${fmtInt(pulse?.soldCount30d ?? null)} closed last 30d`}
            badge={marketVerdict(pulse?.monthsOfSupply ?? null)}
          />
        </div>
      </div>
    </section>
  )
}
