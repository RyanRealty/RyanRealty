/**
 * What a plat opens with, and what the page owes the reader about it (SITE-56).
 *
 * Matt, 2026-09-09, reading the page the expired-seller CMA links: "There's no
 * map on the diamond bar sub page and no photo." He was right on both. The
 * opening resolved to a dedicated still or a geo-strict library hero, and for
 * most of the 3,223 recorded plats there is neither, so the page opened on
 * cream: breadcrumb, headline, source chip, nothing to look at.
 *
 * THE LADDER, and every rung says out loud what the frame is:
 *
 *   1. the plat's OWN still            — a dedicated image or a geo-strict
 *                                        library hero. No credit needed: it is
 *                                        a photograph of this place.
 *   2. the RESORT it sits inside       — captioned with the resort's name
 *                                        (SITE-08 pass 2, unchanged).
 *   3. one of the plat's OWN HOMES     — the listing photo, captioned with that
 *                                        listing's address, so nothing implies
 *                                        the frame is of the subdivision.
 *   4. the plat's OWN GROUND, drawn    — its streets, water and recorded
 *                                        outline from public-domain data,
 *                                        captioned as a drawing.
 *
 * §0 APPLIES TO A PICTURE EXACTLY AS IT APPLIES TO A NUMBER. Never a city
 * photograph, never another plat's, never a stock frame, and never a listing
 * photograph standing in for the place unnamed — rung 3 is admissible only
 * because the caption names the house in it.
 *
 * WHICH HOME. The one the page can name best: a photographed active listing
 * with a street address, highest asking price first, then by listing key so two
 * renders of the same inventory choose the same house. Not a random pick and
 * not the newest, which would change the opening every time a home came on.
 */

import { publishStreetLine } from '@/lib/listing/publish-street-line'

export type PlatOpeningPhoto =
  | { kind: 'own'; src: string }
  | { kind: 'resort'; src: string; resortLabel: string }
  | { kind: 'listing'; src: string; address: string }
  | { kind: 'ground'; src: string }

export type PlatListingPhotoTile = {
  listingKey: string
  photoUrl?: string | null
  listPrice?: number | null
  streetNumber?: string | null
  streetName?: string | null
  streetSuffix?: string | null
  status?: string | null
}

/** The plat's own home to open with, or null when none can be named. */
export function platListingPhoto(
  tiles: readonly PlatListingPhotoTile[],
): { src: string; address: string } | null {
  const candidates = tiles
    .filter((t) => (t.photoUrl ?? '').trim().length > 0)
    .map((t) => ({
      tile: t,
      address: publishStreetLine({
        streetNumber: t.streetNumber ?? null,
        streetName: t.streetName ?? null,
        streetSuffix: t.streetSuffix ?? null,
      }),
    }))
    .filter((c) => (c.address ?? '').trim().length > 0)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const pa = a.tile.listPrice ?? 0
    const pb = b.tile.listPrice ?? 0
    if (pb !== pa) return pb - pa
    return a.tile.listingKey.localeCompare(b.tile.listingKey)
  })
  const best = candidates[0]!
  return { src: (best.tile.photoUrl ?? '').trim(), address: (best.address ?? '').trim() }
}

/**
 * The opening image, chosen off the ladder. Every argument is something the
 * page already holds; nothing here reads.
 */
export function platOpeningPhoto(input: {
  ownPosterSrc?: string | null
  resortPosterSrc?: string | null
  resortLabel?: string | null
  listingPhoto?: { src: string; address: string } | null
  groundSrc?: string | null
}): PlatOpeningPhoto | null {
  const own = (input.ownPosterSrc ?? '').trim()
  if (own) return { kind: 'own', src: own }
  const resort = (input.resortPosterSrc ?? '').trim()
  const resortLabel = (input.resortLabel ?? '').trim()
  if (resort && resortLabel) return { kind: 'resort', src: resort, resortLabel }
  if (input.listingPhoto) return { kind: 'listing', ...input.listingPhoto }
  const ground = (input.groundSrc ?? '').trim()
  if (ground) return { kind: 'ground', src: ground }
  return null
}
