'use client'

import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { TRANSITIONS_MODAL_SURFACE } from '@/components/motion/transitions-modal'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import {
  publishListingGalleryMobilePills,
  publishListingGalleryTabs,
} from '@/lib/listing/publish-listing-mosaic-pills'
import { preferListingMosaicPhotoUrl } from '@/lib/listing/publish-listing-mosaic'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import type { VideoEmbed } from '@/lib/data/types/video'
import './listing-detail.css'

/**
 * Listing gallery. The still is the room. Desktop chrome sits on the
 * photograph: 44px X, type tabs for media that exists, Esc, ?photo=1.
 * Mobile: labeled Back 44px, stacked stills, pills that exist.
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
  hasStreetView?: boolean
  onClose: () => void
  onChange: (nextIndex: number) => void
  onOpenEmbed?: (kind: 'video' | 'tour') => void
  onOpenStreet?: () => void
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
  hasStreetView = false,
  onClose,
  onChange,
  onOpenEmbed,
  onOpenStreet,
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
  const { dismiss, closeInPlace } = useMediaOverlayHistory(
    isOpen,
    onClose,
    'gallery',
    pane === 'photos' && openIndex != null ? openIndex + 1 : null,
  )
  const tabs = publishListingGalleryTabs({
    photoCount: photos.length,
    videos,
    floorPlanCount: floorPlans.length,
    hasStreetView,
  })
  const mobilePills = publishListingGalleryMobilePills({
    photoCount: photos.length,
    videos,
    floorPlanCount: floorPlans.length,
    hasStreetView,
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
        // Do not history.back() then immediately push #tour — that race
        // pops the tour closed. Strip ?photo= in place; tour still uses #tour.
        closeInPlace()
        onOpenEmbed(id)
      }
      return
    }
    if (id === 'street') {
      closeInPlace()
      onOpenStreet?.()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent
        className={cn('sm:max-w-3xl', TRANSITIONS_MODAL_SURFACE)}
      >
        <DialogHeader>
          <DialogTitle>Photos</DialogTitle>
          <DialogDescription>
            {stills.length > 0 ? (
              <>
                {openIndex! + 1} of {count}
              </>
            ) : (
              altBase
            )}
          </DialogDescription>
        </DialogHeader>
        {tabs.length > 1 ? (
          <Tabs
            value={pane === 'floor' ? 'floor' : 'photos'}
            onValueChange={onTab}
            variant="pill"
          >
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : mobilePills.length > 1 ? (
          <Tabs
            value={pane === 'floor' ? 'floor' : 'photos'}
            onValueChange={onTab}
            variant="pill"
          >
            <TabsList>
              {mobilePills.map((pill) => (
                <TabsTrigger key={pill.id} value={pill.id === 'all' ? 'photos' : pill.id}>
                  {pill.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        <div
          className="relative"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2"
            onClick={goPrev}
            aria-label="Previous photo"
          >
            ‹
          </Button>
          {current ? (
            <div className="relative aspect-[4/3] w-full bg-background">
              <SparkSafeImage
                src={preferListingMosaicPhotoUrl(current.url)}
                alt={altText}
                fill
                sizes="100vw"
                priority
                className="object-contain"
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2"
            onClick={goNext}
            aria-label="Next photo"
          >
            ›
          </Button>
        </div>
        {stills.length > 1 ? (
          <div ref={stripRef} className="flex gap-1 overflow-x-auto no-scrollbar">
            {stills.map((p, i) => (
              <button
                key={`${i}-${p.url}`}
                type="button"
                data-thumb-index={i}
                onClick={() => onChange(i)}
                className={cn(
                  'relative h-16 w-24 shrink-0 overflow-hidden border border-border',
                  i === openIndex && 'ring-2 ring-primary',
                )}
                aria-label={`Jump to photo ${i + 1} of ${count}`}
                aria-current={i === openIndex ? 'true' : undefined}
              >
                <SparkSafeImage
                  src={listingRowPhotoSrc(p.url)}
                  alt={p.caption ?? `${altBase} thumbnail ${i + 1}`}
                  fill
                  sizes="108px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
