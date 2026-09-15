'use client'

import { useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { publishTourEmbedFromUrl } from '@/lib/listing/publish-listing-hero-video'
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

/**
 * Shared public listing-card media (homepage rails, search split, place folds):
 * photo stack with swipe/arrows/dots, optional in-card tour/video play.
 * Photo click opens the listing. Tour chrome plays inside the card — not only
 * after navigate. No save/heart on public cards.
 */
export function SplitCardMedia({
  urls,
  tags,
  hasTour,
  onOpenTour,
  tourUrl,
  addressLine,
  priority,
  tourLabel = '3D Walkthrough',
  sizes = SPLIT_CARD_MEDIA_SIZES_DEFAULT,
  href,
}: {
  urls: string[]
  tags: Array<{ kind: V3ListingRowBadge; label: string }>
  hasTour: boolean
  /** Fallback when tourUrl is absent or not embeddable (legacy overlay). */
  onOpenTour?: () => void
  /** Scalar virtual-tour / video URL — plays inside the card media when embeddable. */
  tourUrl?: string | null
  addressLine: string
  priority?: boolean
  tourLabel?: string
  sizes?: string
  /** Photo opens the listing detail page (same href as the card copy). */
  href?: string
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const touchX = useRef<number | null>(null)
  const photos = urls
    .map((url) => listingRowPhotoSrc(url, LISTING_FIELD_LEAD_PHOTO_SIZE))
    .filter(Boolean)
  const src = photos[index] ?? photos[0] ?? null
  const photoTags = tags.filter((tag) => tag.kind !== 'video')
  const embed = hasTour ? publishTourEmbedFromUrl(tourUrl, src) : null
  const canPlayInCard =
    embed != null && (embed.embedType === 'iframe' || embed.embedType === 'video-tag')
  const showTourChrome = hasTour && (canPlayInCard || Boolean(onOpenTour))

  function step(delta: number, event?: MouseEvent | TouchEvent) {
    event?.preventDefault()
    event?.stopPropagation()
    if (photos.length < 2 || playing) return
    setIndex((current) => (current + delta + photos.length) % photos.length)
  }

  function startTour(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (canPlayInCard) {
      setPlaying(true)
      return
    }
    onOpenTour?.()
  }

  function stopTour(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    setPlaying(false)
  }

  return (
    <div
      className="v3-lrow__media"
      onTouchStart={(event) => {
        if (playing) return
        touchX.current = event.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        if (playing) return
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
      {playing && canPlayInCard && embed ? (
        <div className="v3-lrow__player">
          {embed.embedType === 'video-tag' ? (
            <video
              src={embed.url}
              poster={embed.posterUrl ?? src ?? undefined}
              muted
              autoPlay
              playsInline
              controls
              className="v3-lrow__player-el"
            />
          ) : (
            <iframe
              src={embed.url}
              title={tourLabel}
              className="v3-lrow__player-el"
              allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
              allowFullScreen
            />
          )}
          <button type="button" className="v3-lrow__player-close" aria-label="Close tour" onClick={stopTour}>
            ×
          </button>
        </div>
      ) : src ? (
        href ? (
          <Link href={href} className="v3-lrow__photo-link" aria-label={`Open ${addressLine}`}>
            <SparkSafeImage
              src={src}
              alt={listingPhotoAlt({ addressLine })}
              fill
              priority={priority}
              sizes={sizes}
            />
          </Link>
        ) : (
          <SparkSafeImage
            src={src}
            alt={listingPhotoAlt({ addressLine })}
            fill
            priority={priority}
            sizes={sizes}
          />
        )
      ) : null}
      {!playing && photos.length > 1 ? (
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
      {!playing && photoTags.length > 0 ? (
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
      {!playing && showTourChrome ? (
        <button type="button" className="v3-lrow__tour" onClick={startTour}>
          <span className="v3-lrow__tour-label">{tourLabel}</span>
        </button>
      ) : null}
      {!playing && photos.length > 1 ? (
        <span className="v3-lrow__dots" aria-hidden>
          {photos.map((_, i) => (
            <span key={i} className={cn('v3-lrow__dot', i === index && 'v3-lrow__dot--on')} />
          ))}
        </span>
      ) : null}
      {!playing ? <span className="v3-lrow__addr-tip">{addressLine}</span> : null}
    </div>
  )
}
