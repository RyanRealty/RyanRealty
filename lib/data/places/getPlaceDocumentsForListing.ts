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
 * WHY MATCH THE LABEL, NOT A SLUG. `boundaries` and `place_membership` are not
 * readable by the anon role (place_membership is 2.68M rows and stays
 * server-side), and the listing page is the highest-traffic public surface in
 * the app — not somewhere to reach for a service-role client. So the plat has to
 * be resolved from what the listing row itself holds, and what it holds is
 * `boundaries.geo_label`, verbatim: refresh_listing_boundary_tags copies the
 * label and discards the slug. `place_document_link.geo_label` carries the same
 * string, so the two are compared directly.
 *
 * WHAT THIS REPLACED, AND WHY. This function used to re-derive the plat slug by
 * running lib/slug.ts `slugify()` over that label. `slugify()` is not the
 * function that minted `boundaries.geo_slug`, and measured 2026-08-26 over all
 * 3,218 `geo_type='subdivision'` rows it fails to reproduce the slug on 202 of
 * them (6.3%), across two classes:
 *
 *   punctuation (187) — geo_slug turns '&' into 'and' and every other
 *   non-alphanumeric run into a hyphen; slugify() deletes them.
 *   'Redmond Vacation Alley Blocks 1 & 20' is
 *   `redmond-vacation-alley-blocks-1-and-20`, slugify says
 *   `redmond-vacation-alley-blocks-1-20`; 'B.r.p.p.d.' is `b-r-p-p-d`, slugify
 *   says `brppd`. 98 listing rows across 53 labels sit on one of these plats
 *   and could never resolve, whatever we publish for them.
 *
 *   duplicated labels (15) — the county files more than one plat under one
 *   name, so all but one carry a numeric suffix ('Bend' is `bend`,
 *   `bend-05281` AND `bend-16913'). The comment that stood here claimed the
 *   bare form they slugify to "is not any plat's slug", so the failure was
 *   safe. That was wrong: in all 13 duplicated-label groups ONE row holds the
 *   bare slug, so all 15 suffixed plats resolved onto a REAL, DIFFERENT
 *   recorded plat. Only 'Evergreen Park' among them has a published document
 *   today, and its collision target is linked to the same instrument, so
 *   nothing wrong ever reached a page — a property of the current corpus, not
 *   of the code.
 *
 * The slug path is kept as a fallback, so a link row the backfill has not
 * stamped yet answers exactly as it did before.
 */

import { slugify } from '@/lib/slug'
import {
  getPlaceDocuments,
  getPlaceDocumentsByPlatLabel,
  type PlaceDocument,
} from '@/lib/data/places/getPlaceDocuments'

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

  const byLabel = await getPlaceDocumentsByPlatLabel('subdivision', label)
  if (byLabel) {
    return { geoSlug: byLabel.geoSlug, platName: label, documents: byLabel.documents }
  }

  const geoSlug = slugify(label)
  if (!geoSlug || geoSlug === 'unknown') return null

  const documents = await getPlaceDocuments('subdivision', geoSlug)
  if (documents.length === 0) return null

  return { geoSlug, platName: label, documents }
}
