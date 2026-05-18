'use client'

/**
 * Horizontal-scroll carousel for the Tetherow sub-neighborhoods. Snap-points,
 * prev/next arrows, scroll-progress bar, "1 OF N" position hint, keyboard
 * navigation, and an edge fade indicator on the right. Ports the inline
 * .subnbh-scroller script from public/lp/tetherow/index.html.
 *
 * Cards link to /lp/tetherow/<sub>/ when an inner page exists (currently only
 * Heath); the rest anchor to #cma. Card content is server-rendered as a
 * `<TetherowScroller.Card>` so we keep the layout SSR-friendly.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type ScrollerCard = {
  slug: string
  name: string
  type: string
  duesLine: string
  imageUrl: string
  hasInnerPage: boolean
}

export function TetherowScroller({ cards }: { cards: ScrollerCard[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [progressPct, setProgressPct] = useState(0)
  const [position, setPosition] = useState(1)
  const [atEnd, setAtEnd] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const total = cards.length

  const recompute = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const scrollLeft = el.scrollLeft
    const maxScroll = el.scrollWidth - el.clientWidth
    const pct = maxScroll > 0 ? Math.min(100, Math.round((scrollLeft / maxScroll) * 100)) : 0
    setProgressPct(pct)
    setAtEnd(pct >= 99)
    setCanScrollLeft(scrollLeft > 8)
    setCanScrollRight(maxScroll - scrollLeft > 8)
    // Position hint — derive from the first card whose left edge is past the
    // viewport's left edge.
    const cardEls = el.querySelectorAll<HTMLElement>('[data-snbh-card]')
    const viewportLeft = scrollLeft
    let idx = 1
    cardEls.forEach((card, i) => {
      if (card.offsetLeft - el.offsetLeft <= viewportLeft + 4) {
        idx = i + 1
      }
    })
    setPosition(idx)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    recompute()
    el.addEventListener('scroll', recompute, { passive: true })
    window.addEventListener('resize', recompute)
    return () => {
      el.removeEventListener('scroll', recompute)
      window.removeEventListener('resize', recompute)
    }
  }, [recompute])

  const handleScroll = (dir: 'prev' | 'next') => {
    const el = scrollerRef.current
    if (!el) return
    const cardWidth = 280 + 16 // card + gap
    el.scrollBy({ left: dir === 'next' ? cardWidth : -cardWidth, behavior: 'smooth' })
  }

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleScroll('next')
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handleScroll('prev')
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', !atEnd && 'subnbh-scroller-wrap-fade')}>
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Tetherow sub-neighborhoods"
        tabIndex={0}
        onKeyDown={handleKey}
        className="flex gap-4 overflow-x-auto overflow-y-visible scroll-smooth pb-6 pt-2 -mx-6 px-6 [scroll-snap-type:x_mandatory] [scrollbar-color:rgba(16,39,66,0.12)_transparent] [-webkit-overflow-scrolling:touch]"
        style={{ scrollbarWidth: 'thin' }}
      >
        {cards.map((c) => {
          const inner = (
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 text-[color:var(--rr-cream)]">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
                {c.type}
              </div>
              <div
                className="mb-2 font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.012em]"
                style={{ fontFamily: 'var(--rr-font-display)' }}
              >
                {c.name}
              </div>
              <div className="text-[13.5px] font-medium leading-[1.4] opacity-95">{c.duesLine}</div>
            </div>
          )
          const baseClass =
            "relative aspect-[4/5] w-[280px] shrink-0 overflow-hidden rounded-[14px] bg-[color:var(--rr-navy)] bg-cover bg-center shadow-[0_1px_2px_rgba(16,39,66,0.04),0_4px_12px_rgba(16,39,66,0.06)] transition-transform duration-300 hover:-translate-y-[3px] hover:shadow-[0_1px_2px_rgba(16,39,66,0.06),0_8px_24px_rgba(16,39,66,0.1)] [scroll-snap-align:start] [scroll-snap-stop:always] before:absolute before:inset-0 before:bg-[linear-gradient(to_top,rgba(16,39,66,0.94)_0%,rgba(16,39,66,0.55)_50%,rgba(16,39,66,0.1)_100%)]"
          const style = { backgroundImage: `url('${c.imageUrl}')` }
          if (c.hasInnerPage) {
            return (
              <Link
                key={c.slug}
                href={`/lp/tetherow/${c.slug}/`}
                className={baseClass}
                style={style}
                data-snbh-card={c.slug}
              >
                {inner}
              </Link>
            )
          }
          return (
            <a
              key={c.slug}
              href="#cma"
              className={baseClass}
              style={style}
              data-snbh-card={c.slug}
              title="(coming soon)"
            >
              {inner}
            </a>
          )
        })}
      </div>
      {/* Edge fade indicator */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-0 top-0 bottom-6 z-[2] w-[60px]',
          atEnd && 'opacity-0 transition-opacity duration-200'
        )}
        style={{
          background: 'linear-gradient(to right, transparent, var(--rr-cream) 90%)',
        }}
      />
      {/* Nav controls */}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => handleScroll('prev')}
          disabled={!canScrollLeft}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(16,39,66,0.08)] bg-white text-lg text-[color:var(--rr-navy)] shadow-[0_1px_2px_rgba(16,39,66,0.04),0_4px_12px_rgba(16,39,66,0.06)] transition hover:border-[color:var(--rr-navy)] hover:bg-[color:var(--rr-navy)] hover:text-[color:var(--rr-cream)] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-35"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => handleScroll('next')}
          disabled={!canScrollRight}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(16,39,66,0.08)] bg-white text-lg text-[color:var(--rr-navy)] shadow-[0_1px_2px_rgba(16,39,66,0.04),0_4px_12px_rgba(16,39,66,0.06)] transition hover:border-[color:var(--rr-navy)] hover:bg-[color:var(--rr-navy)] hover:text-[color:var(--rr-cream)] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-35"
        >
          ›
        </button>
        <div
          aria-hidden
          className="h-[3px] flex-1 overflow-hidden rounded-[4px] bg-[rgba(16,39,66,0.08)]"
        >
          <div
            className="h-full bg-[color:var(--rr-navy)] transition-[width] duration-200 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-[11px] font-semibold tracking-wider text-[color:var(--rr-muted)]">
          {position} OF {total}
        </span>
      </div>
    </div>
  )
}

export default TetherowScroller
