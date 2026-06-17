'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { KbReview } from './types'

const GOOGLE_URL = 'https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR'

/**
 * KB Testimonials — the trust anchor. Verified Google reviews cycle on a timer
 * (pause on hover/select). Quotes are rendered verbatim and attributed; no
 * agency-authored copy is added (reviews are exempt from the Five Laws only
 * while quoted verbatim with attribution).
 */
export function KbTestimonials({ reviews }: { reviews: KbReview[] }) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // No auto-advance under reduced-motion (WCAG 2.2.2 — content that moves /
    // auto-updates must be pausable; we simply do not start the timer). Hover
    // still switches reviews on demand.
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (paused || reduce || reviews.length < 2) return
    const t = setInterval(() => setActive((i) => (i + 1) % reviews.length), 6500)
    return () => clearInterval(t)
  }, [paused, reviews.length])

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !stage.current) return
    gsap.fromTo(stage.current, { opacity: 0.25 }, { opacity: 1, duration: 0.55, ease: 'power2.out' })
  }, [active])

  const r = reviews[active]
  if (!r) return null

  return (
    <section className="section proof" id="reviews" ref={root}>
      <div className="proof-scan" />
      <div className="wrap">
        <div className="proof-col">
          <div className="sec-head">
            <span className="sec-index">In their words</span>
            <h2 className="sec-title display">Testimonials</h2>
          </div>
          <div className="proof-show">
            <div className="proof-stage" ref={stage}>
              <p className="ps-prose">&ldquo;{r.quote}&rdquo;</p>
              <div className="ps-cite">
                <b>{r.author}</b>
                <span>Verified Google review</span>
              </div>
              <a className="ps-google" href={GOOGLE_URL} target="_blank" rel="noopener">
                Read more on Google →
              </a>
            </div>
            <div className="proof-list">
              {reviews.map((rv, i) => (
                <button
                  key={rv.author + i}
                  type="button"
                  className={`pl-item${i === active ? ' active' : ''}`}
                  onMouseEnter={() => { setActive(i); setPaused(true) }}
                  onMouseLeave={() => setPaused(false)}
                  onFocus={() => { setActive(i); setPaused(true) }}
                  onBlur={() => setPaused(false)}
                  onClick={() => setActive(i)}
                >
                  <span className="pl-bar" />
                  <span className="pl-name">{rv.author}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
