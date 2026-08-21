'use client'

import Link from 'next/link'
import { CONTACT } from '@/lib/brand/contact'

export function HoodDDock({
  rating,
  reviewCount,
}: {
  rating: number
  reviewCount: number
}) {
  const showRating = rating > 0 && reviewCount > 0
  const ratingLabel = Number.isInteger(rating) ? `${rating.toFixed(1)}` : String(rating)

  return (
    <div className="hood-d-dock">
      {showRating ? (
        <Link href="/reviews" className="hood-d-dock-rating">
          {ratingLabel}
        </Link>
      ) : null}
      {showRating ? <span>Google</span> : null}
      <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
      <span className="hood-d-dock-actions">
        <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
        <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
      </span>
    </div>
  )
}
