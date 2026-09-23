/**
 * getPlatParentCommunity — the registry community a recorded plat sits in,
 * read as the INVERSE of the membership the community page already publishes.
 *
 * WHY (SITE-183 / SITE-182, GSC 2026-08-24..09-20). "broken top homes for
 * sale" split 48% /communities/broken-top against three plat pages at 14%
 * each (ridge-, courtyard-garages-, tennis-tracts-at-broken-top); "tetherow
 * homes for sale" gave 16% to /subdivisions/golf-homes-at-tetherow. Each plat
 * page linked its parent only by bare name, in the sitewide resort list,
 * because nothing on the plat side knew the parent: the registry alias match
 * (subdivision_aliases) names two plats for Tetherow and none for Broken Top,
 * and the county plat tree (getPlatBoundaryCity) parents Broken Top's plats
 * to the Century West neighborhood and Tetherow's to nothing (public.boundaries
 * chain, read 2026-09-23). Meanwhile /communities/broken-top lists 49 member
 * plats and /communities/tetherow 22, tennis-tracts and golf-homes among them,
 * through the community_subdivisions RPC (plat centroid inside the community
 * polygon). The community claims the plat; the plat did not claim the
 * community. This is the same relation read from the plat's side.
 *
 * SOURCE. getCommunitySubdivisions (cached per community on the geo window)
 * for each registry community, in registry order, until one lists the plat.
 * Cold cost is at most one RPC per registry community; warm, every read is a
 * cache hit the community pages already paid for. A read that fails throws,
 * so a transient error is "unknown" at the page (withTimeoutFallback → null),
 * never a wrong parent (§0). No plat is claimed by name resemblance: a plat
 * called "Tetherow Crossing" in Redmond is not inside Tetherow's polygon and
 * does not resolve here.
 */

import { getAllResortCommunities, type ResortCommunityEntry } from '@/lib/data/communities/registry'
import { getCommunitySubdivisions } from '@/lib/data/geo/getCommunitySubdivisions'

export type PlatParentCommunity = {
  /** Durable registry slug (the RPC's geo key; the visitor URL is the public pair). */
  slug: string
  label: string
}

/** Pure resolution over a member-list reader, so the test drives it without a client. */
export async function resolvePlatParentCommunity(
  platSlug: string,
  entries: readonly Pick<ResortCommunityEntry, 'slug' | 'label'>[],
  readMemberSlugs: (communitySlug: string) => Promise<readonly string[]>,
): Promise<PlatParentCommunity | null> {
  const key = platSlug.trim().toLowerCase()
  if (!key) return null
  for (const entry of entries) {
    const slug = entry.slug.trim().toLowerCase()
    if (!slug) continue
    const members = await readMemberSlugs(slug)
    if (members.some((m) => m.trim().toLowerCase() === key)) {
      return { slug, label: entry.label.trim() }
    }
  }
  return null
}

export async function getPlatParentCommunity(platSlug: string): Promise<PlatParentCommunity | null> {
  return resolvePlatParentCommunity(platSlug, getAllResortCommunities(), async (communitySlug) => {
    const members = await getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: communitySlug })
    return members.map((m) => m.slug)
  })
}
