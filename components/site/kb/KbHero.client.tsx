'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { kbMoneyFull, type KbHeroData } from './types'

/**
 * KB hero — full-bleed Old Mill drone video over the brand poster, masked
 * line-reveal H1 in Amboqia, a plain-language search that routes to
 * /homes-for-sale?keywords=, and a live-number sub row. Voice-locked copy.
 */
export function KbHero({ data }: { data: KbHeroData }) {
  const root = useRef<HTMLElement>(null)
  const router = useRouter()
  const [q, setQ] = useState('')

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray<HTMLElement>('.hero-h .reveal-inner')
      if (reduce) {
        gsap.set(lines, { yPercent: 0, opacity: 1 })
        return
      }
      gsap.set(lines, { yPercent: 115 })
      gsap.to(lines, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.085, delay: 0.15 })
      gsap.from('.hero-tag, .hero-sub-row, .hero-search-wrap', {
        opacity: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.5,
      })
    }, root)
    return () => ctx.revert()
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = q.trim()
    router.push(v ? `/homes-for-sale?keywords=${encodeURIComponent(v)}` : '/homes-for-sale')
  }

  const median = kbMoneyFull(data.medianListPrice)

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero-photo" data-parallax>
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/hero/hero-old-mill-master-4k.jpg"
        >
          <source src="/videos/hero-optimized.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="hero-grid-overlay" />
      <div className="hero-inner">
        <div className="hero-tag eyebrow"><span className="dot" /> Central Oregon Real Estate</div>
        <h1 className="hero-h display">
          <span className="reveal-mask"><span className="ln reveal-inner">Bend and the</span></span>
          <span className="reveal-mask"><span className="ln indent reveal-inner">high desert</span></span>
        </h1>
        <div className="hero-search-wrap">
          <form className="hero-search" role="search" onSubmit={submit}>
            <svg className="hs-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              className="hs-input"
              type="text"
              autoComplete="off"
              aria-label="Search homes in plain language"
              placeholder="3 bed under $800k in Bend with a shop"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="hs-go">Search</button>
          </form>
        </div>
        <div className="hero-sub-row">
          <p className="hero-sub">
            {data.activeCount != null ? <><b>{data.activeCount.toLocaleString('en-US')} homes</b> for sale</> : 'Homes for sale'} across six towns, from the Deschutes to Smith Rock.
            {median ? <> Median list <b>{median}</b>.</> : null}
            {data.medianDaysToPending != null ? <> Pending in <b>{data.medianDaysToPending} days</b>.</> : null}
          </p>
          <div className="hero-cta-row">
            <a href="#listings" className="btn">Browse <span className="arr">→</span></a>
            <a href="#sell" className="btn ghost">Sell</a>
          </div>
        </div>
      </div>
    </section>
  )
}
