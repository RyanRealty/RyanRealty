'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import {
  publishListingGalleryMobilePills,
  publishListingGalleryTabs,
} from '@/lib/listing/publish-listing-mosaic-pills'
import type { VideoEmbed } from '@/lib/data/types/video'
import './listing-detail.css'

/**
 * Listing gallery. Desktop: 44px X top-left, tab row of media that exists,
 * Esc, ?photo=1. Mobile: labeled Back 44px, stacked stills, pills that exist.
 * Browser Back returns to the listing at the same scroll.
 */

export type GalleryPhoto = {
  url: string
  caption?: string | null
}

type GalleryPane = 'photos' | 'floor'

type Props = {
  photos: ReadonlyArray<GalleryPhoto>
  floorPlans?: ReadonlyArray<GalleryPhoto>
  videos?: ReadonlyArray<VideoEmbed>
  openIndex: number | null
  pane?: GalleryPane
  onPaneChange?: (pane: GalleryPane) => void
  total?: number
  altBase?: string
  onClose: () => void
  onChange: (nextIndex: number) => void
  onOpenEmbed?: (kind: 'video' | 'tour') => void
}

export function PhotoGalleryLightbox({
  photos,
  floorPlans = [],
  videos = [],
  openIndex,
  pane = 'photos',
  onPaneChange,
  total,
  altBase = 'Photo',
  onClose,
  onChange,
  onOpenEmbed,
}: Props) {
  const stills = pane === 'floor' ? floorPlans : photos
  const count = total ?? stills.length

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

  const isOpen = openIndex != null && (photos.length > 0 || floorPlans.length > 0)
  const { dismiss } = useMediaOverlayHistory(
    isOpen,
    onClose,
    'gallery',
    pane === 'photos' && openIndex != null ? openIndex + 1 : null,
  )
  const tabs = publishListingGalleryTabs({
    photoCount: photos.length,
    videos,
    floorPlanCount: floorPlans.length,
  })
  const mobilePills = publishListingGalleryMobilePills({
    photoCount: photos.length,
    videos,
    floorPlanCount: floorPlans.length,
  })

  if (!isOpen) return null

  const current = stills[openIndex!] ?? stills[0]
  const altText = current?.caption ?? `${altBase} ${openIndex! + 1} of ${count}`

  function selectPane(next: GalleryPane) {
    onPaneChange?.(next)
    onChange(0)
  }

  function onTab(id: string) {
    if (id === 'photos' || id === 'all') {
      selectPane('photos')
      return
    }
    if (id === 'floor') {
      selectPane('floor')
      return
    }
    if (id === 'video' || id === 'tour') {
      if (onOpenEmbed) {
        dismiss()
        onOpenEmbed(id)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent
        showCloseButton={false}
        aria-label="Photo gallery"
        overlayClassName="listing-gallery__overlay z-[110]"
        className="listing-gallery z-[110]"
      >
          <div className="listing-gallery__bar">
            <div className="listing-gallery__exit">
              <button
                type="button"
                onClick={dismiss}
                className="listing-gallery__back"
                aria-label="Back"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="listing-gallery__close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {tabs.length > 1 ? (
              <div className="listing-gallery__tabs" role="tablist" aria-label="Listing media">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={
                      tab.id === 'floor' ? pane === 'floor' : tab.id === 'photos' ? pane === 'photos' : false
                    }
                    className={cn(
                      'listing-gallery__tab',
                      (tab.id === 'floor' && pane === 'floor') ||
                        (tab.id === 'photos' && pane === 'photos')
                        ? 'is-on'
                        : null,
                    )}
                    onClick={() => onTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="listing-gallery__count">
              {stills.length > 0 ? <>{openIndex! + 1} of {count}</> : null}
            </div>
          </div>

          {mobilePills.length > 1 ? (
            <div className="listing-gallery__pills">
              {mobilePills.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  className={cn(
                    'listing-gallery__pill',
                    (pill.id === 'floor' && pane === 'floor') ||
                      (pill.id === 'all' && pane === 'photos')
                      ? 'is-on'
                      : null,
                  )}
                  onClick={() => onTab(pill.id)}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="listing-gallery__stack">
            {stills.map((p, i) => (
              <button
                key={`stack-${i}-${p.url}`}
                type="button"
                className="listing-gallery__stack-item"
                onClick={() => onChange(i)}
                aria-label={`${altBase} ${i + 1} of ${stills.length}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? `${altBase} ${i + 1}`} />
              </button>
            ))}
          </div>

          <div
            className="listing-gallery__stage"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              onClick={goPrev}
              className="listing-gallery__arrow listing-gallery__arrow--prev"
              aria-label="Previous photo"
            >
              ‹
            </button>
            {current ? (
              <div className="listing-gallery__frame">
                <Image
                  src={current.url}
                  alt={altText}
                  fill
                  sizes="100vw"
                  priority
                  className="object-contain"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              className="listing-gallery__arrow listing-gallery__arrow--next"
              aria-label="Next photo"
            >
              ›
            </button>
          </div>

          {count <= 20 && stills.length > 1 ? (
            <div className="listing-gallery__dots" aria-hidden>
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className={cn('listing-gallery__dot', i === openIndex && 'is-on')}
                />
              ))}
            </div>
          ) : null}

          <div ref={stripRef} className="listing-gallery__thumbs">
            {stills.map((p, i) => (
              <button
                key={`${i}-${p.url}`}
                type="button"
                data-thumb-index={i}
                onClick={() => onChange(i)}
                className={cn('listing-gallery__thumb', i === openIndex && 'is-on')}
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
        </DialogContent>
    </Dialog>
  )
}
