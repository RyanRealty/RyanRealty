/**
 * "How homes here perform as an asset" — repeat-sales appreciation for the
 * Heath / Tetherow LP. Server-rendered (no client chart lib): every figure is
 * in the static HTML, which is reliable AND good for SEO.
 *
 * Data: getRepeatSalesAppreciation (verified same-home, sqft-matched,
 * arms-length pairs held 4+ years). Per CLAUDE.md data accuracy — nothing
 * modeled; the methodology is shown so the number is auditable.
 */
import type { RepeatSalesResult, RepeatSale } from '@/lib/data'

function fmtUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace(/\.00$/, '')}M`
  return `$${Math.round(n / 1000).toLocaleString('en-US')}K`
}

function fmtUsdFull(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function HeroCard({ p }: { p: RepeatSale }) {
  const total = Math.round((p.sellPrice / p.buyPrice - 1) * 100)
  return (
    <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A home on {p.address.replace(/^\d+\s/, '')}</div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Bought {p.buyYear}</div>
          <div className="font-display text-xl font-semibold text-foreground">{fmtUsdFull(p.buyPrice)}</div>
        </div>
        <div className="pb-1 text-muted-foreground">{'→'}</div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Sold {p.sellYear}</div>
          <div className="font-display text-xl font-semibold text-primary">{fmtUsdFull(p.sellPrice)}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">{p.years} years held</span>
        <span className="font-semibold text-success">{`+${p.annualizedPct}% / yr · +${total}% total`}</span>
      </div>
    </div>
  )
}

export default function HeathAssetPerformance({
  data,
  currentMedianSale,
}: {
  data: RepeatSalesResult
  currentMedianSale: number | null
}) {
  if (data.count < 3) {
    return (
      <p className="text-sm text-muted-foreground">
        Resale appreciation data is refreshing. Ask us for the long-term performance on a specific Tetherow home.
      </p>
    )
  }

  // Diverse, deterministic picks: longest hold, strongest annualized, most
  // recent — three angles on the same asset story.
  const byYears = [...data.pairs].sort((a, b) => b.years - a.years)
  const byReturn = [...data.pairs].sort((a, b) => b.annualizedPct - a.annualizedPct)
  const byRecent = [...data.pairs].sort((a, b) => b.sellYear - a.sellYear)
  const heroSet: RepeatSale[] = []
  const seen = new Set<string>()
  for (const p of [byYears[0], byReturn[0], byRecent[0]]) {
    if (p && !seen.has(p.address)) { heroSet.push(p); seen.add(p.address) }
  }
  for (const p of byRecent) {
    if (heroSet.length >= 3) break
    if (!seen.has(p.address)) { heroSet.push(p); seen.add(p.address) }
  }

  const bars = byRecent.slice(0, 8)
  const maxPct = Math.max(...bars.map((b) => b.annualizedPct), 1)

  const ribbon = [
    { label: 'Median appreciation', value: `+${data.medianAnnualizedPct?.toFixed(1)}%`, sub: 'per year, per home' },
    { label: 'Resales analyzed', value: `${data.count}`, sub: 'same-home pairs' },
    { label: 'Median hold', value: `${data.medianYearsHeld?.toFixed(0)} yrs`, sub: 'buy to sell' },
    { label: 'Median home today', value: currentMedianSale ? fmtUsdShort(currentMedianSale) : '—', sub: 'trailing 12 months' },
  ]

  return (
    <div className="space-y-8">
      {/* Headline */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {ribbon.map((r) => (
          <div key={r.label} className="rounded-xl border border-primary/10 bg-card p-5 text-center shadow-sm">
            <div className="font-display text-3xl font-semibold tabular-nums text-primary sm:text-4xl">{r.value}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{r.sub}</div>
          </div>
        ))}
      </div>

      {/* Hero stories */}
      <div className="grid gap-4 sm:grid-cols-3">
        {heroSet.map((p) => <HeroCard key={p.address} p={p} />)}
      </div>

      {/* Per-home bar list */}
      <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-primary">Recent resales, annualized return</h3>
          <span className="text-xs text-muted-foreground">{'Same home, bought then sold · verified MLS'}</span>
        </div>
        <div className="space-y-2.5">
          {bars.map((p) => (
            <div key={p.address} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-sm text-foreground sm:w-40">{p.address.replace(/^\d+\s/, '')}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-primary pr-2 text-xs font-semibold text-primary-foreground"
                  style={{ width: `${Math.max(14, (p.annualizedPct / maxPct) * 100)}%` }}
                >
                  {`+${p.annualizedPct}%/yr`}
                </div>
              </div>
              <div className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{p.years}y</div>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology — auditable */}
      <p className="text-xs text-muted-foreground">
        {`Method: ${data.count} Tetherow homes that sold two or more times, matched as the same structure (living area within 15% between sales, so no rebuild inflates the number), held at least four years, arms-length MLS closings. Annualized return is the compound yearly change between the first and most recent sale. Past performance does not guarantee future results.`}
      </p>
    </div>
  )
}
