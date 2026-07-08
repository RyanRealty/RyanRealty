'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { KbTickerItem } from './types'

function price(n: number | null): string {
  return n ? `$${Math.round(n).toLocaleString('en-US')}` : ''
}

/**
 * KB ticker — a live tape of real listings scrolling between sections.
 * Reinforces "real inventory, right now" with zero claim. Pauses on hover;
 * static under prefers-reduced-motion.
 */
export function KbTicker({ items }: { items: KbTickerItem[] }) {
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!track.current || items.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const tw = gsap.to(track.current, {
      xPercent: -50,
      duration: Math.max(18, items.length * 4),
      ease: 'none',
      repeat: -1,
    })
    const el = track.current
    const enter = () => tw.pause()
    const leave = () => tw.resume()
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    // Keyboard users tabbing into a linked tape item get a stationary target.
    el.addEventListener('focusin', enter)
    el.addEventListener('focusout', leave)
    return () => {
      tw.kill()
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
      el.removeEventListener('focusin', enter)
      el.removeEventListener('focusout', leave)
    }
  }, [items.length])

  if (items.length === 0) return null
  const doubled = [...items, ...items]

  return (
    // Not aria-hidden as a band: the tape carries real listings, and linked
    // items must be reachable. Only the seamless-loop DUPLICATE half is hidden
    // from the accessibility tree (design-audit P3).
    <div className="ticker dark">
      <div className="ticker-track" ref={track}>
        {doubled.map((it, i) => {
          const isDup = i >= items.length
          const body = (
            <>
              <span className="ticker-price">{price(it.price)}</span>
              <span className="ticker-meta">
                {it.address} <span className="town">/ {it.town}</span>
              </span>
              <span className="ticker-star">✶</span>
            </>
          )
          return it.href ? (
            <a
              className="ticker-item"
              key={i}
              href={it.href}
              aria-hidden={isDup || undefined}
              tabIndex={isDup ? -1 : undefined}
            >
              {body}
            </a>
          ) : (
            <div className="ticker-item" key={i} aria-hidden={isDup || undefined}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
