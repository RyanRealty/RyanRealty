'use client'

import { useEffect, useState } from 'react'
import type { Broker } from '@/lib/data/types/broker'
import type { ListingFace } from '@/lib/listing/listing-face'

/**
 * Mobile sticky bar: Schedule a tour and Call at 44px. Hidden from lg up.
 * Compact broker identity lives at the top of the Sheet.
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

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 360)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const phone = broker.phoneDirect ?? broker.phoneFub ?? null
  const tel = phone ? phone.replace(/[^\d]/g, '') : null
  const firstName = broker.fullName.split(/\s+/)[0]
  const tourHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=tour`

  return (
    <div className="listing-mobile-cta" data-shown={shown ? 'true' : 'false'} aria-hidden={!shown}>
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
