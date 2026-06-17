'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull } from './types'

export interface KbActivityItem {
  /** Drives the kind-tag + its weight. Known kinds get a fixed label/intent;
   *  any other string renders its own `label` verbatim. */
  kind: 'new' | 'price_drop' | 'pending' | 'sold' | string
  /** Display label for the kind-tag (e.g. "NEW", "PRICE CUT"). */
  label: string
  address: string
  cityLine?: string
  price: number | null
  href?: string
  whenLabel?: string
}

/**
 * KB Activity — a live MLS activity feed. A brutalist ledger of the latest
 * market moves (new listings, price cuts, pendings, sales) rendered as hard
 * hairline rows, like a market ticker printed to the page rather than a card
 * grid. Each row carries a mono kind-tag, the address, the price in the
 * Amboqia display face, and a right-aligned mono time stamp. Color-coding
 * stays inside the navy/cream palette via weight and opacity, not off-brand
 * hues. Server-rendered from DAL data; renders null when there is no activity.
 */
export function KbActivity({
  items,
  eyebrow,
  heading,
  viewAllHref,
  viewAllLabel,
}: {
  items: KbActivityItem[]
  eyebrow: string
  heading: string
  viewAllHref?: string
  viewAllLabel?: string
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('.act-row')
      if (reduce) {
        gsap.set(rows, { opacity: 1, y: 0 })
        return
      }
      gsap.from(rows, {
        opacity: 0,
        y: 18,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.05,
        scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  if (!items || items.length === 0) return null

  // Map a kind to a tag-intent class. Intent only changes weight/opacity —
  // never an off-brand color. Unknown kinds fall back to the neutral tag.
  const intent = (kind: string): string => {
    switch (kind) {
      case 'new':
        return 'is-new'
      case 'price_drop':
        return 'is-cut'
      case 'pending':
        return 'is-pending'
      case 'sold':
        return 'is-sold'
      default:
        return 'is-new'
    }
  }

  return (
    <section className="section activity" id="activity" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{heading}</h2>
        </div>

        <div className="act-chrome">
          <span className="mkt-live">
            <span className="dot" />
            <span className="txt">Live · MLS</span>
          </span>
          <span className="act-count mono-num">
            {items.length.toLocaleString('en-US')} updates
          </span>
        </div>

        <div className="act-ledger" role="list">
          {items.map((it, i) => {
            const money = kbMoneyFull(it.price)
            const Row = it.href ? 'a' : 'div'
            return (
              <Row
                key={`${it.address}-${i}`}
                className="act-row"
                role="listitem"
                {...(it.href ? { href: it.href } : {})}
              >
                <span className={`act-tag ${intent(it.kind)}`}>{it.label}</span>
                <span className="act-place">
                  <span className="act-addr">{it.address}</span>
                  {it.cityLine ? <span className="act-city">{it.cityLine}</span> : null}
                </span>
                <span className="act-price display mono-num">{money ?? '—'}</span>
                {it.whenLabel ? (
                  <span className="act-when mono-num">{it.whenLabel}</span>
                ) : (
                  <span className="act-when" aria-hidden="true" />
                )}
              </Row>
            )
          })}
        </div>

        {viewAllHref ? (
          <div className="sec-cta">
            <a href={viewAllHref} className="btn ghost">
              {viewAllLabel ?? 'See all activity'} <span className="arr">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
