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
  /** Closed sales behind this month's median. Months below the volume floor are
   *  suppressed (sparse-geo noise control). null = unknown (never suppressed). */
  soldCount?: number | null
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
// Two-color brand system (Design System v2): every year line is CREAM on the navy
// chart; years are distinguished by BRIGHTNESS (recency), never hue. The current year
// is full cream + thickest (the focal line); older years fade back as context. No
// rainbow — the multi-hue palette was the off-brand "spaghetti" look.
const LINE_INK = '#faf8f4'
// A month closed by fewer than this many sales is noise, not a trend: suppress it and
// break the line across the gap rather than zigzagging through it (§0 honesty).
const VOLUME_FLOOR = 3

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${Math.round(n / 1000).toLocaleString('en-US')}K`
}

/**
 * Straight-segment polyline that BREAKS across month gaps. Honest time-series
 * rendering — the standard for market/price charts (Zillow, Redfin, every stock
 * chart): smoothing would imply median values between months that don't exist and
 * overshoot the data (§0). Each point carries its calendar month; when the next
 * plotted month isn't contiguous (a sparse/suppressed month was dropped), the line
 * lifts (new "M") instead of asserting a value through the gap.
 */
function brokenPath(pts: [number, number, number][]): string {
  if (pts.length === 0) return ''
  let d = ''
  let prevM: number | null = null
  for (const [x, y, m] of pts) {
    const cmd = prevM != null && m - prevM === 1 ? 'L' : 'M'
    d += `${cmd}${x.toFixed(2)},${y.toFixed(2)} `
    prevM = m
  }
  return d.trim()
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
      // Suppressed (sub-floor) months don't set the axis — otherwise a single-sale
      // outlier would blow out the Y-range and flatten the real line.
      if (p.soldCount != null && p.soldCount < VOLUME_FLOOR) continue
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
    const nYears = years.length
    const lines = years.map((s, i) => {
      const sorted = [...s.points].sort((a, b) => a.m - b.m)
      // Sparse-geo volume floor: drop months below the closed-sale floor (noise, not
      // a trend); brokenPath then lifts the line across the gap. soldCount null
      // (older cache rows) is treated as present — never suppress what we can't size.
      const plotted = sorted.filter((p) => p.soldCount == null || p.soldCount >= VOLUME_FLOOR)
      const last = plotted[plotted.length - 1]
      const isNewest = s.year === newestYear
      const recency = nYears - 1 - i // 0 = newest
      // Completed (past) calendar years render full solid; ONLY the current year
      // legitimately stops mid-axis and gets the "as of" marker (below) — never a
      // fabricated continuation to December (§0).
      return {
        year: s.year,
        color: LINE_INK,
        // Distinguish years by brightness, not hue: current year full cream, older
        // years fade back so the focal line is unmistakable and we stay two-color.
        opacity: isNewest ? 1 : Math.max(0.26, 0.6 - recency * 0.085),
        isNewest,
        path: brokenPath(plotted.map((p) => [xOf(p.m), yOf(p.value), p.m] as [number, number, number])),
        end: last ? { xPct: (xOf(last.m) / W) * 100, yPct: (yOf(last.value) / H) * 100, value: last.value, lastM: last.m } : null,
        byMonth: new Map(plotted.map((p) => [p.m, p.value])),
        hidden: hidden.has(s.year),
      }
    })
    // y gridlines (4)
    const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ yPct: t * 100, value: max - t * span }))
    // The current calendar year only has data through its last reported month.
    // Expose that month so the chart can shade the not-yet-happened remainder +
    // draw an "as of" divider — so a current-year line that stops mid-axis reads as
    // "year in progress", not as a broken/ragged line ending at a random point.
    const newestLine = lines.find((l) => l.year === newestYear)
    const asOfMonth = newestLine?.end && newestLine.end.lastM < 12 ? newestLine.end.lastM : null
    return { yOf, xOf, lines, grid, min, max, newestYear, asOfMonth }
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
          {/* Current year still in progress: shade the not-yet-happened months and
              drop a divider at the "as of" month, so the current-year line stopping
              mid-axis reads as expected (year so far) rather than as a broken line. */}
          {geo.asOfMonth ? (
            <>
              <rect
                className="kbmc-future"
                x={geo.xOf(geo.asOfMonth)}
                y="0"
                width={Math.max(0, W - geo.xOf(geo.asOfMonth))}
                height={H}
              />
              <line
                className="kbmc-asof"
                x1={geo.xOf(geo.asOfMonth)}
                x2={geo.xOf(geo.asOfMonth)}
                y1="0"
                y2={H}
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
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
                strokeOpacity={l.opacity}
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
          {/* "as of" divider label — anchors the current-year cutoff so the
              shaded remainder reads as "rest of the year, not yet happened". */}
          {geo.asOfMonth ? (
            <span
              className="kbmc-asof-label mono-num"
              style={{ left: `${(geo.xOf(geo.asOfMonth) / W) * 100}%` }}
              data-side={(geo.xOf(geo.asOfMonth) / W) * 100 > 82 ? 'left' : 'right'}
            >
              as of {MONTHS[geo.asOfMonth - 1]}
            </span>
          ) : null}
          {/* endpoint dot + value label on the NEWEST VISIBLE line only — older
              years would otherwise litter the right edge with disconnected dots. */}
          {(() => {
            const lead = [...geo.lines].reverse().find((l) => !l.hidden && l.end)
            if (!lead?.end) return null
            // "as of" only on the CURRENT (newest) year — a completed past year that
            // happens to lack a trailing month is NOT in progress; it just ends there.
            const inProgress = lead.year === geo.newestYear && lead.end.lastM < 12
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
