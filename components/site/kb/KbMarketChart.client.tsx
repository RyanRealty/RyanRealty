'use client'

import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * KbMarketChart — the interactive multi-year median-price chart that powers the KB
 * "market" section (city / community) and the housing-market hub. A reusable,
 * accessible, production-ready component:
 *
 *   • Toggleable year lines — each year is a legend chip the user can switch on/off
 *     (real <button>s, aria-pressed, keyboard-operable; at least one stays on).
 *   • Correct axis — months Jan–Dec on a shared x-axis so seasonality + YoY shifts
 *     align; each year's line ends at its LAST real month with a labeled endpoint
 *     (the current year stops at "now" instead of being stretched to December).
 *   • Polished lines — monotone-smoothed paths, a gradient area under the most
 *     recent visible year, endpoint dots, non-scaling strokes (no distortion when
 *     the responsive SVG stretches).
 *   • Hover + keyboard readout — a crosshair + tooltip showing every visible year's
 *     value at the pointed month; arrow keys move the cursor, Home/End jump.
 *   • Draw-in animation (GSAP), reduced-motion safe.
 *   • States — renders a labeled "not enough data" panel when there is <2 points,
 *     and a skeleton when `loading`.
 *   • Accessible — a <figure> with an aria-label + a visually-hidden data <table>
 *     so screen readers get the numbers, not just the picture.
 *
 * Pure presentation: every value is passed in already-verified (§0). No fetching.
 */

export interface KbMarketYearPoint {
  /** Calendar month, 1–12. */
  m: number
  value: number
}
export interface KbMarketYearSeries {
  year: number
  points: KbMarketYearPoint[]
}

export interface KbMarketChartProps {
  /** Up to ~6 calendar-year series, oldest first. The last is treated as "current". */
  years: KbMarketYearSeries[]
  /** Accessible name for the chart figure. */
  ariaLabel?: string
  /** Value formatter (default: nearest-thousand "$740K" / "$1.2M"). */
  formatValue?: (n: number) => string
  /** Chart plot height in CSS px (responsive width). Default 300. */
  height?: number
  /** Render a skeleton instead of the chart. */
  loading?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_INITIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
// Oldest → newest. The newest visible year always renders in cream (brightest).
const PALETTE = ['#8fa6cc', '#cf9088', '#7faf9c', '#d6bd79', '#b8a3d6', '#faf8f4']

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${Math.round(n / 1000).toLocaleString('en-US')}K`
}

/**
 * Straight-segment path (polyline). Honest time-series rendering — the standard for
 * market/price charts (Zillow, Redfin, every stock chart): smoothing would imply
 * median values between months that don't exist and visually overshoot the data. The
 * "visual help" comes from a prominent current-year line, the gradient fill, the
 * endpoint marker, and a calm 2-line default — not from bending the line.
 */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
}

export function KbMarketChart({
  years,
  ariaLabel = 'Median sale price by year',
  formatValue = defaultFormat,
  height = 300,
  loading = false,
}: KbMarketChartProps) {
  const uid = useId().replace(/:/g, '')
  const root = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  // Toggle state — keyed by year number. Default shows the 3 most recent years so
  // the overlay reads cleanly; older years start off and are one tap away.
  const [hidden, setHidden] = useState<Set<number>>(() => {
    // default: current year + the prior year (a clean "this year vs last" read);
    // older years are one tap away.
    const recent = new Set(years.slice(-2).map((s) => s.year))
    return new Set(years.filter((s) => !recent.has(s.year)).map((s) => s.year))
  })
  // Active month (1–12) under the cursor, or null when not hovering.
  const [active, setActive] = useState<number | null>(null)

  const W = 1000
  const H = 1000 * (height / 1000) // keep viewBox proportional to requested height
  const padY = 18

  // Visible series (never let the user hide the last one).
  const visible = useMemo(
    () => years.filter((s) => !hidden.has(s.year)),
    [years, hidden],
  )

  const geo = useMemo(() => {
    const src = visible.length ? visible : years
    let min = Infinity
    let max = -Infinity
    for (const s of src) for (const p of s.points) {
      if (p.value < min) min = p.value
      if (p.value > max) max = p.value
    }
    if (!Number.isFinite(min)) return null
    // pad the value range 6% so lines don't kiss the top/bottom edge
    const range = max - min || 1
    min -= range * 0.06
    max += range * 0.06
    const span = max - min || 1
    const yOf = (v: number) => H - ((v - min) / span) * (H - 2 * padY) - padY
    const xOf = (m: number) => ((m - 1) / 11) * W
    const newestYear = years[years.length - 1]?.year
    const lines = years.map((s, i) => {
      const sorted = [...s.points].sort((a, b) => a.m - b.m)
      const xy = sorted.map((p) => [xOf(p.m), yOf(p.value)] as [number, number])
      const last = sorted[sorted.length - 1]
      return {
        year: s.year,
        color: PALETTE[Math.min(i, PALETTE.length - 1)] ?? '#faf8f4',
        isNewest: s.year === newestYear,
        path: smoothPath(xy),
        end: last ? { xPct: (xOf(last.m) / W) * 100, yPct: (yOf(last.value) / H) * 100, value: last.value, lastM: last.m } : null,
        byMonth: new Map(sorted.map((p) => [p.m, p.value])),
        hidden: hidden.has(s.year),
      }
    })
    // y gridlines (4)
    const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ yPct: t * 100, value: max - t * span }))
    return { yOf, xOf, lines, grid, min, max, newestYear }
  }, [years, visible, hidden, H])

  // Area fill under the newest VISIBLE line.
  const areaPath = useMemo(() => {
    if (!geo) return ''
    const newestVisible = [...geo.lines].reverse().find((l) => !l.hidden && l.isNewest) ?? [...geo.lines].reverse().find((l) => !l.hidden)
    if (!newestVisible?.path) return ''
    // close the smoothed path down to the baseline
    const firstM = years.find((s) => s.year === newestVisible.year)?.points.map((p) => p.m).sort((a, b) => a - b)[0] ?? 1
    const lastM = years.find((s) => s.year === newestVisible.year)?.points.map((p) => p.m).sort((a, b) => b - a)[0] ?? 12
    return `${newestVisible.path} L${geo.xOf(lastM).toFixed(2)},${H} L${geo.xOf(firstM).toFixed(2)},${H} Z`
  }, [geo, years, H])

  function toggle(year: number) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      // never hide the last visible series
      else if (years.length - next.size > 1) next.add(year)
      return next
    })
  }

  // ── draw-in animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !geo) return
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const paths = gsap.utils.toArray<SVGPathElement>(`.kbmc-line`)
      if (reduce) {
        gsap.set(paths, { strokeDashoffset: 0 })
        return
      }
      paths.forEach((p, i) => {
        const len = p.getTotalLength()
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(p, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: 'power2.out',
          delay: i * 0.12,
          scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [geo, loading])

  // ── pointer + keyboard cursor ───────────────────────────────────────────────
  function pointerMonth(clientX: number): number | null {
    const el = plotRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0) return null
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return Math.round(t * 11) + 1 // 1–12
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive((m) => {
        const cur = m ?? 1
        if (e.key === 'Home') return 1
        if (e.key === 'End') return 12
        return Math.min(12, Math.max(1, cur + (e.key === 'ArrowRight' ? 1 : -1)))
      })
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  if (loading) {
    return (
      <div className="kbmc kbmc-loading" style={{ ['--kbmc-h' as string]: `${height}px` }} aria-hidden="true">
        <div className="kbmc-skeleton" />
      </div>
    )
  }
  if (!geo || years.every((s) => s.points.length === 0) || years.reduce((n, s) => n + s.points.length, 0) < 2) {
    return (
      <div className="kbmc kbmc-empty" role="note">
        Not enough closed-sale history yet to chart a trend here.
      </div>
    )
  }

  const activeReadout =
    active != null
      ? geo.lines
          .filter((l) => !l.hidden && l.byMonth.has(active))
          .map((l) => ({ year: l.year, color: l.color, value: l.byMonth.get(active)! }))
      : []

  return (
    <figure className="kbmc" ref={root} style={{ ['--kbmc-h' as string]: `${height}px` }} aria-label={ariaLabel}>
      {/* legend — toggle each year */}
      <div className="kbmc-legend" role="group" aria-label="Toggle years">
        {geo.lines.map((l) => (
          <button
            key={l.year}
            type="button"
            className={`kbmc-chip${l.hidden ? ' off' : ''}`}
            aria-pressed={!l.hidden}
            onClick={() => toggle(l.year)}
          >
            <span className="kbmc-swatch" style={{ background: l.hidden ? 'transparent' : l.color, borderColor: l.color }} />
            {l.year}
          </button>
        ))}
      </div>

      <div
        className="kbmc-plot"
        ref={plotRef}
        tabIndex={0}
        role="application"
        aria-label={`${ariaLabel}. Use arrow keys to read each month.`}
        onPointerMove={(e) => setActive(pointerMonth(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg className="kbmc-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`kbmc-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cream)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--cream)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* y gridlines */}
          {geo.grid.map((g, i) => (
            <line
              key={i}
              className="kbmc-grid"
              x1="0"
              x2={W}
              y1={(g.yPct / 100) * H}
              y2={(g.yPct / 100) * H}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* month gridlines — a calendar frame spanning Jan 1 (left edge) to
              Dec 31 (right edge); the two year-boundary edges are emphasized. */}
          {MONTHS.map((_, i) => {
            const x = (i / 11) * W
            const edge = i === 0 || i === 11
            return (
              <line
                key={`m${i}`}
                className={`kbmc-vgrid${edge ? ' edge' : ''}`}
                x1={x}
                x2={x}
                y1="0"
                y2={H}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {areaPath ? <path className="kbmc-area" d={areaPath} fill={`url(#kbmc-fill-${uid})`} /> : null}
          {geo.lines
            .filter((l) => !l.hidden)
            .map((l) => (
              <path
                key={l.year}
                className={`kbmc-line${l.isNewest ? ' newest' : ''}`}
                d={l.path}
                fill="none"
                stroke={l.color}
                strokeWidth={l.isNewest ? 2.5 : 1.5}
                strokeOpacity={l.isNewest ? 1 : 0.62}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>

        {/* HTML overlay — undistorted dots, endpoint labels, crosshair, tooltip */}
        <div className="kbmc-overlay" aria-hidden="true">
          {/* y-axis value labels */}
          {geo.grid.map((g, i) => (
            <span key={i} className="kbmc-ylabel" style={{ top: `${g.yPct}%` }}>
              {formatValue(g.value)}
            </span>
          ))}
          {/* endpoint dot + value label on the NEWEST VISIBLE line only — older
              years would otherwise litter the right edge with disconnected dots. */}
          {(() => {
            const lead = [...geo.lines].reverse().find((l) => !l.hidden && l.end)
            if (!lead?.end) return null
            const inProgress = lead.end.lastM < 12 // the year isn't over yet
            return (
              <>
                <span
                  className="kbmc-dot newest"
                  style={{ left: `${lead.end.xPct}%`, top: `${lead.end.yPct}%`, background: lead.color }}
                />
                <span
                  className="kbmc-endlabel mono-num"
                  style={{ left: `${lead.end.xPct}%`, top: `${lead.end.yPct}%` }}
                  data-side={lead.end.xPct > 78 ? 'left' : 'right'}
                >
                  {formatValue(lead.end.value)}
                  {inProgress ? <span className="kbmc-endlabel-as">as of {MONTHS[lead.end.lastM - 1]}</span> : null}
                </span>
              </>
            )
          })()}
          {/* crosshair + per-year readout */}
          {active != null && activeReadout.length > 0 ? (
            <>
              <span className="kbmc-cross" style={{ left: `${((active - 1) / 11) * 100}%` }} />
              <div
                className="kbmc-tip mono-num"
                style={{ left: `${((active - 1) / 11) * 100}%` }}
                data-side={active > 6 ? 'left' : 'right'}
              >
                <span className="kbmc-tip-mo">{MONTHS[active - 1]}</span>
                {activeReadout.map((r) => (
                  <span key={r.year} className="kbmc-tip-row">
                    <span className="kbmc-tip-sw" style={{ background: r.color }} />
                    {r.year} · {formatValue(r.value)}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* x-axis — month initials positioned at their EXACT data x (so they sit
          under the line points); Jan anchors the left edge (Jan 1), Dec the right
          edge (Dec 31). */}
      <div className="kbmc-xaxis" aria-hidden="true">
        {MONTH_INITIAL.map((m, i) => {
          const anchor = i === 0 ? 'start' : i === 11 ? 'end' : 'mid'
          return (
            <span
              key={i}
              className={`kbmc-xtick${active === i + 1 ? ' on' : ''}`}
              data-anchor={anchor}
              style={{ left: `${(i / 11) * 100}%` }}
            >
              {m}
            </span>
          )
        })}
      </div>

      {/* screen-reader data table */}
      <figcaption className="kbmc-sr">
        <table>
          <caption>{ariaLabel} by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {years.map((s) => (
                <th key={s.year} scope="col">
                  {s.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mo, i) => (
              <tr key={mo}>
                <th scope="row">{mo}</th>
                {years.map((s) => {
                  const v = s.points.find((p) => p.m === i + 1)?.value
                  return <td key={s.year}>{v != null ? formatValue(v) : '—'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}
