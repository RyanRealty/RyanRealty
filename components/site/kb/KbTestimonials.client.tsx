'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { KbReview } from './types'

const GOOGLE_URL = 'https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR'

// One five-point star, drawn as a closed path so it can both draw (stroke) and
// illuminate (fill). Geometry sized inside a 24×24 box, point-up.
const STAR_PATH =
  'M12 1.6 L15.09 8.01 L22.06 8.86 L16.95 13.62 L18.27 20.51 L12 17.12 L5.73 20.51 L7.05 13.62 L1.94 8.86 L8.91 8.01 Z'

/**
 * KB Testimonials — the trust anchor, rebuilt as an asymmetric editorial plate
 * (no card grid): an oversized quote sits against a hard hairline frame, a
 * vertical mono index rail overlaps its top-left corner, and the reviewer names
 * read along a single hard-ruled ledger at the foot with a sliding active marker.
 *
 * Two things sit above each quote:
 *   1. An animated five-star rating — SVG stars that draw, illuminate, and catch
 *      a single cream sweep, re-firing whenever the active review changes.
 *   2. The quote itself, rendered verbatim inside curly quotes and attributed.
 *
 * Verified Google reviews are quoted verbatim with attribution, so the copy is
 * exempt from the Five Laws and is never altered.
 *
 * Behavior is unchanged from the prior build: reviews auto-cycle on a 6.5s timer,
 * pausing and switching on name hover/focus, with no auto-advance under
 * reduced-motion (WCAG 2.2.2). Props are unchanged: { reviews: KbReview[] }.
 */
export function KbTestimonials({ reviews }: { reviews: KbReview[] }) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const starRow = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-advance. No timer under reduced-motion (content that auto-updates must
  // be pausable — we simply never start it); hover still switches on demand.
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (paused || reduce || reviews.length < 2) return
    const t = setInterval(() => setActive((i) => (i + 1) % reviews.length), 6500)
    return () => clearInterval(t)
  }, [paused, reviews.length])

  // Crossfade the quote plate + run the star choreography on every active change.
  // Reduced-motion bails: the plate is fully opaque and the stars render static
  // (CSS gives them a filled state when .is-static is present).
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      if (stage.current && !reduce) {
        gsap.fromTo(
          stage.current,
          { opacity: 0.2, y: 10 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' },
        )
      }

      if (!starRow.current || reduce) return
      const stars = gsap.utils.toArray<SVGPathElement>('.kb-star-fill', starRow.current)
      const draws = gsap.utils.toArray<SVGPathElement>('.kb-star-stroke', starRow.current)
      const sweep = starRow.current.querySelector('.kb-star-sweep') as HTMLElement | null

      // 1. Draw the outline of each star left-to-right, then 2. illuminate the
      //    fill, staggered. 3. A single cream sweep travels across the whole row.
      const tl = gsap.timeline()
      draws.forEach((p) => {
        const len = p.getTotalLength()
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
      })
      gsap.set(stars, { opacity: 0, scale: 0.55, transformOrigin: '50% 55%' })

      tl.to(draws, { strokeDashoffset: 0, duration: 0.34, ease: 'power2.out', stagger: 0.08 })
        .to(
          stars,
          { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2.2)', stagger: 0.08 },
          '-=0.5',
        )
      if (sweep) {
        tl.fromTo(
          sweep,
          { xPercent: -130, opacity: 0 },
          { xPercent: 130, opacity: 1, duration: 0.72, ease: 'power2.inOut' },
          '-=0.34',
        ).to(sweep, { opacity: 0, duration: 0.22, ease: 'power1.out' }, '-=0.12')
      }
    }, root)
    return () => ctx.revert()
  }, [active])

  const r = reviews[active]
  if (!r) return null

  return (
    <section className="section proof kb-proof2" id="reviews" ref={root}>
      <div className="proof-scan" />
      <div className="wrap">
        <div className="proof-col">
          <div className="sec-head">
            <span className="sec-index">In their words</span>
            <h2 className="sec-title display">Testimonials</h2>
          </div>

          {/* Asymmetric quote plate: hairline frame, index rail overlapping the
              top-left corner, oversized verbatim quote. */}
          <div className="kb-proof2-plate">
            <span className="kb-proof2-rail" aria-hidden="true">
              <span className="kb-proof2-rail-idx mono-num">
                {String(active + 1).padStart(2, '0')}
              </span>
              <span className="kb-proof2-rail-line" />
              <span className="kb-proof2-rail-total mono-num">
                {String(reviews.length).padStart(2, '0')}
              </span>
            </span>

            <div className="kb-proof2-stage" ref={stage}>
              <div
                className="kb-stars"
                ref={starRow}
                role="img"
                aria-label="Five out of five stars"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="kb-star"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    aria-hidden="true"
                  >
                    <path className="kb-star-fill" d={STAR_PATH} />
                    <path className="kb-star-stroke" d={STAR_PATH} />
                  </svg>
                ))}
                <span className="kb-star-sweep" aria-hidden="true" />
              </div>

              <blockquote className="kb-proof2-quote">
                &ldquo;{r.quote}&rdquo;
              </blockquote>

              <figcaption className="kb-proof2-cite">
                <b>{r.author}</b>
                <span>Verified Google review</span>
              </figcaption>

              <a className="kb-proof2-google" href={GOOGLE_URL} target="_blank" rel="noopener">
                Read more on Google <span className="arr">→</span>
              </a>
            </div>
          </div>

          {/* Name ledger: one hard-ruled horizontal record, active marker slides
              under the live name. Drives the same active/pause behavior. */}
          <div className="kb-proof2-ledger" role="tablist" aria-label="Reviewers">
            {reviews.map((rv, i) => (
              <button
                key={rv.author + i}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`kb-proof2-tab${i === active ? ' active' : ''}`}
                onMouseEnter={() => {
                  setActive(i)
                  setPaused(true)
                }}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => {
                  setActive(i)
                  setPaused(true)
                }}
                onBlur={() => setPaused(false)}
                onClick={() => setActive(i)}
              >
                <span className="kb-proof2-tab-name">{rv.author}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
