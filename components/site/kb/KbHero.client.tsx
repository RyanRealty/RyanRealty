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
  /**
   * Render the sub-line as the plain `lead` only, without the "Homes for sale"
   * stat prefix or the median/pending stats. Use on content hubs (events,
   * venues, golf) whose lead is a full sentence, not a listings count.
   */
  statless?: boolean
  /**
   * What `data.activeCount` counts, when it is not homes for sale — e.g.
   * "price drops" renders "60 price drops <lead>" instead of the default
   * "60 homes for sale <lead>". Keeps the stat prefix honest (§0).
   */
  countNoun?: string
  /**
   * Per-page CTA intent (design-audit P1): the default Browse-primary/Sell-ghost
   * pair steered sellers into buyer search on the seller money pages. Pass
   * `cta` to set the filled primary; `ctaSecondary` for the ghost (or null to
   * render the primary alone).
   */
  cta?: { href: string; label: string }
  ctaSecondary?: { href: string; label: string } | null
}

export function KbHero({
  data,
  eyebrow = 'Central Oregon Real Estate',
  titleTop = 'Welcome to the',
  titleBottom = 'High Desert',
  lead = 'across Central Oregon, from the Deschutes to Smith Rock.',
  videoSrc = '/videos/hero-optimized.mp4',
  posterSrc = '/images/hero/hero-old-mill-master-4k.jpg',
  posterAlt,
  mediaCaption,
  portraitSrc,
  showSearch = true,
  statless = false,
  countNoun,
  cta = { href: '/homes-for-sale', label: 'Browse' },
  // Value framing, not a bare one-word "Sell" — the ghost button was the whole
  // mobile seller path above the fold (design-audit P2).
  ctaSecondary = { href: '/sell/valuation', label: 'Home worth?' },
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

  // prefers-reduced-motion previously gated only the GSAP text reveal, not the
  // full-viewport autoplay/loop background video — a vestibular-disorder
  // visitor had no way to stop it (design-audit P2, accessibility).
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const apply = () => setReduceMotion(mq.matches)
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
  const showVideo = Boolean(videoSrc) && reduceMotion === false

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero-photo" data-parallax>
        {showVideo ? (
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={posterSrc}
          >
            <source src={videoSrc ?? undefined} type="video/mp4" />
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
          {/* Explicit space between the two inline-block reveal masks: when a
              short two-word title fits on one line the words keep their gap
              ("Contact Us", not "ContactUs"); at a line wrap the space
              collapses, so long titles are unaffected (design-audit P2). */}
          <span className="reveal-mask" aria-hidden="true"><span className="ln reveal-inner">{titleTop}</span></span>{' '}
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
            {statless ? (
              lead
            ) : (
              <>
                {data.activeCount != null ? (
                  countNoun ? (
                    <>
                      <b>{data.activeCount.toLocaleString('en-US')} {countNoun}</b>{' '}
                    </>
                  ) : (
                    <>
                      <b>{data.activeCount.toLocaleString('en-US')} homes</b> for sale{' '}
                    </>
                  )
                ) : null}
                {lead}
                {median ? (
                  <>
                    {' '}
                    Median list <b>{median}</b>.
                  </>
                ) : null}
                {data.medianDaysToPending != null ? (
                  <>
                    {' '}
                    Pending in <b>{data.medianDaysToPending} days</b>.
                  </>
                ) : null}
              </>
            )}
          </p>
          <div className="hero-cta-row">
            <a href={cta.href} className="btn">{cta.label} <span className="arr">→</span></a>
            {ctaSecondary ? <a href={ctaSecondary.href} className="btn ghost">{ctaSecondary.label}</a> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
