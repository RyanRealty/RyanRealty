'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * PhotoGalleryLightbox — site-wide fullscreen photo lightbox primitive.
 *
 * D75 (docs/DESIGN_DIRECTIVES.md): photo gallery nav must include
 *   - thumbnail strip
 *   - dot indicator
 *   - swipe on mobile
 *   - keyboard arrows + Escape
 *   - visible photo counter (`3 of 47`)
 *
 * Lifted out of ListingHero.tsx so every gallery surface in the site
 * uses the same UX. Adding a new gallery (search results lightbox,
 * map-search photo peek, broker portfolio) imports this — they
 * inherit the same nav contract automatically.
 */

export type GalleryPhoto = {
  url: string
  caption?: string | null
}

type Props = {
  photos: ReadonlyArray<GalleryPhoto>
  openIndex: number | null
  total?: number
  altBase?: string
  onClose: () => void
  onChange: (nextIndex: number) => void
}

export function PhotoGalleryLightbox({
  photos,
  openIndex,
  total,
  altBase = 'Photo',
  onClose,
  onChange,
}: Props) {
  const count = total ?? photos.length

  const goNext = useCallback(() => {
    if (openIndex == null || count === 0) return
    onChange((openIndex + 1) % count)
  }, [openIndex, count, onChange])
  const goPrev = useCallback(() => {
    if (openIndex == null || count === 0) return
    onChange((openIndex - 1 + count) % count)
  }, [openIndex, count, onChange])

  useEffect(() => {
    if (openIndex == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [openIndex, onClose, goNext, goPrev])

  const touchRef = useRef<{ startX: number; startY: number } | null>(null)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }
    }
  }, [])
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchRef.current
      touchRef.current = null
      if (start == null) return
      if (e.changedTouches.length === 0) return
      const dx = e.changedTouches[0].clientX - start.startX
      const dy = e.changedTouches[0].clientY - start.startY
      const absDx = dx < 0 ? -dx : dx
      const absDy = dy < 0 ? -dy : dy
      if (absDx < 40) return
      if (absDx < absDy) return
      if (dx < 0) goNext()
      else goPrev()
    },
    [goNext, goPrev],
  )

  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (openIndex == null) return
    const strip = stripRef.current
    if (strip == null) return
    const active = strip.querySelector<HTMLButtonElement>(`[data-thumb-index="${openIndex}"]`)
    if (active != null) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [openIndex])

  if (openIndex == null || photos.length === 0) return null

  const current = photos[openIndex]
  const altText = current.caption ?? `${altBase} ${openIndex + 1} of ${count}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      className="fixed inset-0 z-50 flex flex-col items-stretch justify-between bg-black/95"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-[0.08em] text-white/75 tabular-nums">
          {openIndex + 1} of {count}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-base text-white/90 hover:bg-white/15"
          aria-label="Close gallery"
        >
          Close
        </button>
      </div>

      <div
        className="relative flex grow items-center justify-center px-4 sm:px-12"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl text-white/90 hover:bg-white/15 sm:left-6"
          aria-label="Previous photo"
        >
          {'‹'}
        </button>
        <div className="relative h-[min(78vh,900px)] w-[min(95vw,1400px)]">
          <Image
            src={current.url}
            alt={altText}
            fill
            sizes="95vw"
            priority
            className="object-contain"
          />
        </div>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl text-white/90 hover:bg-white/15 sm:right-6"
          aria-label="Next photo"
        >
          {'›'}
        </button>
      </div>

      {count <= 20 ? (
        <div
          className="flex shrink-0 items-center justify-center gap-1.5 py-2"
          onClick={(e) => e.stopPropagation()}
          aria-hidden
        >
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full bg-white/40 transition',
                i === openIndex ? 'w-6 bg-white' : 'w-1.5',
              )}
            />
          ))}
        </div>
      ) : null}

      <div
        ref={stripRef}
        className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-4 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.map((p, i) => (
          <button
            key={`${i}-${p.url}`}
            type="button"
            data-thumb-index={i}
            onClick={() => onChange(i)}
            className={cn(
              'relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-md transition',
              i === openIndex
                ? 'ring-2 ring-white opacity-100'
                : 'opacity-65 hover:opacity-100',
            )}
            aria-label={`Jump to photo ${i + 1} of ${count}`}
            aria-current={i === openIndex ? 'true' : undefined}
          >
            <Image
              src={p.url}
              alt={p.caption ?? `${altBase} thumbnail ${i + 1}`}
              fill
              sizes="108px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
