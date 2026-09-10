'use client'

/**
 * v3 CAROUSEL — swipeable slides with prev/next.
 *
 * Wraps the installed shadcn carousel (`components/ui/carousel.tsx`): one
 * track, snap, navy controls, no 3D cylinder. Public paint stays tokens.css.
 */
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { Children, useEffect, useId, useState } from 'react'
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
  const [api, setApi] = useState<CarouselApi>()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setPrefersReduce(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!api) return
    const emit = () => onIndexChange?.(api.selectedScrollSnap())
    api.on('select', emit)
    api.on('reInit', emit)
    return () => {
      api.off('select', emit)
      api.off('reInit', emit)
    }
  }, [api, onIndexChange])

  useEffect(() => {
    if (!api || index == null) return
    if (api.selectedScrollSnap() === index) return
    api.scrollTo(index, prefersReduce)
  }, [api, index, prefersReduce])

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: 'start',
        containScroll: 'trimSnaps',
        duration: prefersReduce ? 0 : 20,
        watchDrag: count > 1,
      }}
      className={cn(
        V3_ROOT_CLASS,
        'v3-carousel',
        mode === 'rail' && 'v3-carousel--rail',
        className,
      )}
      aria-labelledby={labelId}
    >
      <p id={labelId} className="v3-carousel__label">
        {label}
      </p>
      <CarouselContent className="v3-carousel__track ml-0">
        {Children.map(children, (child, i) => (
          <CarouselItem
            className={cn('v3-carousel__slide pl-0', mode === 'rail' && 'v3-carousel__slide--rail')}
            aria-label={`Slide ${i + 1} of ${count}`}
          >
            {child}
          </CarouselItem>
        ))}
      </CarouselContent>
      {count > 1 ? (
        <div className="v3-carousel__nav">
          <CarouselPrevious className="v3-carousel__step static size-auto translate-x-0 translate-y-0" />
          <CarouselNext className="v3-carousel__step static size-auto translate-x-0 translate-y-0" />
        </div>
      ) : null}
    </Carousel>
  )
}
