/**
 * What a listing photo shows, read from the words its listing files with it.
 *
 * WHY (2026-10-01, /commercial-space-for-lease). A listing's MLS payload carries
 * every photo with the file name the agent uploaded (`Photos[].Name`) and an
 * optional caption (`Photos[].Caption`). On commercial leases the lead image is
 * often not a photograph of the space at all: Redmond's largest lease led with
 * "Lot Line Adjustments" (an aerial with plat lines drawn on it), and 423 SW
 * 6th Street led with "423 SW 6th street view2" (a Google Street View frame),
 * then "423 SW 6th St Aerial2", then "reimagined as a bike shop" (captioned "AI
 * reimagined as a bike shop"). A card that leads with one of those shows the
 * reader a map, a drawing or a picture of a building that does not exist.
 *
 * THE RULE. A photo is a `photograph` unless its own name or caption says it
 * is something else:
 *   - `capture`  a frame from a map service: Street View, an aerial or
 *                satellite frame, a map, Google, a screenshot;
 *   - `drawing`  a plan: site, floor or plot plan, lot lines or a lot
 *                boundary, a plat, a survey, a site map;
 *   - `render`   an image made, not taken: AI, "reimagined", a rendering,
 *                virtual staging;
 *   - `stand-in` a photo of somewhere else: "representative", "similar unit".
 * Only the listing's own words decide it, never a guess from pixels, so a
 * photo whose name says nothing ("IMG_1821", "DJI_0006") is a photograph.
 * Nothing is rewritten: the listing page still shows every photo as filed.
 */

export type ListingPhotoKind = 'photograph' | 'capture' | 'drawing' | 'render' | 'stand-in'

/** One photo as the listing files it. */
export type ListingPhotoFiled = {
  name?: string | null
  caption?: string | null
  url?: string | null
}

const CAPTURE = /\bstreet\s*-?\s*view|\bstreetview|\baerial|\bsatellite\b|\bgoogle\b|\bscreen\s*-?\s*shot|\bmaps?\b/i
const DRAWING =
  /\b(?:site|floor|plot)\s*-?\s*plans?\b|\bfloorplans?\b|\b(?:lot|property|parcel)\s+(?:lines?|boundar(?:y|ies))\b|\blot\s+line\s+adjustments?\b|\bplat\b|\bsurvey\b|\bsite\s+map\b/i
const RENDER = /\bai\b|\breimagin|\brender(?:ed|ing|ings|s)?\b|\bvirtual(?:ly)?\s*-?\s*stag/i
const STAND_IN = /\brepresentative\b|\bsimilar\s+(?:unit|space|suite|home|building)\b|\bstock\s+photo\b/i

export function listingPhotoKind(photo: Pick<ListingPhotoFiled, 'name' | 'caption'>): ListingPhotoKind {
  const words = `${photo.name ?? ''} \n ${photo.caption ?? ''}`
  if (RENDER.test(words)) return 'render'
  if (DRAWING.test(words)) return 'drawing'
  if (CAPTURE.test(words)) return 'capture'
  if (STAND_IN.test(words)) return 'stand-in'
  return 'photograph'
}

/**
 * The first photo, in the listing's own order, that is a photograph of the
 * property (its URL), or null when the listing files none: a card then shows
 * its no-photograph face rather than a map, a plan or a render.
 */
export function listingLeadPhotograph(photos: readonly ListingPhotoFiled[]): string | null {
  for (const photo of photos) {
    const url = photo.url?.trim()
    if (!url) continue
    if (listingPhotoKind(photo) === 'photograph') return url
  }
  return null
}
