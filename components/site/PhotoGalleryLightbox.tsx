'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
 *
 * Shell uses Dialog/DialogContent so focus-trap, Escape-to-close, and
 * scroll-lock come from Radix — no hand-rolled handling needed.
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
      // Escape is handled by the Dialog primitive; arrow keys are ours.
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [openIndex, goNext, goPrev])

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

  const isOpen = openIndex != null && photos.length > 0

  if (!isOpen) return null

  const current = photos[openIndex!]
  const altText = current.caption ?? `${altBase} ${openIndex! + 1} of ${count}`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-none" />
        {/* Full-screen gallery content — overrides DialogContent defaults for a
            dark immersive shell. showCloseButton=false so we supply our own. */}
        <DialogContent
          showCloseButton={false}
          aria-label="Photo gallery"
          className="max-w-none w-screen h-dvh bg-transparent border-0 p-0 shadow-none rounded-none ring-0 flex flex-col items-stretch justify-between gap-0 translate-x-0 translate-y-0 top-0 left-0"
        >
          {/* Header: counter + close */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
            <div className="text-xs uppercase tracking-[0.08em] text-white/75 tabular-nums">
              {openIndex! + 1} of {count}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-lg bg-white/10 text-white/90 hover:bg-white/15 hover:text-white"
              aria-label="Close gallery"
            >
              Close
            </Button>
          </div>

          {/* Main photo area */}
          <div
            className="relative flex grow items-center justify-center px-4 sm:px-12"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 text-white/90 hover:bg-white/15 hover:text-white sm:left-6 text-3xl"
              aria-label="Previous photo"
            >
              {'‹'}
            </Button>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 text-white/90 hover:bg-white/15 hover:text-white sm:right-6 text-3xl"
              aria-label="Next photo"
            >
              {'›'}
            </Button>
          </div>

          {/* Dot indicator (shown when <= 20 photos) */}
          {count <= 20 ? (
            <div
              className="flex shrink-0 items-center justify-center gap-1.5 py-2"
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

          {/* Thumbnail strip */}
          <div
            ref={stripRef}
            className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pb-4 sm:px-6"
          >
            {photos.map((p, i) => (
              <Button
                key={`${i}-${p.url}`}
                variant="ghost"
                size="icon"
                data-thumb-index={i}
                onClick={() => onChange(i)}
                className={cn(
                  'relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-md transition p-0',
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
              </Button>
            ))}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
