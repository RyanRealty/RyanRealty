'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

export type GeoSliderProps = {
  /** Section title (optional, e.g. for listings slider below hero) */
  title?: string
  /** Optional subtitle below title */
  subtitle?: string
  titleId?: string
  /** Optional right-side content in header (e.g. "View all" link) */
  headerRight?: ReactNode
  children: ReactNode
  className?: string
  /** When true, arrows appear on hover over the left/right edges of the track (desktop). Default true. */
  hoverArrows?: boolean
  /** When true, title/subtitle are for screen readers only (sr-only). */
  titleSrOnly?: boolean
}

const SCROLL_THRESHOLD = 4

/**
 * Single-row slider for geo pages (city communities bar, community/neighborhood listings).
 * - Same card dimensions as TilesSlider (TilesSliderItem): 1 visible mobile, 2 sm, 3 lg+.
 * - Mobile: touch swipe (scroll-snap).
 * - Desktop: left/right arrow overlays appear on mouse over the track; click scrolls or wraps (infinite loop).
 */
export default function GeoSlider({
  title,
  subtitle,
  titleId,
  headerRight,
  children,
  className = '',
  hoverArrows = true,
  titleSrOnly = false,
}: GeoSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [hasOverflow, setHasOverflow] = useState(true)

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setHasOverflow(maxScroll > SCROLL_THRESHOLD)
    setCanScrollLeft(el.scrollLeft > SCROLL_THRESHOLD)
    setCanScrollRight(el.scrollLeft < maxScroll - SCROLL_THRESHOLD)
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
    const t = setTimeout(updateScrollState, 150)
    const t2 = setTimeout(updateScrollState, 500)
    return () => {
      ro.disconnect()
      clearTimeout(t)
      clearTimeout(t2)
    }
  }, [children])

  const hasHeader = !!(title ?? subtitle ?? headerRight)

  return (
    <section
      className={`group/geo ${className}`}
      aria-labelledby={titleId ?? undefined}
    >
      {hasHeader && (
        <div className={titleSrOnly ? 'sr-only' : 'flex flex-wrap items-end justify-between gap-4'}>
          <div>
            {title && (
              <h2
                id={titleId}
                className={titleSrOnly ? '' : 'text-2xl font-bold text-primary sm:text-3xl'}
              >
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className={`relative group/slider ${hasHeader ? 'mt-6' : ''}`}>
        {hoverArrows && (
          <>
            <Button
              type="button"
              onClick={() => scroll('left')}
              disabled={!hasOverflow}
              className="absolute left-0 top-0 z-10 flex h-full w-14 items-center justify-center bg-gradient-to-r from-black/30 to-transparent opacity-0 transition-opacity group-hover/slider:opacity-100 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
              aria-label="Scroll left"
            >
              <span className="rounded-full bg-card/90 p-2 shadow-md">
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5 text-primary" />
              </span>
            </Button>
            <Button
              type="button"
              onClick={() => scroll('right')}
              disabled={!hasOverflow}
              className="absolute right-0 top-0 z-10 flex h-full w-14 items-center justify-center bg-gradient-to-l from-black/30 to-transparent opacity-0 transition-opacity group-hover/slider:opacity-100 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
              aria-label="Scroll right"
            >
              <span className="rounded-full bg-card/90 p-2 shadow-md">
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-primary" />
              </span>
            </Button>
          </>
        )}
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
 * Same dimensions as TilesSliderItem for consistent card size across geo sliders.
 */
export function GeoSliderItem({
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
