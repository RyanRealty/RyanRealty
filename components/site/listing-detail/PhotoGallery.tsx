'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { Eyebrow } from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'

/**
 * Listing-detail PhotoGallery — hero photo + thumbnail grid + click-to-
 * fullscreen lightbox. Lazy beyond fold; the hero photo is `priority`,
 * thumbnails 2..N are lazy-loaded.
 *
 * Per CLAUDE.md UI rules: native Next/Image. AVIF/WebP picked by Next
 * automatically based on the Accept header. No carousel by default —
 * the lightbox uses keyboard arrows + click to advance, which avoids
 * heavy third-party carousel JS on first paint.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  /** Used for img alt text. */
  addressLine?: string
  className?: string
}

export function PhotoGallery({ photos, addressLine, className }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const total = photos.length

  const close = useCallback(() => setOpenIndex(null), [])
  const next = useCallback(
    () => setOpenIndex((i) => (i == null ? null : (i + 1) % total)),
    [total],
  )
  const prev = useCallback(
    () => setOpenIndex((i) => (i == null ? null : (i - 1 + total) % total)),
    [total],
  )

  useEffect(() => {
    if (openIndex == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [openIndex, close, next, prev])

  if (total === 0) return null

  const hero = photos[0]
  const thumbs = photos.slice(1, 7)
  const remaining = Math.max(0, total - thumbs.length - 1)
  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid gap-2 grid-cols-1 md:grid-cols-[2fr_1fr]">
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
          aria-label="Open photo 1 of {total}"
        >
          <Image
            src={hero.url}
            alt={hero.caption ?? `${altBase} 1 of ${total}`}
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            priority
            className="object-cover"
          />
        </button>
        <div className="hidden md:grid grid-rows-3 gap-2">
          {thumbs.slice(0, 3).map((p, i) => (
            <button
              key={`${i + 1}-${p.url}`}
              type="button"
              onClick={() => setOpenIndex(i + 1)}
              className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
              aria-label={`Open photo ${i + 2} of ${total}`}
            >
              <Image
                src={p.url}
                alt={p.caption ?? `${altBase} ${i + 2} of ${total}`}
                fill
                sizes="33vw"
                loading="lazy"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {thumbs.length > 3 ? (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
          {thumbs.slice(3).map((p, i) => (
            <button
              key={`${i + 4}-${p.url}`}
              type="button"
              onClick={() => setOpenIndex(i + 4)}
              className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
              aria-label={`Open photo ${i + 5} of ${total}`}
            >
              <Image
                src={p.url}
                alt={p.caption ?? `${altBase} ${i + 5} of ${total}`}
                fill
                sizes="(min-width: 768px) 16vw, 33vw"
                loading="lazy"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="text-sm font-semibold text-primary hover:underline self-start"
        >
          See all {total} photos
        </button>
      ) : null}

      {openIndex != null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            className="absolute top-4 right-4 text-white/85 hover:text-white text-2xl px-3 py-1 rounded-lg bg-white/10"
            aria-label="Close gallery"
          >
            ×
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/85 hover:text-white text-3xl px-3 py-2 rounded-full bg-white/10"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/85 hover:text-white text-3xl px-3 py-2 rounded-full bg-white/10"
            aria-label="Next photo"
          >
            ›
          </button>
          <div
            className="relative w-[min(95vw,1400px)] h-[min(85vh,900px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[openIndex].url}
              alt={photos[openIndex].caption ?? `${altBase} ${openIndex + 1} of ${total}`}
              fill
              sizes="95vw"
              priority
              className="object-contain"
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/75 text-xs tabular-nums">
            <Eyebrow className="text-white/75">
              {openIndex + 1} of {total}
            </Eyebrow>
          </div>
        </div>
      ) : null}
    </div>
  )
}
