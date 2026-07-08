'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbFeaturedItem } from './types'
import { useInViewAutoplay } from './use-in-view-autoplay'

/**
 * KB Featured homes (04) — asymmetric poster grid of the highest-value active
 * listings, video-tour homes first. Default state is the LISTING PHOTO. The tile
 * switches to its MLS video tour — a muted background loop with NO controls / no
 * play button (the embed URL is pre-set to background mode) — when it becomes the
 * in-focus card on screen (viewport autoplay, like a social feed) OR on pointer
 * hover / keyboard focus, and reverts to the photo otherwise. One video plays at
 * a time. Only the active tile mounts its video.
 */
export function KbFeatured({ items, eyebrow = 'Featured homes' }: { items: KbFeaturedItem[]; eyebrow?: string }) {
  const root = useRef<HTMLElement>(null)
  const { inViewKey, register } = useInViewAutoplay()
  const [hovered, setHovered] = useState<string | null>(null)
  const activeHref = hovered ?? inViewKey
  const enter = (href: string) => setHovered(href)
  const leave = (href: string) => setHovered((p) => (p === href ? null : p))

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.lst-card')
      if (reduce) gsap.set(cards, { opacity: 1, y: 0 })
      else
        gsap.from(cards, {
          opacity: 0,
          y: 26,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
        })
    }, root)
    return () => ctx.revert()
  }, [])

  if (items.length === 0) return null

  // The asymmetric poster grid is a repeating module — a hero (full width), a pair,
  // then uniform thirds. Cap to a count whose final row of thirds is FULL so the
  // grid never leaves an orphan tiny tile + dead whitespace: hero(1) + pair(2) +
  // multiples of 3 thirds -> 3, 6, 9, 12. Show the largest that fits.
  const shown = items.slice(0, [12, 9, 6, 3].find((c) => items.length >= c) ?? items.length)

  return (
    <section className="section listings" id="listings" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">
            Featured
            <br />
            homes
          </h2>
        </div>
        <div className="lst-grid">
          {shown.map((it) => {
            const playing = activeHref === it.href && !!it.video
            return (
              <a
                key={it.href}
                ref={register(it.href)}
                className={`lst-card${playing ? ' playing' : ''}`}
                href={it.href}
                aria-label={`${it.address}, ${it.city}${it.price ? ` – ${kbMoneyFull(it.price)}` : ''}${it.beds != null ? `, ${it.beds} bed` : ''}${it.baths != null ? `, ${it.baths} bath` : ''}. View listing.`}
                onMouseEnter={() => enter(it.href)}
                onMouseLeave={() => leave(it.href)}
                onFocus={() => enter(it.href)}
                onBlur={() => leave(it.href)}
              >
                <div className="lst-media">
                  {it.img ? (
                    <img className="lst-img" src={it.img} alt={it.address} loading="lazy" />
                  ) : (
                    // No MLS photo: brand-navy block instead of an empty <img src="">
                    // (which re-requests the page and renders a broken frame).
                    <div className="lst-img" style={{ background: 'var(--navy)' }} aria-hidden="true" />
                  )}
                  {playing && it.video ? (
                    it.video.embedType === 'video-tag' ? (
                      <video
                        className="lst-video"
                        src={it.video.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={it.img || undefined}
                      />
                    ) : (
                      <iframe
                        className="lst-video"
                        src={it.video.url}
                        title={`${it.address} video tour`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ border: 0 }}
                      />
                    )
                  ) : null}
                  {it.tour && !playing ? <span className="lst-tour">▶ Tour</span> : null}
                </div>
                <div className="lst-info">
                  <div>
                    <div className="lst-price mono-num">{kbMoneyFull(it.price)}</div>
                    <div className="lst-addr">
                      {it.address}
                      <span className="sub">
                        {it.sub ? it.sub + ' · ' : ''}
                        {it.city}
                      </span>
                    </div>
                  </div>
                  <div className="lst-specs">
                    {it.beds != null ? <span>{it.beds} bd</span> : null}
                    {it.baths != null ? <span>{it.baths} ba</span> : null}
                    {it.sqft ? <span>{Number(it.sqft).toLocaleString('en-US')} sf</span> : null}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
        <div className="lst-foot">
          <a href="/homes-for-sale" className="btn alt">
            All homes for sale <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
