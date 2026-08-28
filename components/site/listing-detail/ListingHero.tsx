'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/data/types/listing'
import { PhotoGalleryLightbox } from './PhotoGalleryLightbox'
import {
  publishListingHeroPrice,
  publishListingHeroKeyStats,
} from '@/lib/listing/publish-listing-hero-stats'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { V3Button, V3Eyebrow, V3Figure, V3Stage } from '@/components/site/v3'

/**
 * Listing opening: one V3Stage (16:9 frame) with this house's still, the
 * exact list price in Amboqia, and specs on the media. One action opens the
 * on-page Sheet. Still frame only. No carousel. No listing-invented hero skin.
 */

type Props = {
  photos: ReadonlyArray<ListingPhoto>
  addressLine?: string
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  acres?: number | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
  className?: string
}

export function ListingHero({
  photos,
  addressLine,
  price,
  beds,
  baths,
  sqft,
  acres = null,
  propertySubType,
  subdivisionName,
  city,
  listNumber,
  className,
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const total = photos.length
  const poster = photos[0]
  if (!poster) return null

  const heroPrice = publishListingHeroPrice(price)
  const keyStats = publishListingHeroKeyStats({ beds, baths, sqft, acres })
  const shareKind = publishListingShareKind({
    propertySubType,
    subdivisionName,
    city,
    listNumber,
  })
  const headline = addressLine?.trim() || 'This home'
  const specLine = keyStats.join(' · ')
  const altBase = addressLine ? `Photo of ${addressLine}` : 'Listing photo'

  return (
    <div id="listing-hero-visual" className={cn(className)}>
      <V3Stage
        headingLevel={1}
        height="frame"
        overlayStrength="standard"
        eyebrow={city?.trim() || undefined}
        headline={headline}
        posterSrc={poster.url}
        action={{ label: 'Tour this home', href: '#listing-act' }}
      >
        {heroPrice ? (
          <V3Figure value={heroPrice} label="Price" emphasis="lead" onMedia />
        ) : null}
        {shareKind ? <V3Eyebrow onMedia>{shareKind}</V3Eyebrow> : null}
        {specLine ? <V3Eyebrow onMedia>{specLine}</V3Eyebrow> : null}
        {total > 1 ? (
          <V3Button
            type="button"
            variant="text"
            onMedia
            onClick={() => setOpenIndex(0)}
          >
            {`See all ${total} photos`}
          </V3Button>
        ) : null}
      </V3Stage>

      <PhotoGalleryLightbox
        photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
        openIndex={openIndex}
        total={total}
        altBase={altBase}
        onClose={() => setOpenIndex(null)}
        onChange={(i) => setOpenIndex(i)}
      />
    </div>
  )
}
