'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbSellData } from './types'
import { valuationPath } from '@/lib/slug'

/**
 * KB Sell (06) — the primary seller conversion block. Address-capture hands off
 * to the real seller valuation flow (/sell/valuation), which owns the native lead
 * write + attribution (Phase 4/6). Show-don't-tell copy; three live proof
 * numbers. Cream split breaks the navy run.
 */
export function KbSell({ data, eyebrow = 'Sell with us' }: { data: KbSellData; eyebrow?: string }) {
  const root = useRef<HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const [address, setAddress] = useState('')

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      if (reduce) return
      gsap.from('.sell-copy > *', {
        opacity: 0,
        y: 22,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: root.current, start: 'top 75%', once: true },
      })
      gsap.from('.sell-media img', {
        scale: 1.14,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = address.trim()
    // `from` carries the originating surface into the valuation flow so the
    // lead records WHICH page converted (2026-07-15 conversion audit — every
    // KbSell lead previously landed under one generic legacy source path).
    const params = new URLSearchParams()
    if (v) params.set('address', v)
    if (pathname) params.set('from', pathname)
    const qs = params.toString()
    router.push(qs ? `${valuationPath()}?${qs}` : valuationPath())
  }

  const medianCaption = data.medianCaption?.trim() || null
  const median = medianCaption ? kbMoneyFull(data.medianListPrice) : null

  return (
    <section className="section sell" id="sell" ref={root}>
      <div className="sell-grid">
        <div className="sell-copy">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sell-h display">
            {"What's your "}
            <br />
            home worth?
          </h2>
          {/* Buffett restore 2026-08-10: keep every fact (3+3 comps, free, no
              listing agreement). Allow the short interpretation the 2026-08-06
              GOV.UK pass stripped — that is how Berkshire letters work. */}
          <p className="sell-p">
            A broker pulls three closed comps and three active comps near you, then writes the price range
            they support. Free, with no listing agreement. Useful whether you list next month or next year.
          </p>
          <form className="sell-form" onSubmit={submit}>
            <input
              type="text"
              placeholder="Enter your home address"
              aria-label="Home address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button type="submit" className="btn" aria-label="Value my home">
              Value my home <span className="arr" aria-hidden="true">→</span>
            </button>
          </form>
          <div className="sell-data">
            {median ? (
              <div className="d">
                <div className="n mono-num">{median}</div>
                <div className="l">{medianCaption}</div>
              </div>
            ) : null}
            {data.medianDaysToPending != null ? (
              <div className="d">
                <div className="n mono-num">{data.medianDaysToPending} days</div>
                <div className="l">Median to pending</div>
              </div>
            ) : data.medianDomActive != null ? (
              <div className="d">
                <div className="n mono-num">{data.medianDomActive} days</div>
                <div className="l">Median on market · active</div>
              </div>
            ) : null}
            {data.soldCount30d != null ? (
              <div className="d">
                <div className="n mono-num">{data.soldCount30d.toLocaleString('en-US')}</div>
                <div className="l">Closed · 30 days</div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="sell-media">
          <img src="/images/kb/three-sisters-sunrise.jpg" alt="Alpenglow on the Three Sisters at sunrise" loading="lazy" />
        </div>
      </div>
    </section>
  )
}
