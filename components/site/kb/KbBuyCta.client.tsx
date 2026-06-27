'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * KB Buyer CTA — lightweight buyer conversion block for community pages.
 *
 * Surfaces two buyer paths:
 *   1. Browse active listings in this community (homesForSalePath URL)
 *   2. Contact to schedule a showing / ask questions
 *
 * Designed to sit before KbSell so buyers land on a relevant CTA before
 * the seller valuation section. Reuses KB CSS design tokens (navy/cream,
 * hard borders, .btn). No new backend — both actions are plain href links.
 *
 * KB design register: cream background, navy text (mirrors KbSell contrast
 * swap so the two sections read as one paired dual-audience block).
 */
export function KbBuyCta({
  communityName,
  listingsHref,
  contactHref,
}: {
  communityName: string
  /** Pre-built /homes-for-sale/[city]/[subdivision] URL for this community. */
  listingsHref: string
  /** Contact path — typically /contact with an inquiry param. */
  contactHref: string
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      if (reduce) return
      gsap.from('.buy-cta-copy > *', {
        opacity: 0,
        y: 18,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="section buy-cta" id="buy" ref={root} aria-label={`Buy in ${communityName}`}>
      <div className="buy-cta-copy">
        <span className="sec-index">For buyers</span>
        <h2 className="buy-cta-h display">
          Ready to see
          <br />
          {communityName}?
        </h2>
        <p className="buy-cta-p">
          Browse every active listing in {communityName} or reach out to schedule a showing. A direct line to the broker handling these homes.
        </p>
        <div className="buy-cta-btns">
          <a href={listingsHref} className="btn" aria-label={`See all homes for sale in ${communityName}`}>
            See {communityName} homes <span className="arr" aria-hidden="true">→</span>
          </a>
          <a href={contactHref} className="btn ghost" aria-label={`Request info on ${communityName}`}>
            Request info
          </a>
        </div>
      </div>
    </section>
  )
}
