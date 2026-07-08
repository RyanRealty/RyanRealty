'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbMarketData } from './types'
import { KbMarketChart } from './KbMarketChart.client'

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
export function KbMarketHud({
  data,
  eyebrow = 'The market',
  chartScopeLabel,
}: {
  data: KbMarketData
  eyebrow?: string
  /**
   * When the trend chart shows a DIFFERENT geography than the section (e.g. a
   * community page whose own neighborhood sales are too sparse, so the chart falls
   * back to the parent city), this label names that geography in the chart panel so
   * the city figure is never read as the community's. (§0 honesty.)
   */
  chartScopeLabel?: string
}) {
  const root = useRef<HTMLElement>(null)
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
      // Only the by-area bars animate here; the chart (KbMarketChart) owns its
      // own reduced-motion-safe draw-in.
      const fills = gsap.utils.toArray<HTMLElement>('.mkt-bar .bfill')
      if (reduce) {
        fills.forEach((f) => (f.style.width = f.dataset.w || '0%'))
        return
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

  const lastMedian = trend.length ? trend[trend.length - 1]!.value : null
  const maxMed = Math.max(1, ...data.byTown.map((t) => t.median))

  // Multi-year median series for the interactive chart. KbMarketChart owns all the
  // geometry, smoothing, year toggles, axis, hover readout, and draw-in.
  const years = data.yearSeries ?? []
  const chartPoints = years.reduce((n, s) => n + s.points.length, 0)

  // KPI tiles — include each ONLY when it has a live value, so a scope without a
  // metric shows fewer tiles instead of a wall of em-dashes. For neighborhood/
  // community scope (no market_pulse_live row) the 30-day Closed/Median-to-pending
  // tiles fall back to the 12-month market_stats_cache figures, RELABELED honestly
  // ("Sold · 12 mo", "Median on market · 12 mo") — a 12-month number is never
  // shown under a 30-day label. (§0)
  const kpis: { val: string; lbl: string }[] = []
  if (data.active != null) kpis.push({ val: data.active.toLocaleString('en-US'), lbl: 'Active homes' })
  if (data.closed30 != null) kpis.push({ val: data.closed30.toLocaleString('en-US'), lbl: 'Closed · 30 days' })
  else if (data.sold12mo != null) kpis.push({ val: data.sold12mo.toLocaleString('en-US'), lbl: 'Sold · 12 mo' })
  if (data.new30 != null) kpis.push({ val: data.new30.toLocaleString('en-US'), lbl: 'New · 30 days' })
  if (data.saleToList != null) kpis.push({ val: `${data.saleToList.toFixed(1)}%`, lbl: 'Sale to list' })
  if (data.daysToPending != null) kpis.push({ val: `${Math.round(data.daysToPending)} days`, lbl: 'Median to pending' })
  else if (data.medianDom12mo != null) kpis.push({ val: `${Math.round(data.medianDom12mo)} days`, lbl: 'Median on market · 12 mo' })
  if (data.monthsSupply != null) kpis.push({ val: `${data.monthsSupply.toFixed(1)} mo`, lbl: 'Months of supply' })

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
          <span className="sec-index">{eyebrow}</span>
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
                {/* The list-price headline carries NO delta: the only trend we hold
                    is median-CLOSE, shown (with its change) on the chart below, so a
                    sale-derived % must not sit on a list-price number. (§0) */}
              </span>
            </div>
          ) : null}
        </div>

        {/* KPI grid — only tiles with live values render (no em-dash wall) */}
        <div className="mkt-kpis">
          {kpis.map((k) => (
            <Kpi key={k.lbl} val={k.val} lbl={k.lbl} />
          ))}
        </div>

        {chartPoints >= 2 ? (
          <div className="mkt-panel">
            <div className="mkt-phead">
              <span className="mono-lab">
                ▸ Median sale · single-family{chartScopeLabel ? ` · ${chartScopeLabel}` : ''} ·{' '}
                {years.length >= 2 ? `${years.length}-year overlay` : 'monthly'}
                {yoy ? `  ${yoy.pct >= 0 ? '↑' : '↓'} ${Math.abs(yoy.pct).toFixed(1)}% over the window` : ''}
              </span>
              {kbMoneyFull(lastMedian) ? <span className="mkt-phead-now mono-num">{kbMoneyFull(lastMedian)}</span> : null}
            </div>
            <KbMarketChart
              years={years}
              ariaLabel={`Median sale price by year${chartScopeLabel ? `, ${chartScopeLabel}` : data.byTown.length ? ', this area' : ', Central Oregon'}`}
              height={320}
            />
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
          Live single-family figures from the regional MLS. Months of supply is active inventory divided by the homes closed in the last 6 months, then divided by 6. Four months or less is a seller&rsquo;s market, four to six is balanced, six or more is a buyer&rsquo;s market. Sale to list compares the final sale price to the asking price. Median to pending is days from listing to an accepted offer.
        </p>
      </div>
    </section>
  )
}
