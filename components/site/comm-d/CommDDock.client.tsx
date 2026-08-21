'use client'

import Link from 'next/link'
import { CONTACT } from '@/lib/brand/contact'

export function CommDDock({
  rating,
  reviewCount,
}: {
  rating: number
  reviewCount: number
}) {
  const showRating = rating > 0 && reviewCount > 0
  const ratingLabel = Number.isInteger(rating) ? rating.toFixed(1) : String(rating)
  return (
    <div className="comm-d-dock">
      {showRating ? (
        <Link href="/reviews" className="comm-d-dock-rating">
          {ratingLabel}
        </Link>
      ) : null}
      {showRating ? <span>Google</span> : null}
      <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
      <span className="comm-d-dock-actions">
        <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
        <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
      </span>
    </div>
  )
}
