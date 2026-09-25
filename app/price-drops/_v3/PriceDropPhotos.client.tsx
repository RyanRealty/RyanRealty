'use client'

/**
 * Photographed price-cut houses on the listing dial.
 *
 * WHAT IT WAS. The installed shadcn carousel (`components/ui/carousel.tsx`),
 * one composed slide per house with Previous / Next flanking the track and an
 * "01 / 12" readout under it.
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * V3ListingDial: one cut house large with its photograph and the card's copy,
 * the rest of the band as thumbnails on the dial's rail, "03 / 12" at its
 * head. The houses are the same ones in the same order: the band's
 * photographed rows (every row when none has a photograph), sorted by cut
 * percent upstream in priceDropFieldItems, each drawn from the row the Field
 * list lists (`item.listing`, built in the same pass). The cut itself rides
 * the photograph as the drop badge in the card's own words ("was $599,000,
 * -8.3%"), and the city and subdivision the slide named sit on the card's
 * city line.
 *
 * One dial per cut-size band, inside PriceDropsFold's switch; only one shows
 * at a time, so the page reads as one dial and takes the dial's default rail.
 */
import { V3ListingDial } from '@/components/site/v3'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropPhotos({
  id,
  items,
  label,
  priority = false,
}: {
  /** The dial's root id, unique on the page (one per band). */
  id: string
  items: readonly PriceDropFieldItem[]
  label: string
  /**
   * The band open on arrival: under the page's text opening, its first
   * photograph is the page's first large image, so it is not lazy.
   */
  priority?: boolean
}) {
  const photographed = items.filter((item) => Boolean(item.photoSrc?.trim()))
  const rail = photographed.length > 0 ? photographed : items
  if (rail.length === 0) return null

  return (
    <div className="pd-cuts">
      <V3ListingDial
        id={id}
        label={label}
        listings={rail.map((item) => item.listing)}
        priority={priority}
        className="pd-cuts-dial"
      />
    </div>
  )
}
