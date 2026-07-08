'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { Broker } from '@/lib/data/types/broker'

/**
 * Mobile sticky contact bar — the always-reachable broker CTA on small screens,
 * replacing the retiring FUB floating widget. Fixed to the bottom of the
 * viewport, hidden on lg+ (the desktop sticky sidebar card carries it there).
 *
 * Slides up once the visitor scrolls past the hero so it never covers the first
 * paint, and routes the same as the desktop card: tel: / sms: the broker's
 * recorded Twilio line, and "Tour" to the pre-tagged contact form.
 *
 * Lenis runs in native mode here (html.lenis, no transform wrapper — see
 * SmoothScrollProvider), so position:fixed resolves to the viewport without a
 * portal, exactly like the fixed Kb topbar.
 */

export default function ListingMobileContactBar({
  broker,
  listingKey,
}: {
  broker: Broker
  listingKey: string
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
        <Image
          src={broker.headshotPng}
          alt={broker.fullName}
          width={40}
          height={40}
          className="shrink-0"
          style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: 'top' }}
        />
        <div className="listing-mobile-cta-name">
          <span className="lmc-eyebrow">Your broker</span>
          <span className="lmc-name">{firstName}</span>
        </div>
        <div className="listing-mobile-cta-actions">
          {tel ? (
            <a href={`tel:${tel}`} className="lmc-icon" aria-label={`Call ${firstName}`}>
              <PhoneIcon />
            </a>
          ) : null}
          {tel ? (
            <a href={`sms:${tel}`} className="lmc-icon" aria-label={`Text ${firstName}`}>
              <ChatIcon />
            </a>
          ) : null}
          <a href={tourHref} className="lmc-tour">
            Schedule a tour
          </a>
        </div>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
