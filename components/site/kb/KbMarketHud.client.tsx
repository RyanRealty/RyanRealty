'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbMarketData } from './types'

/** Months-of-supply → market verdict (CLAUDE.md §0 thresholds: ≤4 seller, 4–6 balanced, ≥6 buyer). */
function verdictOf(mos: number | null): { key: 'seller' | 'balanced' | 'buyer'; label: string } | null {
  if (mos == null) return null
  if (mos <= 4) return { key: 'seller', label: "Seller's market" }
  if (mos >= 6) return { key: 'buyer', label: "Buyer's market" }
  return { key: 'balanced', label: 'Balanced market' }
}

function Kpi({ val, lbl }: { val: string | null; lbl: string }) {
  return (
    <div className="mkt-kpi">
      <span className="mkt-kpi-val">{val ?? '—'}</span>
      <span className="mkt-kpi-lbl">{lbl}</span>
    </div>
  )
}

/**
 * KB Market HUD (05) — the data-credibility centerpiece. MLS desk chrome + live
 * clock, a market VERDICT stamp (seller/balanced/buyer) next to the median with
 * its period change, a six-stat KPI grid, a drawn median-close chart with the
 * latest value called out, and a by-area price ladder. Every number is live and
 * traced to a cached DAL source (§0). Reused on the homepage (region) and every
 * city page (city scope) via props — never forked.
 */
export function KbMarketHud({ data }: { data: KbMarketData }) {
  const root = useRef<HTMLElement>(null)
  const line = useRef<SVGPathElement>(null)
  const [now, setNow] = useState('--:--:--')

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false })
    setNow(fmt())
    const t = setInterval(() => setNow(fmt()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const fills = gsap.utils.toArray<HTMLElement>('.mkt-bar .bfill')
      const ylines = gsap.utils.toArray<SVGPathElement>('.mkt-yearline')
      if (reduce) {
        fills.forEach((f) => (f.style.width = f.dataset.w || '0%'))
        if (line.current) gsap.set(line.current, { strokeDashoffset: 0 })
        return
      }
      if (ylines.length) {
        // year-over-year overlay: draw each year line in, oldest first, staggered.
        ylines.forEach((p, i) => {
          const len = p.getTotalLength()
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
          gsap.to(p, {
            strokeDashoffset: 0,
            duration: 1.5,
            ease: 'power2.out',
            delay: i * 0.13,
            scrollTrigger: { trigger: root.current, start: 'top 72%', once: true },
          })
        })
      } else if (line.current) {
        const len = line.current.getTotalLength()
        gsap.set(line.current, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(line.current, {
          strokeDashoffset: 0,
          duration: 1.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
        })
      }
      fills.forEach((f) =>
        gsap.fromTo(
          f,
          { width: '0%' },
          { width: f.dataset.w || '0%', duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: f, start: 'top 92%', once: true } },
        ),
      )
    }, root)
    return () => ctx.revert()
  }, [])

  // ── derived, live figures ────────────────────────────────────────────────
  const verdict = verdictOf(data.monthsSupply)
  const trend = data.trend
  const yoy =
    trend.length > 1 && trend[0]!.value > 0
      ? { pct: ((trend[trend.length - 1]!.value - trend[0]!.value) / trend[0]!.value) * 100, months: trend.length - 1 }
      : null

  // 13-month chart geometry
  const W = 1000
  const H = 300
  const pad = 16
  let area = ''
  let path = ''
  let lastPt: [number, number] | null = null
  let hi: { x: number; y: number; v: number } | null = null
  let lo: { x: number; y: number; v: number } | null = null
  if (trend.length > 1) {
    const vals = trend.map((t) => t.value)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1
    const pts = trend.map((t, i) => {
      const x = (i / (trend.length - 1)) * W
      const y = H - ((t.value - min) / span) * (H - 2 * pad) - pad
      return [x, y] as [number, number]
    })
    path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    area = `${path} L${W},${H} L0,${H} Z`
    lastPt = pts[pts.length - 1]!
    const hiI = vals.indexOf(max)
    const loI = vals.indexOf(min)
    hi = { x: (pts[hiI]![0] / W) * 100, y: (pts[hiI]![1] / H) * 100, v: max }
    lo = { x: (pts[loI]![0] / W) * 100, y: (pts[loI]![1] / H) * 100, v: min }
  }
  const lastPct = lastPt ? { x: (lastPt[0] / W) * 100, y: (lastPt[1] / H) * 100 } : null
  const lastMedian = trend.length ? trend[trend.length - 1]!.value : null

  const maxMed = Math.max(1, ...data.byTown.map((t) => t.median))

  // Year-over-year OVERLAY geometry — up to 5 calendar-year lines on a shared
  // Jan-Dec axis. Newest year lands on cream (brightest, thickest); prior years on
  // muted, distinct hues so seasonality + year-over-year shifts read at a glance.
  const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const YEAR_PALETTE = ['#8fa6cc', '#cf9088', '#7faf9c', '#d6bd79', '#faf8f4']
  const years = data.yearSeries ?? []
  const hasYears = years.length >= 2
  let yMin = Infinity
  let yMax = -Infinity
  for (const s of years) for (const p of s.points) {
    if (p.value < yMin) yMin = p.value
    if (p.value > yMax) yMax = p.value
  }
  const yrSpan = yMax - yMin || 1
  const colorBase = Math.max(0, YEAR_PALETTE.length - years.length)
  const yearLines = years.map((s, i) => ({
    year: s.year,
    color: YEAR_PALETTE[colorBase + i] ?? '#faf8f4',
    recent: i === years.length - 1,
    d: s.points
      .map((p, j) => {
        const x = ((p.m - 1) / 11) * W
        const y = H - ((p.value - yMin) / yrSpan) * (H - 2 * pad) - pad
        return `${j ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' '),
  }))

  return (
    <section className="section mkt" id="market-report" ref={root}>
      <div className="mkt-scan" />
      <div className="wrap">
        <div className="mkt-chrome">
          <span className="mono-lab">{data.byTown.length ? 'Market desk' : 'Central Oregon · MLS Desk'}</span>
          <span className="mkt-chrome-right">
            <span className="mkt-live">
              <span className="dot" />
              <span className="txt">Live · MLS</span>
            </span>
            <span className="mkt-clock mono-num">{now}</span>
          </span>
        </div>
        <div className="sec-head">
          <span className="sec-index">05 / The Market</span>
          <h2 className="sec-title display">
            The market,
            <br />
            on record
          </h2>
        </div>

        {/* Verdict stamp + median headline with period change */}
        <div className="mkt-verdict-row">
          {verdict ? (
            <div className={`mkt-verdict v-${verdict.key}`}>
              <span className="mkt-verdict-stamp">{verdict.label}</span>
              {data.monthsSupply != null ? (
                <span className="mkt-verdict-sub mono-num">{data.monthsSupply.toFixed(1)} months of supply</span>
              ) : null}
            </div>
          ) : null}
          {kbMoneyFull(data.medianList) ? (
            <div className="mkt-headline">
              <span className="mkt-headline-val">{kbMoneyFull(data.medianList)}</span>
              <span className="mkt-headline-meta">
                <span className="mkt-headline-lbl">Median list price</span>
                {yoy ? (
                  <span className={`mkt-headline-delta ${yoy.pct >= 0 ? 'up' : 'down'}`}>
                    {yoy.pct >= 0 ? '↑' : '↓'} {Math.abs(yoy.pct).toFixed(1)}% median sale, {yoy.months} mo
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>

        {/* Six-stat KPI grid */}
        <div className="mkt-kpis">
          <Kpi val={data.active != null ? data.active.toLocaleString('en-US') : null} lbl="Active homes" />
          <Kpi val={data.closed30 != null ? data.closed30.toLocaleString('en-US') : null} lbl="Closed · 30 days" />
          <Kpi val={data.new30 != null ? data.new30.toLocaleString('en-US') : null} lbl="New · 30 days" />
          <Kpi val={data.saleToList != null ? `${data.saleToList.toFixed(1)}%` : null} lbl="Sale to list" />
          <Kpi val={data.daysToPending != null ? `${Math.round(data.daysToPending)} days` : null} lbl="Median to pending" />
          <Kpi val={data.monthsSupply != null ? `${data.monthsSupply.toFixed(1)} mo` : null} lbl="Months of supply" />
        </div>

        {hasYears ? (
          <div className="mkt-panel">
            <div className="mkt-phead">
              <span className="mono-lab">▸ Median sale · single-family · {years.length}-year overlay</span>
              {kbMoneyFull(lastMedian) ? <span className="mkt-phead-now mono-num">{kbMoneyFull(lastMedian)}</span> : null}
            </div>
            <div className="mkt-chart">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map((g) => (
                  <line key={g} className="mkt-grid-line" x1="0" x2={W} y1={H * g} y2={H * g} />
                ))}
                {yearLines.map((yl) => (
                  <path
                    key={yl.year}
                    className="mkt-yearline"
                    d={yl.d}
                    fill="none"
                    stroke={yl.color}
                    strokeWidth={yl.recent ? 3 : 1.6}
                    strokeOpacity={yl.recent ? 1 : 0.82}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
            <div className="mkt-legend-years">
              {yearLines.map((yl) => (
                <span key={yl.year} className={`mkt-yl${yl.recent ? ' on' : ''}`}>
                  <i style={{ background: yl.color }} />
                  {yl.year}
                </span>
              ))}
            </div>
            <div className="mkt-xlabels mkt-xlabels-mo">
              {MONTH_ABBR.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        ) : trend.length > 1 ? (
          <div className="mkt-panel">
            <div className="mkt-phead">
              <span className="mono-lab">▸ Median close · single-family · {trend.length} mo</span>
              {kbMoneyFull(lastMedian) ? <span className="mkt-phead-now mono-num">{kbMoneyFull(lastMedian)}</span> : null}
            </div>
            <div className="mkt-chart">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map((g) => (
                  <line key={g} className="mkt-grid-line" x1="0" x2={W} y1={H * g} y2={H * g} />
                ))}
                <path className="mkt-area" d={area} />
                <path className="mkt-line" ref={line} d={path} />
              </svg>
              {hi ? (
                <span className="mkt-anno" style={{ left: `${hi.x}%`, top: `${hi.y}%` }}>
                  High <b>{kbMoneyFull(hi.v)}</b>
                </span>
              ) : null}
              {lo ? (
                <span className="mkt-anno below" style={{ left: `${lo.x}%`, top: `${lo.y}%` }}>
                  Low <b>{kbMoneyFull(lo.v)}</b>
                </span>
              ) : null}
              {lastPct ? <span className="mkt-end" style={{ left: `${lastPct.x}%`, top: `${lastPct.y}%` }} /> : null}
            </div>
            <div className="mkt-xlabels">
              {trend
                .filter((_, i) => i % 4 === 0 || i === trend.length - 1)
                .map((t, i) => (
                  <span key={i}>{t.label}</span>
                ))}
            </div>
          </div>
        ) : null}

        {data.byTown.length > 0 ? (
          <div className="mkt-panel">
            <div className="mkt-phead">
              <span className="mono-lab">▸ Median {data.byTown.length > 6 ? 'list · by neighborhood' : 'list · by town'}</span>
            </div>
            <div className="mkt-bars">
              {data.byTown.map((t) => (
                <div className="mkt-bar" key={t.name}>
                  <div className="bhd">
                    <span>{t.name}</span>
                    <b>{kbMoneyFull(t.median)}</b>
                  </div>
                  <div className="btrack">
                    <div className="bfill" data-w={`${Math.round((t.median / maxMed) * 100)}%`} style={{ width: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sec-cta">
          <a href="/housing-market" className="btn">
            See the full market report <span className="arr">→</span>
          </a>
        </div>
        <p className="mkt-fine">
          Live single-family figures from the regional MLS. Months of supply is active inventory divided by the homes closed in the last 6 months, then divided by 6. Four months or less is a seller&rsquo;s market, four to six is balanced, six or more is a buyer&rsquo;s market.
        </p>
      </div>
    </section>
  )
}
