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
  /**
   * Fix 6: descriptive alt text for the hero poster image.
   * Passed by the community/city page as "[Community] in [City], Oregon".
   * When absent, the image is treated as decorative (alt="").
   */
  posterAlt?: string
  /** Honest label shown over the hero when the poster is a regional fallback, not a verified city photo. */
  mediaCaption?: string
  /**
   * Optional CONTAINED portrait (e.g. a broker headshot) shown framed inside the
   * hero. Use this instead of piping a portrait into posterSrc — a portrait as the
   * full-bleed background scales to a blown-up face (Matt report 2026-06-18). When
   * set, pass a regional/landscape photo as posterSrc for the backdrop.
   */
  portraitSrc?: string
  /** Show the plain-language property search. Default true; set false on profile/non-search heroes (e.g. a broker page). */
  showSearch?: boolean
}

export function KbHero({
  data,
  eyebrow = 'Central Oregon Real Estate',
  titleTop = 'Welcome to the',
  titleBottom = 'High Desert',
  lead = 'across six cities, from the Deschutes to Smith Rock.',
  videoSrc = '/videos/hero-optimized.mp4',
  posterSrc = '/images/hero/hero-old-mill-master-4k.jpg',
  posterAlt,
  mediaCaption,
  portraitSrc,
  showSearch = true,
}: KbHeroProps) {
  const root = useRef<HTMLElement>(null)
  const router = useRouter()
  const [q, setQ] = useState('')
  // Responsive search placeholder: the full natural-language example clips in the
  // narrow mobile input (search icon + mic + Search button eat the width), which
  // showed as "...in Be" cut off. Default to the short form (SSR + mobile), expand
  // on >= 640px.
  const [searchPlaceholder, setSearchPlaceholder] = useState('3 bed under $800k')
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const apply = () => setSearchPlaceholder(mq.matches ? '3 bed under $800k in Bend with a shop' : '3 bed under $800k')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray<HTMLElement>('.hero-h .reveal-inner')
      // The reveal-mask clip is only needed WHILE the lines slide up. Once they
      // land, drop the clip entirely so the tall Amboqia glyphs are never cropped
      // (the static clip-path was too tight for some caps/devices — Matt's bug).
      const clearMaskClip = () => {
        document.querySelectorAll<HTMLElement>('.hero-h .reveal-mask, .hero-h .reveal-line')
          .forEach((m) => { m.style.clipPath = 'none' })
      }
      if (reduce) {
        gsap.set(lines, { yPercent: 0, opacity: 1 })
        clearMaskClip()
        return
      }
      gsap.set(lines, { yPercent: 115 })
      gsap.to(lines, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.085, delay: 0.15, onComplete: clearMaskClip })
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
          // Fix 6: descriptive alt text (posterAlt from the page).
          // Fix 8: fetchPriority high so the LCP hero is the browser top-priority
          // image request and is not starved by font preloads.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="hero-video"
            src={posterSrc}
            alt={posterAlt ?? ''}
            fetchPriority="high"
          />
        )}
        {mediaCaption ? <span className="hero-caption">{mediaCaption}</span> : null}
      </div>
      <div className="hero-grid-overlay" />
      <div className="hero-inner">
        {portraitSrc ? (
          <div className="hero-portrait" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitSrc} alt="" />
          </div>
        ) : null}
        <div className="hero-tag eyebrow"><span className="dot" /> {eyebrow}</div>
        <h1 className="hero-h display" aria-label={`${titleTop} ${titleBottom}`}>
          <span className="reveal-mask" aria-hidden="true"><span className="ln reveal-inner">{titleTop}</span></span>
          <span className="reveal-mask" aria-hidden="true"><span className="ln indent reveal-inner">{titleBottom}</span></span>
        </h1>
        {showSearch ? (
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
              placeholder={searchPlaceholder}
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
        ) : null}
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
