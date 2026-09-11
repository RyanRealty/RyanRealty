'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import type { V3ListingRowBadge } from './V3ListingRow'
import { listingPhotoAlt } from './listing-photo-alt'

const SOLID: Record<V3ListingRowBadge, boolean> = {
  hot: true,
  drop: true,
  sold: true,
  pending: true,
  new: false,
  open: true,
  video: false,
}

/** Default sizes for card media. Split thumbs stay smaller, rail cards need crisp srcset. */
export const SPLIT_CARD_MEDIA_SIZES_DEFAULT = '(max-width: 640px) 50vw, 320px'
export const SPLIT_CARD_MEDIA_SIZES_RAIL = '(max-width: 640px) 78vw, 320px'
export const SPLIT_CARD_MEDIA_SIZES_SPLIT = '(max-width: 640px) 42vw, 240px'

/** Search-card media: photo stack, overlay badges, 3D/Video control. */
export function SplitCardMedia({
  urls,
  tags,
  hasTour,
  onOpenTour,
  addressLine,
  priority,
  tourLabel = '3D Walkthrough',
  sizes = SPLIT_CARD_MEDIA_SIZES_DEFAULT,
  href,
}: {
  urls: string[]
  tags: Array<{ kind: V3ListingRowBadge; label: string }>
  hasTour: boolean
  onOpenTour?: () => void
  addressLine: string
  priority?: boolean
  tourLabel?: string
  sizes?: string
  /** SITE-115: photo opens the listing detail page (same href as the card copy). */
  href?: string
}) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const photos = urls
    .map((url) => listingRowPhotoSrc(url, LISTING_FIELD_LEAD_PHOTO_SIZE))
    .filter(Boolean)
  const src = photos[index] ?? photos[0] ?? null
  const photoTags = tags.filter((tag) => tag.kind !== 'video')

  function step(delta: number, event?: React.MouseEvent | React.TouchEvent) {
    event?.preventDefault()
    event?.stopPropagation()
    if (photos.length < 2) return
    setIndex((current) => (current + delta + photos.length) % photos.length)
  }

  return (
    <div
      className="v3-lrow__media"
      onTouchStart={(event) => {
        touchX.current = event.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchX.current
        touchX.current = null
        if (start == null || photos.length < 2) return
        const end = event.changedTouches[0]?.clientX
        if (end == null) return
        const delta = end - start
        if (Math.abs(delta) < 36) return
        step(delta < 0 ? 1 : -1, event)
      }}
    >
      {src ? (
        href ? (
          <Link
            href={href}
            className="v3-lrow__photo-link"
            aria-label={`Open ${addressLine}`}
          >
            <Image
              src={src}
              alt={listingPhotoAlt({ addressLine })}
              fill
              priority={priority}
              sizes={sizes}
            />
          </Link>
        ) : (
          <Image
            src={src}
            alt={listingPhotoAlt({ addressLine })}
            fill
            priority={priority}
            sizes={sizes}
          />
        )
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
            <span className="v3-lrow__tour-label">{tourLabel}</span>
          </button>
        ) : (
          <span className="v3-lrow__tour">
            <span className="v3-lrow__tour-label">3D Walkthrough</span>
          </span>
        )
      ) : null}
      {photos.length > 1 ? (
        <span className="v3-lrow__dots" aria-hidden>
          {photos.map((_, i) => (
            <span
              key={i}
              className={cn('v3-lrow__dot', i === index && 'v3-lrow__dot--on')}
            />
          ))}
        </span>
      ) : null}
      <span className="v3-lrow__addr-tip">{addressLine}</span>
    </div>
  )
}
