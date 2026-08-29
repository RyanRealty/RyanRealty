'use client'

import Image from 'next/image'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { V3Button, V3Stage } from '@/components/site/v3'
import type { ListingPhoto } from '@/lib/data/types/listing'
import { PhotoGalleryLightbox } from './PhotoGalleryLightbox'

type GalleryContextValue = {
  photos: ReadonlyArray<ListingPhoto>
  total: number
  altBase: string
  open: (index: number) => void
}

const GalleryContext = createContext<GalleryContextValue | null>(null)

function useGallery(): GalleryContextValue {
  const value = useContext(GalleryContext)
  if (!value) {
    throw new Error('Listing gallery controls must sit inside ListingGalleryProvider.')
  }
  return value
}

export function ListingGalleryProvider({
  photos,
  addressLine,
  children,
}: {
  photos: ReadonlyArray<ListingPhoto>
  addressLine?: string
  children: ReactNode
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const total = photos.length
  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'
  const value = useMemo<GalleryContextValue>(
    () => ({
      photos,
      total,
      altBase,
      open: (index: number) => setOpenIndex(index),
    }),
    [photos, total, altBase],
  )

  return (
    <GalleryContext.Provider value={value}>
      {children}
      <PhotoGalleryLightbox
        photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
        openIndex={openIndex}
        total={total}
        altBase={altBase}
        onClose={() => setOpenIndex(null)}
        onChange={(i) => setOpenIndex(i)}
      />
    </GalleryContext.Provider>
  )
}

/**
 * Listing Stage. Imagine / library still as media. Street-only H1.
 * Tap opens the MLS gallery. "N photos" is 48px, not a pill on the photo edge.
 */
export function ListingHero({
  posterSrc,
  addressLine,
}: {
  posterSrc: string
  addressLine: string
}) {
  const { total, open } = useGallery()
  const headline = addressLine.trim() || 'This home'
  const photosLabel = `${total} ${total === 1 ? 'photo' : 'photos'}`

  return (
    <div id="listing-hero-visual">
      <V3Stage
        id="listing-stage"
        headingLevel={1}
        height="tall"
        headline={headline}
        posterSrc={posterSrc}
        onMediaActivate={total > 0 ? () => open(0) : undefined}
        mediaActivateLabel={total > 0 ? `Open ${photosLabel}` : undefined}
      >
        {total > 0 ? (
          <V3Button
            type="button"
            variant="primary"
            onMedia
            className="v3-stage-photos"
            onClick={() => open(0)}
          >
            {photosLabel}
          </V3Button>
        ) : null}
      </V3Stage>
    </div>
  )
}

/** MLS stills live in the Sheet, not on Stage. */
export function ListingPhotoStrip() {
  const { photos, total, altBase, open } = useGallery()
  if (total === 0) return null

  const visible = photos.slice(0, 6)
  const remaining = Math.max(0, total - visible.length)

  return (
    <div className="listing-sheet-gallery">
      <div className="listing-sheet-gallery-row">
        {visible.map((photo, index) => (
          <button
            key={`${index}-${photo.url}`}
            type="button"
            onClick={() => open(index)}
            aria-label={`Open photo ${index + 1} of ${total}`}
            className="listing-sheet-gallery-cell"
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? `${altBase} ${index + 1} of ${total}`}
              fill
              sizes="(min-width: 1200px) 16vw, (min-width: 760px) 20vw, 33vw"
              className="object-cover"
            />
          </button>
        ))}
        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => open(0)}
            aria-label={`Open all ${total} photos`}
            className="listing-sheet-gallery-more"
          >
            +{remaining} more
          </button>
        ) : null}
      </div>
    </div>
  )
}
