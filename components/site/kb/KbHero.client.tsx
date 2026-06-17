'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { kbMoneyFull, type KbHeroData } from './types'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import VoiceSearchButton from '@/components/VoiceSearchButton'

/**
 * KB hero — REUSABLE across page classes (homepage, city, community, …). All
 * copy + media are props with homepage defaults, so a geo page reuses this exact
 * component with its own eyebrow / title / lead / photo. Full-bleed video-or-photo
 * over the brand poster, masked line-reveal H1 in Amboqia, the plain-language +
 * voice search, and a live-number sub row. Single source of truth — never fork.
 */
type KbHeroProps = {
  data: KbHeroData
  /** Eyebrow line over the H1. */
  eyebrow?: string
  /** Two H1 lines (the second is indented). */
  titleTop?: string
  titleBottom?: string
  /** The sentence after "<n> homes for sale". */
  lead?: string
  /** Background video (mp4). If omitted, the poster image renders instead. */
  videoSrc?: string | null
  /** Poster / fallback still. */
  posterSrc?: string
  /** Honest label shown over the hero when the poster is a regional fallback, not a verified city photo. */
  mediaCaption?: string
}

export function KbHero({
  data,
  eyebrow = 'Central Oregon Real Estate',
  titleTop = 'Welcome to the',
  titleBottom = 'High Desert',
  lead = 'across six cities, from the Deschutes to Smith Rock.',
  videoSrc = '/videos/hero-optimized.mp4',
  posterSrc = '/images/hero/hero-old-mill-master-4k.jpg',
  mediaCaption,
}: KbHeroProps) {
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

  // Speak-plainly search: parse the typed-or-spoken query into structured
  // filters (beds/price/city/features) and route to the existing search.
  const routeFor = (raw: string) => router.push(searchHrefForQuery(raw))
  function submit(e: React.FormEvent) {
    e.preventDefault()
    routeFor(q)
  }

  const median = kbMoneyFull(data.medianListPrice)

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero-photo" data-parallax>
        {videoSrc ? (
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={posterSrc}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-video" src={posterSrc} alt="" />
        )}
        {mediaCaption ? <span className="hero-caption">{mediaCaption}</span> : null}
      </div>
      <div className="hero-grid-overlay" />
      <div className="hero-inner">
        <div className="hero-tag eyebrow"><span className="dot" /> {eyebrow}</div>
        <h1 className="hero-h display">
          <span className="reveal-mask"><span className="ln reveal-inner">{titleTop}</span></span>
          <span className="reveal-mask"><span className="ln indent reveal-inner">{titleBottom}</span></span>
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
            <VoiceSearchButton
              className="hs-mic"
              onTranscript={(t) => {
                setQ(t)
                routeFor(t)
              }}
            />
            <button type="submit" className="hs-go">Search</button>
          </form>
        </div>
        <div className="hero-sub-row">
          <p className="hero-sub">
            {data.activeCount != null ? <><b>{data.activeCount.toLocaleString('en-US')} homes</b> for sale</> : 'Homes for sale'} {lead}
            {median ? <> Median list <b>{median}</b>.</> : null}
            {data.medianDaysToPending != null ? <> Pending in <b>{data.medianDaysToPending} days</b>.</> : null}
          </p>
          <div className="hero-cta-row">
            <a href="/homes-for-sale" className="btn">Browse <span className="arr">→</span></a>
            <a href="/sell/valuation" className="btn ghost">Sell</a>
          </div>
        </div>
      </div>
    </section>
  )
}
