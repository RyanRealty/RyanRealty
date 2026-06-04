import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Price } from '@/components/site/primitives'
import type { MoSVerdict } from '@/lib/data/types/market'

/**
 * megaShared — small building blocks every bento panel reuses.
 *
 * Pure presentational, server-safe (no client hooks). Color comes only from
 * navy/cream tokens (bg-primary, bg-card, text-foreground, text-muted-foreground,
 * border-border, bg-muted). Trends use a navy arrow glyph with opacity, never a
 * green/red color, per the header build rules.
 */

// ─── Tile shell ──────────────────────────────────────────────────────────

/**
 * Tile — the bento cell. A bg-muted card with a hairline border and the locked
 * card radius. `span` lets a tile claim extra grid columns for the bento rhythm.
 */
export function Tile({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-muted p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── Stat tile ───────────────────────────────────────────────────────────

/**
 * Stat — a big tabular-nums value with a small label below. Renders nothing
 * when the value is null so a null stat never shows a 0 or a placeholder.
 */
export function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode | null
  className?: string
}) {
  if (value == null) return null
  return (
    <div className={className}>
      <p className="font-display text-2xl leading-none tracking-[-0.01em] tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── Section heading inside a panel ────────────────────────────────────────

export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-sm font-semibold tracking-[-0.01em] text-primary">
      {children}
    </p>
  )
}

// ─── Link row inside a column ──────────────────────────────────────────────

export function PanelLink({
  href,
  children,
  strong,
}: {
  href: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block truncate rounded-md px-2 py-1 text-sm text-foreground/80 transition hover:bg-card hover:text-foreground',
        strong && 'font-semibold text-primary',
      )}
    >
      {children}
    </Link>
  )
}

// ─── Verdict pill ──────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<MoSVerdict, string> = {
  sellers: "Seller's market",
  balanced: 'Balanced market',
  buyers: "Buyer's market",
}

/**
 * VerdictPill — a navy pill carrying the canonical market verdict label.
 * Renders nothing for a null verdict (so it never disagrees with a missing
 * months-of-supply number).
 */
export function VerdictPill({ verdict }: { verdict: MoSVerdict | null }) {
  if (verdict == null) return null
  return (
    <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[13px] font-semibold text-primary-foreground">
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

// ─── Trend glyph (navy arrow + opacity, never color) ────────────────────────

/**
 * TrendStat — a stat with a navy up/down arrow glyph keyed off the sign of a
 * year-over-year percent. The arrow is currentColor (navy via text-primary)
 * at reduced opacity, never a green/red color. Renders nothing when pct is null.
 */
export function YoyTrend({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null
  const abs = Math.abs(pct)
  const arrow = abs < 0.05 ? '·' : pct > 0 ? '↑' : '↓'
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium tabular-nums text-primary">
      <span aria-hidden className="opacity-60">
        {arrow}
      </span>
      <span>{abs.toFixed(1)}% year over year</span>
    </span>
  )
}

// ─── Inline sparkline (no chart library) ────────────────────────────────────

/**
 * Sparkline — a tiny inline SVG polyline of up to 12 points. Stroke is
 * currentColor (navy via a text-primary wrapper), so it inherits the navy token
 * and carries no chart-library weight. Renders nothing with fewer than 2 points.
 */
export function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const points = values.filter((v) => Number.isFinite(v))
  if (points.length < 2) return null

  // Normalize into a 100x32 viewBox, oldest left to newest right.
  const w = 100
  const h = 32
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const coords = points
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="12 month median sale price trend"
      className={cn('h-8 w-full text-primary', className)}
    >
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="opacity-80"
      />
    </svg>
  )
}

// ─── Median price stat shortcut ─────────────────────────────────────────────

/** A median list price stat. Renders nothing when the price is null. */
export function MedianPriceStat({
  value,
  label = 'Median list price',
}: {
  value: number | null
  label?: string
}) {
  if (value == null) return null
  return <Stat label={label} value={<Price value={value} />} />
}
