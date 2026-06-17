'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbTownItem } from './types'

/**
 * KB Explore / Towns (01) — the page leads with place. Editorial row-list of
 * the six service towns; hover reveals a full-bleed town photo. Live per-town
 * active count + median list. Each row routes to /cities/[slug].
 */
export function KbExploreTowns({ towns }: { towns: KbTownItem[] }) {
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

  return (
    <section className="section towns" id="towns" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">01 / Explore</span>
          <h2 className="sec-title display">Explore</h2>
        </div>
        <div className="towns-grid">
          {towns.map((t) => (
            <a key={t.href} className="town-row" href={t.href} data-town>
              <div className="town-fill" style={{ backgroundImage: `url('${t.img}')` }} />
              <span className="town-name">{t.name}</span>
              <span className="town-stats">
                <span className="town-count mono-num">
                  {t.activeCount.toLocaleString('en-US')}
                  <span className="lbl">Active</span>
                </span>
                {kbMoneyFull(t.medianPrice) ? (
                  <span className="town-price mono-num">{kbMoneyFull(t.medianPrice)} median</span>
                ) : null}
              </span>
            </a>
          ))}
        </div>
        <div className="sec-cta">
          <a href="/homes-for-sale" className="btn alt">
            Search homes in every town <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
