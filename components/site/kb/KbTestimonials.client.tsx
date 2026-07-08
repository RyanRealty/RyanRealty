'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { KbReview } from './types'

const GOOGLE_URL = 'https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR'

// One five-point star, point-up inside a 24×24 box.
const STAR_PATH =
  'M12 1.6 L15.09 8.01 L22.06 8.86 L16.95 13.62 L18.27 20.51 L12 17.12 L5.73 20.51 L7.05 13.62 L1.94 8.86 L8.91 8.01 Z'

/**
 * KB Testimonials — compact "In their words" review card grid (matches the
 * design_system ui_kits/team mockup). Up to six verified Google reviews render
 * as hard-edged cards, each with a five-star rating, the verbatim quote, and
 * attribution. This REPLACES the prior single oversized auto-cycling plate
 * (Matt 2026-06-18: "too big and clunky").
 *
 * Reviews are quoted verbatim with attribution, so the copy is exempt from the
 * Five Laws and is never altered. Props unchanged: { reviews: KbReview[] } — so
 * every page that already uses this (home, city, community, about, team, …)
 * picks up the compact layout with no call-site change. A reduced-motion-safe
 * stagger reveal; under reduced motion the cards simply appear.
 */
export function KbTestimonials({ reviews }: { reviews: KbReview[] }) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const ctx = gsap.context(() => {
      gsap.from('.kb-rev-card', {
        opacity: 0,
        y: 22,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const shown = reviews.slice(0, 6)
  if (shown.length === 0) return null

  return (
    <section className="section kb-reviews" id="reviews" ref={root} aria-label="Client reviews">
      <div className="wrap">
        <div className="sec-head kb-reviews-head">
          {/* "Recent reviews" made a freshness claim the undated cards could not
              back — the quotes are verbatim Google reviews, not a dated feed
              (design-audit P3). */}
          <div>
            <span className="sec-index">Google reviews</span>
            <h2 className="sec-title display">In their words</h2>
          </div>
          <a className="kb-reviews-all" href={GOOGLE_URL} target="_blank" rel="noopener">
            Read all on Google <span className="arr">→</span>
          </a>
        </div>

        <div className="kb-reviews-grid">
          {shown.map((rv, i) => (
            <figure className="kb-rev-card" key={rv.author + i}>
              <div className="kb-rev-stars" role="img" aria-label="Five out of five stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d={STAR_PATH} />
                  </svg>
                ))}
              </div>
              <blockquote className="kb-rev-quote">{rv.quote}</blockquote>
              <figcaption className="kb-rev-who">
                <b>{rv.author}</b>
                <span>Verified Google review</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
