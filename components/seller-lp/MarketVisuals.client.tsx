'use client'

/**
 * MarketVisuals — the seller-LP "Where Bend stands" centerpiece.
 *
 * An animated navy area chart of the REAL Bend median-sale-price trend plus
 * four count-up stat cards from the live market pulse. Every value is passed
 * in from the server (app/lp/seller-home-value/data.ts) — sourced from
 * market_stats_cache (trend) and market_pulse_live (cards). This component
 * NEVER computes a market number; it only renders verified data (CLAUDE.md §0).
 *
 * Visual register: Design System v2, navy on cream, Amboqia display via
 * font-display, Geist tabular numerals. Chart draws in as it scrolls into
 * view; cards spin up from zero. Both respect prefers-reduced-motion.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Design-system tokens (navy primary / cream card surface). Used as SVG
// presentation values. Recharts passes them straight to stroke/fill, and the
// repo already relies on var() in recharts props (see MarketSnapshotChart).
const NAVY = 'var(--primary)'
const DOT_FILL = 'var(--card)'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type StatCard = {
  /** Final numeric target the card counts up to. */
  countTo: number
  /** How to format the counting number. */
  format: 'money' | 'days' | 'pct' | 'int'
  /** Big label under the number. */
  label: string
  /** One-line context under the label. */
  sub: string
}

export type MarketVisualsProps = {
  points: ReadonlyArray<{ iso: string; median: number }>
  latest: { iso: string; value: number } | null
  yoyPct: number | null
  /** "June 2026" — the pulse refresh month, for the source line. */
  updatedLabel: string
  cards: ReadonlyArray<StatCard>
}

// ─── formatting ────────────────────────────────────────────────────────────

function monthLabel(iso: string): string {
  const parts = iso.split('-')
  const m = Number(parts[1])
  const yy = (parts[0] ?? '').slice(2)
  return `${MONTHS[m - 1] ?? ''} '${yy}`
}

function moneyFull(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

function moneyCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}k`
}

function formatCard(n: number, f: StatCard['format']): string {
  if (f === 'money') return moneyFull(n)
  if (f === 'pct') return `${n.toFixed(1)}%`
  if (f === 'days') return `${Math.round(n)} days`
  return Math.round(n).toLocaleString('en-US')
}

// ─── hooks ───────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener?.('change', cb)
      return () => mq.removeEventListener?.('change', cb)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

/** Fires once when the element first scrolls into view, then stays true. */
function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (el == null) return
    if (typeof IntersectionObserver === 'undefined') {
      // No observer support — reveal on the next frame (async, not synchronous
      // in the effect body) so animations still run.
      const raf = requestAnimationFrame(() => setInView(true))
      return () => cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e !== undefined && e.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, inView }
}

function useCountUp(target: number, run: boolean, durationMs = 1200): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    let startTs = 0
    const step = (ts: number) => {
      if (startTs === 0) startTs = ts
      const p = Math.min((ts - startTs) / durationMs, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, durationMs])
  return val
}

// ─── cards ───────────────────────────────────────────────────────────────

function CountCard({ card, run }: { card: StatCard; run: boolean }) {
  const reduce = usePrefersReducedMotion()
  const animate = run && reduce === false
  const n = useCountUp(card.countTo, animate)
  const display = formatCard(animate ? n : card.countTo, card.format)
  return (
    <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm">
      <div className="font-display text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
        {display}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{card.label}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{card.sub}</div>
    </div>
  )
}

// ─── chart ───────────────────────────────────────────────────────────────

type Datum = { period: string; median: number }

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number }>
  label?: string
}) {
  if (active !== true || payload == null || payload.length === 0) return null
  const v = payload[0]?.value
  if (typeof v !== 'number') return null
  return (
    <div className="rounded-lg border border-primary/15 bg-card px-3 py-2 shadow-md">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="font-display text-base font-semibold tabular-nums text-primary">
        {moneyFull(v)}
      </div>
    </div>
  )
}

function TrendChart({
  points,
  latest,
  run,
}: {
  points: ReadonlyArray<{ iso: string; median: number }>
  latest: { iso: string; value: number } | null
  run: boolean
}) {
  const reduce = usePrefersReducedMotion()
  const data: Datum[] = points.map((p) => ({ period: monthLabel(p.iso), median: p.median }))

  const medians = points.map((p) => p.median)
  const lo = medians.length > 0 ? Math.min(...medians) : 0
  const hi = medians.length > 0 ? Math.max(...medians) : 0
  const pad = Math.max((hi - lo) * 0.25, 25000)
  const yLo = Math.max(0, Math.floor((lo - pad) / 25000) * 25000)
  const yHi = Math.ceil((hi + pad) / 25000) * 25000

  const latestLabel = latest ? monthLabel(latest.iso) : null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 14, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="rrSellerTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.28} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(16,39,66,0.08)" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: 'rgb(16 39 66 / 0.55)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(16,39,66,0.12)' }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          domain={[yLo, yHi]}
          tickFormatter={(v) => moneyCompact(v as number)}
          tick={{ fill: 'rgb(16 39 66 / 0.55)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(16,39,66,0.18)' }} />
        <Area
          type="monotone"
          dataKey="median"
          stroke={NAVY}
          strokeWidth={2.5}
          fill="url(#rrSellerTrendFill)"
          dot={false}
          activeDot={{ r: 5, stroke: NAVY, strokeWidth: 2, fill: DOT_FILL }}
          isAnimationActive={run && reduce === false}
          animationDuration={1300}
          animationEasing="ease-out"
        />
        {latest && latestLabel ? (
          <ReferenceDot
            x={latestLabel}
            y={latest.value}
            r={5}
            fill={NAVY}
            stroke={DOT_FILL}
            strokeWidth={2}
            isFront
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── section ─────────────────────────────────────────────────────────────

export default function MarketVisuals({ points, latest, yoyPct, updatedLabel, cards }: MarketVisualsProps) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>()
  const hasTrend = points.length >= 2 && latest !== null

  const yoyUp = yoyPct != null && yoyPct >= 0
  const yoyText = yoyPct != null ? `${yoyUp ? '↑' : '↓'} ${Math.abs(yoyPct).toFixed(1)}% YoY` : null

  return (
    <div ref={ref}>
      {hasTrend ? (
        <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Median sale price
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                {moneyFull(latest!.value)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bend single-family homes · {monthLabel(latest!.iso)}
              </p>
            </div>
            {yoyText ? (
              <span
                className={
                  yoyUp
                    ? 'inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success'
                    : 'inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive'
                }
              >
                {yoyText}
              </span>
            ) : null}
          </div>

          <div className="mt-4 h-56 sm:h-72">
            {inView ? (
              <TrendChart points={points} latest={latest} run={inView} />
            ) : (
              <div className="h-full w-full animate-pulse rounded-xl bg-primary/5" aria-hidden />
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Source: Oregon Data Share · Bend single-family homes · Updated {updatedLabel}
          </p>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {cards.map((c) => (
            <CountCard key={c.label} card={c} run={inView} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
