'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbSellData } from './types'

/**
 * KB Sell (06) — the primary seller conversion block. Address-capture hands off
 * to the real seller valuation flow (/sell/valuation), which owns the FUB lead
 * write + attribution (Phase 4/6). Show-don't-tell copy; three live proof
 * numbers. Cream split breaks the navy run.
 */
export function KbSell({ data, eyebrow = 'Sell with us' }: { data: KbSellData; eyebrow?: string }) {
  const root = useRef<HTMLElement>(null)
  const router = useRouter()
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
    router.push(v ? `/sell/valuation?address=${encodeURIComponent(v)}` : '/sell/valuation')
  }

  const median = kbMoneyFull(data.medianListPrice)

  return (
    <section className="section sell" id="sell" ref={root}>
      <div className="sell-grid">
        <div className="sell-copy">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sell-h display">
            What&rsquo;s your
            <br />
            home worth?
          </h2>
          <p className="sell-p">
            A real number, not a guess. Built from what your street actually trades for, the days on market on
            your block, and the comps that closed this quarter.
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
                <div className="l">Regional median</div>
              </div>
            ) : null}
            {data.medianDaysToPending != null ? (
              <div className="d">
                <div className="n mono-num">{data.medianDaysToPending} days</div>
                <div className="l">Median to pending</div>
              </div>
            ) : null}
            {data.soldCount30d != null ? (
              <div className="d">
                <div className="n mono-num">{data.soldCount30d.toLocaleString('en-US')}</div>
                <div className="l">Sold · 30 days</div>
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
