'use client'

import Link from 'next/link'
import { CONTACT } from '@/lib/brand/contact'

export function HomeDDock({
  rating,
  reviewCount,
}: {
  rating: number
  reviewCount: number
}) {
  const showRating = rating > 0 && reviewCount > 0
  const ratingLabel = Number.isInteger(rating) ? `${rating.toFixed(1)}` : String(rating)

  return (
    <div className="home-d-dock">
      {showRating ? (
        <Link href="/reviews" className="home-d-dock-rating">
          {ratingLabel}
        </Link>
      ) : null}
      {showRating ? <span>Google</span> : null}
      <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
      <span className="home-d-dock-actions">
        <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
        <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
      </span>
    </div>
  )
}
