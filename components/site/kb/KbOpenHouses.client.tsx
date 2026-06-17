'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export interface KbOpenHouseItem {
  href: string
  photoUrl: string | null
  price: number | null
  address: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Pre-formatted human date/time, e.g. "Sat 11am-1pm". */
  whenLabel: string
}

/**
 * Price to the nearest thousand. Sub-million rounds to a "$895K" short form,
 * a million and up renders in full with commas ("$1,250,000"). Returns null
 * when there is no usable number so the chip simply renders the date instead.
 */
function ohMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  const k = Math.round(n / 1000)
  if (k >= 1000) return `$${(k * 1000).toLocaleString('en-US')}`
  return `$${k}K`
}

/**
 * KB Open Houses — upcoming open houses on a navy brutalist board. Each card is
 * the listing photo with a hard navy date/time chip (the whenLabel) stamped
 * top-left, the price in Amboqia, the address + city line, and bd/ba/sf specs in
 * mono. The whole card links to the listing. Reuses the listing-tile markup
 * (.lst-card family) so it stays visually locked to Featured homes. Server-safe
 * data in, scroll-reveal only on the client; renders null when there is nothing
 * on the calendar.
 */
export function KbOpenHouses({
  items,
  eyebrow,
  heading,
  viewAllHref,
}: {
  items: KbOpenHouseItem[]
  eyebrow: string
  heading: string
  viewAllHref?: string
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.lst-card')
      if (reduce) {
        gsap.set(cards, { opacity: 1, y: 0 })
        return
      }
      gsap.from(cards, {
        opacity: 0,
        y: 26,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  if (items.length === 0) return null

  return (
    <section className="section openhouses" id="open-houses" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{heading}</h2>
        </div>
        <div className="oh-grid">
          {items.map((it) => {
            const price = ohMoney(it.price)
            return (
              <a key={it.href} className="lst-card" href={it.href}>
                <div className="lst-media">
                  {it.photoUrl ? (
                    <img className="lst-img" src={it.photoUrl} alt={it.address} loading="lazy" />
                  ) : null}
                  <span className="lst-badge oh">
                    <span className="oh-dot" aria-hidden="true" />
                    {it.whenLabel}
                  </span>
                </div>
                <div className="lst-info">
                  <div>
                    {price ? <div className="lst-price mono-num">{price}</div> : null}
                    <div className="lst-addr">
                      {it.address}
                      <span className="sub">{it.cityLine}</span>
                    </div>
                  </div>
                  <div className="lst-specs">
                    {it.beds != null ? <span className="mono-num">{it.beds} bd</span> : null}
                    {it.baths != null ? <span className="mono-num">{it.baths} ba</span> : null}
                    {it.sqft ? (
                      <span className="mono-num">{Number(it.sqft).toLocaleString('en-US')} sf</span>
                    ) : null}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
        {viewAllHref ? (
          <div className="lst-foot">
            <a href={viewAllHref} className="btn ghost">
              All open houses <span className="arr">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
