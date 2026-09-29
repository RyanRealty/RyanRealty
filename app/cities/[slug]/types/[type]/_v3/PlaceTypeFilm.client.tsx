'use client'

/**
 * Fold set of photographed listings (SITE-106), on the listing dial.
 *
 * WHAT IT WAS. Catalog job `shadcn-carousel`: the installed source with
 * official prev/next, one composed slide at 375, two from md, each card price
 * + address + beds/baths/sqft on an 800x600 plate.
 *
 * WHAT IT IS (Matt 2026-09-24, "Let's get all of those carousels in place").
 * The same homes in the same order on V3ListingDial: one home large with its
 * photograph and the card's copy (the ask, beds, baths, sqft, the address, a
 * door to the listing), the rest as thumbnails on the dial's rail with "03 /
 * 12" at its head. The lead photograph is still the 800x600 plate (the dial
 * asks for LISTING_FIELD_LEAD_PHOTO_SIZE), and filmRows below still decides
 * which homes are in it and in what order: the photographed rows in the
 * claim's price band, the lowest ask, then the highest, then the band spread
 * between them, at most twelve.
 *
 * THE MAP LINK KEEPS WORKING. A pointer or a focus on a film card used to ring
 * that home's mark on the Atlas. The home the dial is showing is the one the
 * reader is on now, so the Atlas rings the home the dial shows from the first
 * paint (2026-09-25: a ring that waited for the pointer left the map looking
 * unrelated to the dial under it), turning the dial moves the ring, and
 * coming back to the film from a Field row rings the dial's home again.
 *
 * Layout lock keeps this AFTER Atlas: H1, claim, Atlas, then the film.
 */

import { useEffect, useState, type FocusEvent } from 'react'
import { V3ListingDial } from '@/components/site/v3'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { usePlaceTypeLink } from './PlaceTypeField.client'
import './place-type-page.css'

const FOLD_CAP = 12
/** The dial's root id; its tab and card ids derive from it. One film per page. */
const FILM_ID = 'place-type-film'

/** Pick photographed rows that read as the claim's band, not only the floor. */
export function filmRows(
  rows: readonly V3ListingRowData[],
  bandLow: number | null,
  bandHigh: number | null,
  bandEndRows: readonly V3ListingRowData[] = [],
): V3ListingRowData[] {
  // The claim's two end homes join the pool (once each), so the film's first
  // and last asks are the sentence's.
  const keys = new Set(rows.map((r) => r.listingKey))
  const merged = [...rows, ...bandEndRows.filter((r) => !keys.has(r.listingKey))]
  const filmed = merged.filter((r) => Boolean(r.photoUrl?.trim()))
  if (filmed.length === 0) return []
  const byAsk = (a: V3ListingRowData, b: V3ListingRowData) =>
    (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY)

  /* A set small enough to hold whole is held whole, cheapest first (2026-09-29:
     Tetherow's thirteen homes showed as twelve, the one past the band dropped,
     under a claim that counts thirteen). */
  if (filmed.length <= FOLD_CAP + 4) return filmed.slice().sort(byAsk)

  const low = bandLow != null && Number.isFinite(bandLow) ? bandLow : null
  const high = bandHigh != null && Number.isFinite(bandHigh) ? bandHigh : null
  const inBand =
    low != null && high != null
      ? filmed.filter((r) => {
          const p = r.price
          return p != null && p >= low && p <= high
        })
      : filmed

  const pool = (inBand.length >= 4 ? inBand : filmed).slice().sort(byAsk)

  if (pool.length <= FOLD_CAP) return pool

  /* Spread across the band so the film matches the sentence, not twelve $470Ks. */
  const picks: V3ListingRowData[] = []
  const seen = new Set<string>()
  const push = (row: V3ListingRowData | undefined) => {
    if (!row || seen.has(row.listingKey)) return
    seen.add(row.listingKey)
    picks.push(row)
  }
  push(pool[0])
  push(pool[pool.length - 1])
  const steps = FOLD_CAP - 2
  for (let i = 1; i <= steps; i += 1) {
    const idx = Math.round((i / (steps + 1)) * (pool.length - 1))
    push(pool[idx])
    if (picks.length >= FOLD_CAP) break
  }
  // Low to high, the order the asks strip over the rail draws them in
  // (2026-09-29: the rail ran $449K, $2.1M, $560K...).
  return picks.slice(0, FOLD_CAP).sort(byAsk)
}

export function PlaceTypeFilm({
  rows,
  label,
  bandLow = null,
  bandHigh = null,
  bandEndRows = [],
  total = null,
}: {
  rows: readonly V3ListingRowData[]
  label: string
  bandLow?: number | null
  bandHigh?: number | null
  bandEndRows?: readonly V3ListingRowData[]
  /** The claim's count, so a film that holds a spread says it is one. */
  total?: number | null
}) {
  const { setLinkedKey, setRestKey } = usePlaceTypeLink()
  const filmed = filmRows(rows, bandLow, bandHigh, bandEndRows)
  // The dial opens on its first home and reports every turn (onIndexChange).
  const [turned, setTurned] = useState(0)
  const index = filmed.length < 2 ? 0 : Math.min(turned, filmed.length - 1)
  const shownKey = filmed[index]?.listingKey ?? null

  // The Atlas rings the home the dial shows, and follows every turn.
  useEffect(() => {
    setRestKey(shownKey)
    setLinkedKey(shownKey)
  }, [shownKey, setLinkedKey, setRestKey])

  if (filmed.length === 0) return null

  const engage = () => {
    setLinkedKey(shownKey)
  }
  const release = engage

  return (
    <div
      className="place-type-film"
      data-listing-key={shownKey ?? undefined}
      onPointerEnter={engage}
      onPointerLeave={release}
      onFocus={engage}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release()
      }}
    >
      <p className="place-type-film__eyebrow">
        {total != null && total > filmed.length
          ? // A spread, not the set: say how many of how many (2026-09-29:
            // "12 asks" under a claim of 758 homes read as a miscount).
            `On the market: ${filmed.length} of ${total.toLocaleString('en-US')}, across the band`
          : 'On the market'}
      </p>
      <V3ListingDial
        id={FILM_ID}
        label={label}
        listings={filmed}
        onIndexChange={setTurned}
        className="place-type-film__dial"
      />
    </div>
  )
}
