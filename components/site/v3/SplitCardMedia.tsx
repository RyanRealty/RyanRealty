'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { V3ListingRowBadge } from './V3ListingRow'

const SOLID: Record<V3ListingRowBadge, boolean> = {
  hot: true,
  drop: true,
  sold: true,
  pending: true,
  new: false,
  open: true,
  video: false,
}

/** Redfin search-card media: photo stack, overlay badges, 3D/Video control. */
export function SplitCardMedia({
  urls,
  tags,
  hasTour,
  onOpenTour,
  addressLine,
  priority,
  tourLabel = '3D Walkthrough',
}: {
  urls: string[]
  tags: Array<{ kind: V3ListingRowBadge; label: string }>
  hasTour: boolean
  onOpenTour?: () => void
  addressLine: string
  priority?: boolean
  tourLabel?: string
}) {
  const [index, setIndex] = useState(0)
  const photos = urls.filter(Boolean)
  const src = photos[index] ?? photos[0] ?? null
  const last = photos.length - 1
  const photoTags = tags.filter((tag) => tag.kind !== 'video')

  function step(delta: number, event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (photos.length < 2) return
    setIndex((current) => (current + delta + photos.length) % photos.length)
  }

  return (
    <div className="v3-lrow__media">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes="200px"
        />
      ) : null}
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            className="v3-lrow__nav v3-lrow__nav--prev"
            aria-label="Previous photo"
            onClick={(event) => step(-1, event)}
          >
            ‹
          </button>
          <button
            type="button"
            className="v3-lrow__nav v3-lrow__nav--next"
            aria-label="Next photo"
            onClick={(event) => step(1, event)}
          >
            ›
          </button>
        </>
      ) : null}
      {photoTags.length > 0 ? (
        <span className="v3-lrow__photo-tags">
          {photoTags.map((tag) => (
            <span
              key={`${tag.kind}-${tag.label}`}
              className={cn('v3-lrow__tag', SOLID[tag.kind] && 'v3-lrow__tag--solid')}
            >
              {tag.label}
            </span>
          ))}
        </span>
      ) : null}
      {hasTour ? (
        onOpenTour ? (
          <button
            type="button"
            className="v3-lrow__tour"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenTour()
            }}
          >
            {tourLabel}
          </button>
        ) : (
          <span className="v3-lrow__tour">3D Walkthrough</span>
        )
      ) : null}
      {photos.length > 1 ? (
        <span className="v3-lrow__dots" aria-hidden>
          {index + 1}/{photos.length}
        </span>
      ) : null}
      <span className="v3-lrow__addr-tip">{addressLine}</span>
    </div>
  )
}
