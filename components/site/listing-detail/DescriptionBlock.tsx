'use client'

import { useState } from 'react'
import { publishListingRemarks } from '@/lib/listing/publish-listing-remarks'
import { cn } from '@/lib/utils'

/**
 * Listing-detail DescriptionBlock — MLS public_remarks. Compact body chrome:
 * 23px sentence-case head, clamped copy with Show more. Words are never invented.
 */

type Props = {
  publicRemarks: string | null
  className?: string
}

export function DescriptionBlock({ publicRemarks, className }: Props) {
  const paragraphs = publishListingRemarks(publicRemarks)
  const [open, setOpen] = useState(false)
  if (paragraphs.length === 0) return null
  const long = paragraphs.join(' ').length > 280

  return (
    <section className={cn('section listing-about', open && 'is-open', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">About this home</div>
          <h2 className="sec-title">About this home</h2>
        </div>
      </div>

      <div className="listing-about__copy">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long ? (
        <button
          type="button"
          className="listing-about__more"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </section>
  )
}
