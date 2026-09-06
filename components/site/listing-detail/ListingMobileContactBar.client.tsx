'use client'

import type { Broker } from '@/lib/data/types/broker'

/**
 * Mobile sticky contact bar — always visible at 390. Tour | Call | Text.
 * Cookies must not hide this (PAGE_INVENTORY ask). Desktop uses the sidebar.
 */

export default function ListingMobileContactBar({
  broker,
  listingKey,
}: {
  broker: Broker
  listingKey: string
}) {
  const phone = broker.phoneDirect ?? broker.phoneFub ?? null
  const tel = phone ? phone.replace(/[^\d]/g, '') : null
  const firstName = broker.fullName.split(/\s+/)[0]
  const tourHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=tour`

  return (
    <div className="listing-mobile-cta" data-shown="true">
      <div className="listing-mobile-cta-inner">
        <div className="listing-mobile-cta-actions">
          <a href={tourHref} className="lmc-tour">
            Tour
          </a>
          {tel ? (
            <a href={`tel:${tel}`} className="lmc-icon" aria-label={`Call ${firstName}`}>
              Call
            </a>
          ) : null}
          {tel ? (
            <a href={`sms:${tel}`} className="lmc-icon" aria-label={`Text ${firstName}`}>
              Text
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
