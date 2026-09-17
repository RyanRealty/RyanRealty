'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCROLL_THRESHOLD = 4

export function ChipRail({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = railRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanLeft(max > SCROLL_THRESHOLD && el.scrollLeft > SCROLL_THRESHOLD)
    setCanRight(max > SCROLL_THRESHOLD && el.scrollLeft < max - SCROLL_THRESHOLD)
  }, [])

  function scroll(direction: 'left' | 'right') {
    const el = railRef.current
    if (!el) return
    el.scrollBy({
      left: direction === 'right' ? el.clientWidth * 0.7 : -(el.clientWidth * 0.7),
      behavior: 'smooth',
    })
    window.setTimeout(update, 280)
  }

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const raf = requestAnimationFrame(update)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [children, update])

  return (
    <div className={cn('srch-chip-rail-wrap relative min-w-0', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll('left')}
        disabled={!canLeft}
        aria-label="Show earlier filters"
        className="srch-chip-rail__arrow srch-chip-rail__arrow--left"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
      </Button>
      <div
        ref={railRef}
        onScroll={update}
        data-srch-chip-rail=""
        className="srch-chip-rail flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar"
      >
        {children}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll('right')}
        disabled={!canRight}
        aria-label="Show more filters"
        className="srch-chip-rail__arrow srch-chip-rail__arrow--right"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
      </Button>
    </div>
  )
}
