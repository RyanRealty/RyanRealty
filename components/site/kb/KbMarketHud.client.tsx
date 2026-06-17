'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbMarketData } from './types'

function Bullet({ val, suf, lbl }: { val: string; suf: string; lbl: string }) {
  return (
    <div className="bull">
      <div className="bull-fig">
        <span className="bull-val">{val}</span>
        <span className="bull-suf">{suf}</span>
      </div>
      <div className="bull-body">
        <span className="bull-lbl">{lbl}</span>
      </div>
    </div>
  )
}

/**
 * KB Market HUD (05) — the data-credibility centerpiece. MLS desk chrome + live
 * clock, count strip, KPI bullets, a 13-month median-close chart, and a by-town
 * price ladder. Every number is live and traced to a cached DAL source (§0).
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
      if (reduce) {
        fills.forEach((f) => (f.style.width = f.dataset.w || '0%'))
        return
      }
      if (line.current) {
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
          { width: f.dataset.w || '0%', duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: f, start: 'top 90%', once: true } },
        ),
      )
    }, root)
    return () => ctx.revert()
  }, [])

  // 13-month chart geometry
  const trend = data.trend
  const W = 1000
  const H = 320
  const pad = 14
  let area = ''
  let path = ''
  if (trend.length > 1) {
    const vals = trend.map((t) => t.value)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const span = max - min || 1
    const pts = trend.map((t, i) => {
      const x = (i / (trend.length - 1)) * W
      const y = H - ((t.value - min) / span) * (H - 2 * pad) - pad
      return [x, y]
    })
    path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    area = `${path} L${W},${H} L0,${H} Z`
  }

  const maxMed = Math.max(1, ...data.byTown.map((t) => t.median))

  return (
    <section className="section mkt" id="market-report" ref={root}>
      <div className="mkt-scan" />
      <div className="wrap">
        <div className="mkt-chrome">
          <span className="mono-lab">Central Oregon · MLS Desk</span>
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

        <div className="mkt-counts">
          {data.active != null ? (
            <div className="c">
              <b>{data.active.toLocaleString('en-US')}</b>
              <span>Active</span>
            </div>
          ) : null}
          {data.closed30 != null ? (
            <div className="c">
              <b>{data.closed30.toLocaleString('en-US')}</b>
              <span>Closed · 30d</span>
            </div>
          ) : null}
          {data.new30 != null ? (
            <div className="c">
              <b>{data.new30.toLocaleString('en-US')}</b>
              <span>New · 30d</span>
            </div>
          ) : null}
          {kbMoneyFull(data.medianList) ? (
            <div className="c">
              <b>{kbMoneyFull(data.medianList)}</b>
              <span>Median list</span>
            </div>
          ) : null}
        </div>

        <div className="mkt-bullets">
          {data.saleToList != null ? <Bullet val={data.saleToList.toFixed(1)} suf="%" lbl="Median sale to list" /> : null}
          {data.daysToPending != null ? <Bullet val={String(data.daysToPending)} suf=" days" lbl="Median to pending" /> : null}
          {data.monthsSupply != null ? <Bullet val={data.monthsSupply.toFixed(1)} suf=" mo" lbl="Months of supply" /> : null}
        </div>

        {trend.length > 1 ? (
          <div className="mkt-panel">
            <div className="mkt-phead">
              <span className="mono-lab">▸ Median close · single-family · {trend.length} mo</span>
            </div>
            <div className="mkt-chart">
              <svg viewBox="0 0 1000 320" preserveAspectRatio="none">
                <path className="mkt-area" d={area} />
                <path className="mkt-line" ref={line} d={path} />
              </svg>
            </div>
            <div className="mkt-xlabels">
              {trend.filter((_, i) => i % 4 === 0 || i === trend.length - 1).map((t, i) => (
                <span key={i}>{t.label}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mkt-panel">
          <div className="mkt-phead">
            <span className="mono-lab">▸ Median list · by town</span>
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

        <div className="sec-cta">
          <a href="/housing-market" className="btn">
            See the full market report <span className="arr">→</span>
          </a>
        </div>
        <p className="mkt-fine">
          Closed single-family sales across Bend, Redmond, Sisters, Sunriver, La Pine and Terrebonne. Pulled from the MLS.
        </p>
      </div>
    </section>
  )
}
