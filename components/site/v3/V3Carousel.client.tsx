'use client'

/**
 * v3 CAROUSEL — swipeable slides with prev/next.
 *
 * Adapted from the shadcn carousel job (ui.shadcn.com/docs/components/carousel)
 * and beUI shared-layout motion: one track, snap, navy controls, no 3D
 * cylinder, no glare. Public paint stays tokens.css. Embla is the engine
 * (already in package.json); this file is the v3 primitive, not a second kit.
 *
 * Controlled `index` so a listing filmstrip thumb can drive the same frame.
 */
import useEmblaCarousel from 'embla-carousel-react'
import { Children, useCallback, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Carousel.css'

export type V3CarouselProps = {
  /** Accessible name for the region, e.g. "Photos of 909 NW Delaware". */
  label: string
  /** Controlled snap index. Uncontrolled when omitted. */
  index?: number
  onIndexChange?: (index: number) => void
  /**
   * `page` = one slide fills the viewport (listing filmstrip).
   * `rail` = peeking house cards (homepage inventory carousels).
   */
  mode?: 'page' | 'rail'
  children: ReactNode
  className?: string
}

export function V3Carousel({
  label,
  index,
  onIndexChange,
  mode = 'page',
  children,
  className,
}: V3CarouselProps) {
  const labelId = useId()
  const count = Children.count(children)
  const [prefersReduce, setPrefersReduce] = useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    duration: prefersReduce ? 0 : 20,
    watchDrag: count > 1,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setPrefersReduce(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const emit = useCallback(() => {
    if (!emblaApi) return
    onIndexChange?.(emblaApi.selectedScrollSnap())
  }, [emblaApi, onIndexChange])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', emit)
    emblaApi.on('reInit', emit)
    return () => {
      emblaApi.off('select', emit)
      emblaApi.off('reInit', emit)
    }
  }, [emblaApi, emit])

  useEffect(() => {
    if (!emblaApi || index == null) return
    if (emblaApi.selectedScrollSnap() === index) return
    emblaApi.scrollTo(index, prefersReduce)
  }, [emblaApi, index, prefersReduce])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!emblaApi) return
      if (dir < 0) emblaApi.scrollPrev(prefersReduce)
      else emblaApi.scrollNext(prefersReduce)
    },
    [emblaApi, prefersReduce],
  )

  return (
    <div
      className={cn(
        V3_ROOT_CLASS,
        'v3-carousel',
        mode === 'rail' && 'v3-carousel--rail',
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
    >
      <p id={labelId} className="v3-carousel__label">
        {label}
      </p>
      <div className="v3-carousel__viewport" ref={emblaRef}>
        <div className="v3-carousel__track">
          {Children.map(children, (child, i) => (
            <div
              className="v3-carousel__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${count}`}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <div className="v3-carousel__nav">
          <button type="button" className="v3-carousel__step" aria-label="Previous slide" onClick={() => go(-1)}>
            Previous
          </button>
          <button type="button" className="v3-carousel__step" aria-label="Next slide" onClick={() => go(1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
