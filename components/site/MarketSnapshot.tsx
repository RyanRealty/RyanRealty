import Link from 'next/link'
import { getMarketSnapshot } from '@/app/actions/home'

/**
 * Site v2 market snapshot — 4 stat cards (active, median sale price YTD,
 * typical days to sell, closed sales YTD) with eyebrow + heading + head-action.
 * Mirrors design_system/ryan-realty/ui_kits/website/index.html §market-snapshot.
 *
 * Data accuracy: every figure traces to market_pulse_live via getMarketSnapshot().
 * Unavailable values render as em-dash per brand voice.
 */

type StatCardProps = {
  label: string
  value: string
  sub: string
  delta?: { direction: 'up' | 'down'; text: string }
}

function StatCard({ label, value, sub, delta }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition">
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <div className="tabular-nums text-[32px] font-bold tracking-[-0.01em] text-foreground mt-2">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      {delta ? (
        <span
          className={`inline-block mt-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            delta.direction === 'up'
              ? 'bg-success/10 text-[oklch(0.35_0.15_149)] border-success/25'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          {delta.direction === 'up' ? '↑' : '↓'} {delta.text}
        </span>
      ) : null}
    </div>
  )
}

function fmtMoneyRound1k(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

function fmtInt(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toLocaleString()
}

export default async function MarketSnapshot() {
  const snapshot = await getMarketSnapshot().catch(() => null)

  const activeCount = snapshot?.count ?? null
  const medianPrice = snapshot?.medianPrice ?? null
  const avgDom = snapshot?.avgDom ?? null
  const closedYtd = snapshot?.closedYtdResidential ?? null
  const pendingCount = snapshot?.pendingCount ?? null

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
              Updated daily from Oregon Data Share. Residential listings only.
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
            value={fmtInt(activeCount)}
            sub="Homes, condos, townhomes"
          />
          <StatCard
            label="Median sale price · YTD"
            value={fmtMoneyRound1k(medianPrice)}
            sub="Central Oregon residential"
          />
          <StatCard
            label="Typical days to sell"
            value={fmtInt(avgDom)}
            sub="Median days on market"
          />
          <StatCard
            label="Under contract"
            value={fmtInt(pendingCount)}
            sub={`${fmtInt(closedYtd)} closed YTD region-wide`}
          />
        </div>
      </div>
    </section>
  )
}
