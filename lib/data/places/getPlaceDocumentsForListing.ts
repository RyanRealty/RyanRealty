/**
 * getPlaceDocumentsForListing — the recorded governing documents for the plat a
 * listing actually sits in.
 *
 * The plat comes from `boundary_subdivision`, which the listing row already
 * carries and which is derived from the recorded plat POLYGON — not from the
 * MLS `SubdivisionName` text. That distinction is the whole point of this file.
 * MLS subdivision names are free text, they collide across the county, and they
 * disagree with the plat: the listing at 919 Bond is filed under
 * "919 Bond Condominium" while the recorded plat is "919 Bond Condominiums".
 * This is the page where a buyer is deciding about one specific house, so the
 * wrong plat's covenants here is worse than showing none.
 *
 * WHY SLUGIFY RATHER THAN LOOK THE SLUG UP. `boundaries` and `place_membership`
 * are not readable by the anon role (place_membership is 2.68M rows and stays
 * server-side), and the listing page is the highest-traffic public surface in
 * the app — not somewhere to reach for a service-role client. Slugifying the
 * boundary label reproduces `boundaries.geo_slug` on 3,198 of 3,213 plats,
 * measured. The 15 misses are labels that were duplicated and therefore carry a
 * numeric suffix in their slug ("Bend" -> "bend-16913"); the bare form they
 * slugify to is not any plat's slug, so those listings show NO documents rather
 * than the wrong ones. Missing is the safe failure here; wrong is not.
 */

import { slugify } from '@/lib/slug'
import { getPlaceDocuments, type PlaceDocument } from '@/lib/data/places/getPlaceDocuments'

export interface ListingPlaceDocuments {
  /** The plat slug the documents belong to, for the "see the plat" link. */
  geoSlug: string
  /** The recorded plat's own label, for display. */
  platName: string
  documents: PlaceDocument[]
}

export async function getPlaceDocumentsForListing(
  boundarySubdivision: string | null | undefined,
): Promise<ListingPlaceDocuments | null> {
  const label = (boundarySubdivision ?? '').trim()
  if (!label) return null

  const geoSlug = slugify(label)
  if (!geoSlug || geoSlug === 'unknown') return null

  const documents = await getPlaceDocuments('subdivision', geoSlug)
  if (documents.length === 0) return null

  return { geoSlug, platName: label, documents }
}
