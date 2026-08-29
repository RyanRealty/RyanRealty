'use client'

import { useEffect, useRef, useState } from 'react'
import type { Broker } from '@/lib/data/types/broker'
import type { ListingFace } from '@/lib/listing/listing-face'

/**
 * Mobile sticky bar: Schedule a tour and Call at 44px. Hidden from lg up.
 * Compact broker identity lives at the top of the Sheet.
 * Publishes --listing-sticky-height so the cookie bar sits above this row
 * and does not cover Schedule or Call.
 */

export default function ListingMobileContactBar({
  broker,
  listingKey,
  face = 'house',
}: {
  broker: Broker
  listingKey: string
  face?: ListingFace
}) {
  const [shown, setShown] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 360)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (!shown) {
      delete root.dataset.listingSticky
      root.style.removeProperty('--listing-sticky-height')
      return
    }
    root.dataset.listingSticky = 'true'
    const el = barRef.current
    const publishHeight = () => {
      if (!el) return
      root.style.setProperty('--listing-sticky-height', `${el.offsetHeight}px`)
    }
    publishHeight()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publishHeight)
    if (el && observer) observer.observe(el)
    return () => {
      observer?.disconnect()
      delete root.dataset.listingSticky
      root.style.removeProperty('--listing-sticky-height')
    }
  }, [shown])

  const phone = broker.phoneDirect ?? broker.phoneFub ?? null
  const tel = phone ? phone.replace(/[^\d]/g, '') : null
  const firstName = broker.fullName.split(/\s+/)[0]
  const tourHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=tour`

  return (
    <div
      ref={barRef}
      className="listing-mobile-cta"
      data-shown={shown ? 'true' : 'false'}
      data-listing-sticky={shown ? 'true' : 'false'}
      aria-hidden={!shown}
    >
      <div className="listing-mobile-cta-inner">
        <div className="listing-mobile-cta-actions">
          <a href={tourHref} className="lmc-tour">
            {face === 'land' ? 'Schedule' : 'Schedule a tour'}
          </a>
          {tel ? (
            <a href={`tel:${tel}`} className="lmc-call" aria-label={`Call ${firstName}`}>
              Call
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
