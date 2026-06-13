'use client'

/**
 * Investment-grade performance charts for the Heath at Tetherow LP.
 *
 * EVERY number here traces to verified MLS data the server already fetched
 * (CLAUDE.md §0): `sales` are the real recent Heath closings, `stats` is the
 * market_stats_cache rolling snapshot. No figure is invented or modeled — we
 * chart what actually traded. Golf dues / property taxes are intentionally NOT
 * shown here (no verified source wired yet).
 */
import { useEffect, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type HeathSale = {
  closeDate: string | null
  closePrice: number | null
  listPrice: number | null
  sqft: number | null
  streetName: string | null
}

export type HeathStats = {
  medianSalePrice: number | null
  medianPpsf: number | null
  medianDom: number | null
  saleToListPct: number | null // e.g. 98.4
  soldCount: number | null
  activeCount: number | null
}

const NAVY = '#102742'
const ACCENT = '#3f6286'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card p-5 text-center shadow-sm">
      <div className="font-display text-3xl font-semibold tabular-nums text-primary sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${Math.round(n / 1000).toLocaleString('en-US')}K`
}

function shortLabel(s: HeathSale, i: number): string {
  if (s.closeDate) {
    const d = new Date(s.closeDate)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return s.streetName?.split(' ')[0] ?? `Sale ${i + 1}`
}

export default function HeathPerformanceCharts({ sales, stats }: { sales: HeathSale[]; stats: HeathStats }) {
  // recharts ResponsiveContainer measures 0×0 during SSR / first hydration in
  // the App Router and never repaints — gate it behind mount so it measures a
  // real DOM box on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Oldest → newest so the chart reads left-to-right in time.
  const ordered = [...sales]
    .filter((s) => (s.closePrice ?? 0) > 0)
    .sort((a, b) => new Date(a.closeDate ?? 0).getTime() - new Date(b.closeDate ?? 0).getTime())

  const data = ordered.map((s, i) => ({
    label: shortLabel(s, i),
    price: s.closePrice ?? 0,
    ppsf: s.sqft && s.closePrice ? Math.round((s.closePrice as number) / (s.sqft as number)) : null,
  }))

  const saleToList = stats.saleToListPct
  const ribbon = [
    { label: 'Median sale', value: fmtUsd(stats.medianSalePrice), sub: 'trailing 12 months' },
    { label: 'Median $/sqft', value: stats.medianPpsf ? `$${Math.round(stats.medianPpsf).toLocaleString('en-US')}` : '—' },
    { label: 'Days on market', value: stats.medianDom != null ? `${Math.round(stats.medianDom)}` : '—', sub: 'median' },
    { label: 'Sale to list', value: saleToList != null ? `${saleToList.toFixed(1)}%` : '—' },
  ]

  return (
    <div className="space-y-8">
      {/* Verified stat ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {ribbon.map((r) => <Stat key={r.label} label={r.label} value={r.value} sub={r.sub} />)}
      </div>

      {/* Recent sales — every bar is a real closing */}
      {data.length >= 2 ? (
        <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-primary">Recent Tetherow sales</h3>
            <span className="text-xs text-muted-foreground">Each bar is a verified MLS closing · last 12 months</span>
          </div>
          <div className="h-72 w-full">
            {mounted ? (
            <ResponsiveContainer width="100%" height={288}>
              <ComposedChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="heathPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#10274214" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#10274220' }} />
                <YAxis
                  yAxisId="price"
                  tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <YAxis yAxisId="ppsf" orientation="right" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: ACCENT }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'price' ? [`$${value.toLocaleString('en-US')}`, 'Sale price'] : [`$${value}/sqft`, 'Price per sqft']
                  }
                  contentStyle={{ borderRadius: 12, border: '1px solid #10274220', fontSize: 13 }}
                />
                <Area yAxisId="price" type="monotone" dataKey="price" fill="url(#heathPrice)" stroke="none" />
                <Bar yAxisId="price" dataKey="price" fill={NAVY} radius={[4, 4, 0, 0]} barSize={26} />
                <Line yAxisId="ppsf" type="monotone" dataKey="ppsf" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-xl bg-muted/40" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NAVY }} /> Sale price</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} /> Price per sqft</span>
          </div>
        </div>
      ) : null}

      {/* Liquidity */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Stat label="Active now" value={stats.activeCount != null ? `${stats.activeCount}` : '—'} sub="active in Heath now" />
        <Stat label="Sold (12 mo)" value={stats.soldCount != null ? `${stats.soldCount}` : '—'} sub="Tetherow closings" />
      </div>
    </div>
  )
}
