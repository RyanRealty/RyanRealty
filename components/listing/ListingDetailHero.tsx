'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import type { ListingDetailPhoto } from '@/app/actions/listing-detail'
import { trackEvent } from '@/lib/tracking'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayIcon, Cancel01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

function photoUrl(p: ListingDetailPhoto): string {
  return p.cdn_url ?? p.photo_url
}

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i
function isDirectVideoUrl(url: string): boolean {
  try {
    return DIRECT_VIDEO_EXT.test(new URL(url).pathname)
  } catch {
    return false
  }
}

type Props = {
  photos: ListingDetailPhoto[]
  virtualTourUrl?: string
  listingKey: string
  /** When set (direct mp4/webm URL), show as full-bleed background video hero above the photo grid. */
  heroVideoUrl?: string | null
}

export default function ListingDetailHero({ photos, virtualTourUrl, listingKey, heroVideoUrl }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const list = photos.length > 0 ? photos : []
  const main = list[0]
  const showBackgroundVideo = Boolean(heroVideoUrl && isDirectVideoUrl(heroVideoUrl))
  const rightTop = list[1]
  const rightBottom = list[2]

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
    trackEvent('view_photo_gallery', { listing_key: listingKey, photo_count: list.length })
  }, [listingKey, list.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!lightboxOpen) return
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === 0 ? list.length - 1 : i - 1))
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === list.length - 1 ? 0 : i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxOpen, list.length])

  if (list.length === 0) {
    return (
      <div className="flex aspect-[16/10] max-h-[70vh] w-full items-center justify-center bg-border text-muted-foreground">
        No photos
      </div>
    )
  }

  return (
    <div className="w-full -mt-16">
      {showBackgroundVideo && heroVideoUrl && (
        <section className="relative w-full overflow-hidden bg-black" aria-label="Listing video">
          <div className="aspect-[16/10] max-h-[75vh] w-full relative">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
              src={heroVideoUrl}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" aria-hidden />
          </div>
        </section>
      )}
      <section className="relative w-full" aria-label="Listing photos">
        {/* Desktop: 60% left + 40% right (2 stacked) */}
        <div className="hidden md:grid grid-cols-5 grid-rows-2 gap-1 max-h-[70vh]">
          <Button
            type="button"
            className="col-span-3 row-span-2 relative aspect-[4/3] min-h-0 overflow-hidden group"
            onClick={() => openLightbox(0)}
          >
            <Image
              src={photoUrl(main!)}
              alt={`Property photo 1 of ${list.length}`}
              fill
              className="object-cover"
              sizes="60vw"
              priority
            />
            {virtualTourUrl && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                <span className="w-16 h-16 rounded-full bg-card/90 flex items-center justify-center">
                  <HugeiconsIcon icon={PlayIcon} className="w-8 h-8 text-primary ml-1" aria-hidden />
                </span>
              </span>
            )}
          </Button>
          <Button
            type="button"
            className="col-span-2 row-span-1 relative aspect-[4/3] min-h-0 overflow-hidden"
            onClick={() => openLightbox(rightTop ? 1 : 0)}
          >
            {rightTop ? (
              <Image src={photoUrl(rightTop)} alt={`Property photo 2 of ${list.length}`} fill className="object-cover" sizes="40vw" />
            ) : (
              <div className="absolute inset-0 bg-border" />
            )}
          </Button>
          <Button
            type="button"
            className="col-span-2 row-span-1 relative aspect-[4/3] min-h-0 overflow-hidden"
            onClick={() => openLightbox(rightBottom ? 2 : rightTop ? 1 : 0)}
          >
            {rightBottom ? (
              <Image src={photoUrl(rightBottom)} alt={`Property photo 3 of ${list.length}`} fill className="object-cover" sizes="40vw" />
            ) : (
              <div className="absolute inset-0 bg-border" />
            )}
          </Button>
        </div>
        {/* Mobile: single full-width */}
        <div className="md:hidden relative aspect-[4/3] w-full">
          <Button type="button" className="absolute inset-0" onClick={() => openLightbox(0)}>
            <Image
              src={photoUrl(main!)}
              alt={`Property photo 1 of ${list.length}`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </Button>
          {virtualTourUrl && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <span className="w-14 h-14 rounded-full bg-card/90 flex items-center justify-center">
                <HugeiconsIcon icon={PlayIcon} className="w-7 h-7 text-primary ml-0.5" aria-hidden />
              </span>
            </span>
          )}
        </div>
        {/* View All Photos + counter */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <span className="rounded-full bg-black/60 text-white text-xs px-2 py-1">
            1 / {list.length}
          </span>
          <Button
            type="button"
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-accent/90"
            onClick={() => openLightbox(0)}
          >
            View All {list.length} Photos
          </Button>
        </div>
      </section>

      {/* Full-screen gallery modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
        >
          <Button
            type="button"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-card/20 text-white flex items-center justify-center hover:bg-card/30"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close gallery"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="w-6 h-6" />
          </Button>
          <Button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-card/20 text-white flex items-center justify-center hover:bg-card/30"
            onClick={() => setLightboxIndex((i) => (i === 0 ? list.length - 1 : i - 1))}
            aria-label="Previous photo"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-8 h-8" />
          </Button>
          <Button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-card/20 text-white flex items-center justify-center hover:bg-card/30"
            onClick={() => setLightboxIndex((i) => (i === list.length - 1 ? 0 : i + 1))}
            aria-label="Next photo"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="w-8 h-8" />
          </Button>
          <div className="relative flex h-full w-full items-center justify-center">
            <Image
              src={photoUrl(list[lightboxIndex]!)}
              alt={`Property photo ${lightboxIndex + 1} of ${list.length}`}
              fill
              className="object-cover"
              sizes="100vw"
              onClick={() => setLightboxOpen(false)}
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {lightboxIndex + 1} / {list.length}
          </div>
        </div>
      )}
    </div>
  )
}
