'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { V3Button, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import './city-snap.css'

const THRESHOLD = 4

export function CitySnapRail({
  id,
  headline,
  ariaLabel,
  items,
  source,
  variant = 'homes',
}: {
  id: string
  headline: V3Text
  ariaLabel: string
  items: readonly V3FieldItem[]
  source: string
  variant?: 'homes' | 'sold' | 'places'
}) {
  const photos = items.filter((item) => item.photoSrc?.trim())
  const trackRef = useRef<HTMLDivElement>(null)
  const [prevOn, setPrevOn] = useState(false)
  const [nextOn, setNextOn] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setPrevOn(max > THRESHOLD && el.scrollLeft > THRESHOLD)
    setNextOn(max > THRESHOLD && el.scrollLeft < max - THRESHOLD)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    const raf = requestAnimationFrame(update)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
      cancelAnimationFrame(raf)
    }
  }, [photos, update])

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (photos.length === 0) return null

  return (
    <section id={id} aria-label={ariaLabel} className={cn('v3', 'city-snap', variant === 'sold' && 'city-snap--sold')}>
      <V3Heading level={2} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>
      <div className="city-snap__track no-scrollbar" ref={trackRef}>
        {photos.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn('city-snap__card', variant === 'homes' && index === 0 && 'city-snap__card--lead')}
            aria-label={item.meta ? `${item.priceLabel}, ${item.meta}, ${item.title}` : `${item.priceLabel}, ${item.title}`}
          >
            <img src={item.photoSrc} alt="" width={index === 0 ? 1280 : 640} height={index === 0 ? 720 : 400} loading={index < 3 ? 'eager' : 'lazy'} />
            <span className="city-snap__cap">
              <span className="city-snap__price">{item.priceLabel}</span>
              {item.meta ? <span className="city-snap__meta">{item.meta}</span> : null}
              <span className="city-snap__title">{item.title}</span>
            </span>
          </Link>
        ))}
      </div>
      {prevOn ? (
        <span className="city-snap__arrow city-snap__arrow--prev">
          <V3Button variant="ghost" ariaLabel="Previous" onClick={() => scrollBy(-1)}>
            Prev
          </V3Button>
        </span>
      ) : null}
      {nextOn ? (
        <span className="city-snap__arrow city-snap__arrow--next">
          <V3Button variant="ghost" ariaLabel="Next" onClick={() => scrollBy(1)}>
            Next
          </V3Button>
        </span>
      ) : null}
      <V3SourceLine source={source} />
    </section>
  )
}
