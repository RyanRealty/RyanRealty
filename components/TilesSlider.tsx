'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

const SCROLL_THRESHOLD = 4

export type TilesSliderProps = {
  /** Section title (e.g. "Sales reports by city") */
  title?: string
  /** Optional subtitle/description below title */
  subtitle?: string
  /** Title id for aria-labelledby */
  titleId?: string
  /** Optional right-side content in header (e.g. "View All" link) */
  headerRight?: ReactNode
  children: ReactNode
  /** Optional class for the outer section */
  className?: string
}

/**
 * Single-row tile slider used site-wide for listings, communities, and report cards.
 * Navigation: left/right arrow overlays appear on mouse over the track (same as GeoSlider); wrap/infinite at end.
 * Never more than 3 cards visible: 1 on mobile, 2 on sm, 3 on lg+. Touch swipe on mobile.
 */
export default function TilesSlider({ title, subtitle, titleId, headerRight, children, className = '' }: TilesSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(true)

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setHasOverflow(maxScroll > SCROLL_THRESHOLD)
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    if (direction === 'right') {
      if (el.scrollLeft >= maxScroll - SCROLL_THRESHOLD) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' })
      }
    } else {
      if (el.scrollLeft <= SCROLL_THRESHOLD) {
        el.scrollTo({ left: maxScroll, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: -(el.clientWidth * 0.85), behavior: 'smooth' })
      }
    }
    setTimeout(updateScrollState, 350)
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  const hasHeader = !!(title ?? subtitle ?? headerRight)

  return (
    <section
      className={`group/tiles ${className}`}
      aria-labelledby={titleId ?? undefined}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {title && (
              <h2
                id={titleId}
                className="text-2xl text-primary sm:text-3xl"
              >
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className={`relative ${hasHeader ? 'mt-6' : ''}`}>
        <Button
          type="button"
          onClick={() => scroll('left')}
          disabled={!hasOverflow}
          className="absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-r from-black/40 to-transparent opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
          aria-label="Scroll left"
        >
          <span className="rounded-full bg-card/90 p-2 shadow-md">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5 text-foreground" />
          </span>
        </Button>
        <Button
          type="button"
          onClick={() => scroll('right')}
          disabled={!hasOverflow}
          className="absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-l from-black/40 to-transparent opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
          aria-label="Scroll right"
        >
          <span className="rounded-full bg-card/90 p-2 shadow-md">
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-foreground" />
          </span>
        </Button>
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground"
        >
          {children}
        </div>
      </div>
    </section>
  )
}

/**
 * Wrapper for each tile in TilesSlider. Max 3 visible site-wide:
 * - Phone: 1 visible (85vw, max 320px).
 * - sm: 2 visible (50vw, min 280px, max 360px).
 * - lg+: 3 visible (33.333vw, min 300px, max 420px).
 */
export function TilesSliderItem({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`shrink-0 scroll-snap-align-start w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px] ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
