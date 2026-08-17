'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbTownItem } from './types'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'

/**
 * KB Explore ledger (01) — the page leads with place. Editorial row-list; each
 * row with an image shows that photograph at rest (navy scrim + cream type).
 * Live per-row active count + median. The homepage uses it for the six cities;
 * a city page reuses it (props, no fork) for its NEIGHBORHOODS ledger, its
 * golf/master-planned COMMUNITIES ledger, and the "Explore other cities"
 * nearby list. Renders null when empty.
 */
export function KbExploreTowns({
  towns,
  eyebrow,
  title,
  sectionId = 'towns',
  notes,
  // "See homes for sale" is the one verb pair for every /homes-for-sale CTA on a
  // page (design-audit P3: six different labels read as six different destinations).
  cta = { href: publishRegionalSearchHref(), label: 'See homes for sale' },
}: {
  towns: KbTownItem[]
  /** Required: a placeholder default here shipped a naked-verb heading for months (C-07). */
  eyebrow: string
  title: string
  sectionId?: string
  /** Optional remainder facts when the list is a subset of a region pulse. */
  notes?: string[]
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
                {t.activeCount != null && t.activeCount >= 0 ? (
                  <span className="town-count mono-num">
                    {t.activeCount.toLocaleString('en-US')}
                    <span className="lbl">Active</span>
                  </span>
                ) : null}
                {kbMoneyFull(t.medianPrice) ? (
                  <span className="town-price mono-num">{kbMoneyFull(t.medianPrice)} median</span>
                ) : null}
              </span>
              <span className="town-arr" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
        {notes && notes.length > 0 ? (
          <div className="towns-remainder">
            {notes.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
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
