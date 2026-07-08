'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbTownItem } from './types'

/**
 * KB Explore ledger (01) — the page leads with place. Editorial row-list; hover
 * reveals a full-bleed photo (when an item has one). Live per-row active count +
 * median. The homepage uses it for the six cities; a city page reuses it (props,
 * no fork) for its NEIGHBORHOODS ledger, its golf/master-planned COMMUNITIES
 * ledger, and the "Explore other cities" nearby list. Renders null when empty.
 */
export function KbExploreTowns({
  towns,
  eyebrow = 'Explore',
  title = 'Explore',
  sectionId = 'towns',
  // "Browse homes" is the one verb pair for every /homes-for-sale CTA on a page
  // (design-audit P3: six different labels read as six different destinations).
  cta = { href: '/homes-for-sale', label: 'Browse homes' },
}: {
  towns: KbTownItem[]
  eyebrow?: string
  title?: string
  sectionId?: string
  cta?: { href: string; label: string } | null
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('.town-row')
      if (reduce) {
        gsap.set(rows, { opacity: 1, y: 0 })
        return
      }
      gsap.from(rows, {
        opacity: 0,
        y: 28,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: root.current, start: 'top 75%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  if (towns.length === 0) return null

  return (
    <section className="section towns" id={sectionId} ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{title}</h2>
        </div>
        <div className="towns-grid">
          {towns.map((t) => (
            <a key={t.href} className="town-row" href={t.href} data-town>
              {t.img ? <div className="town-fill" style={{ backgroundImage: `url('${t.img}')` }} /> : null}
              <span className="town-name">{t.name}</span>
              <span className="town-stats">
                {/* 0 renders as "0 Active" — hiding the ledger left a bare town
                    name beside fully-populated rows (looked broken; design-audit). */}
                {t.activeCount >= 0 ? (
                  <span className="town-count mono-num">
                    {t.activeCount.toLocaleString('en-US')}
                    <span className="lbl">Active</span>
                  </span>
                ) : null}
                {kbMoneyFull(t.medianPrice) ? (
                  <span className="town-price mono-num">{kbMoneyFull(t.medianPrice)} median</span>
                ) : null}
              </span>
              {/* Persistent affordance for touch devices — the hover-only photo
                  reveal left phone rows reading as a static stats table
                  (design-audit P2). Shown via CSS on hover:none only. */}
              <span className="town-arr" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
        {cta ? (
          <div className="sec-cta">
            <a href={cta.href} className="btn alt">
              {cta.label} <span className="arr">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
