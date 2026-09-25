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
 * through the community_subdivisions RPC (plat smaller than the community and
 * mostly inside its polygon). The community claims the plat; the plat did not
 * claim the community. This is the same relation read from the plat's side.
 *
 * SOURCE (SITE-208). One round trip: the `plat_parent_community` RPC
 * (migration 20260925130000) joins the plat row to every registry community's
 * neighborhood polygon in one statement, with the SAME membership test as the
 * live community_subdivisions body, and returns the first match in the order
 * the slugs were passed. This DAL passes the registry slugs in registry order,
 * so the answer is the community the old sequential walk stopped at, and the
 * label comes from the registry entry, never from the database.
 *
 * Before SITE-208 this walked the 19 registry communities one at a time,
 * awaiting getCommunitySubdivisions for each until one listed the plat: up to
 * 19 sequential RPCs on a cold render, and always 19 for a plat with no
 * parent (3,876 ms measured for tetherow-crossing; 107 ms now). A Sentry trace
 * on 2026-09-24 showed at least nine in a row on one /subdivisions/[slug]
 * render (Sentry "Consecutive HTTP" issues RYAN-REALTY-PLATFORM-3 to -8).
 * Equivalence with the walk was checked over every member plat of the 19
 * communities (464 plats, 0 mismatches) and 3 non-member plats; the numbers
 * sit in the migration header.
 *
 * Cached per plat on the geoNeighborhood window under the 'boundaries' tag.
 * A read that fails THROWS (never cached, never a wrong parent, §0), so a
 * transient error is "unknown" at the page (withTimeoutFallback → null). A
 * null parent is a real answer and is cached like any other. No plat is
 * claimed by name resemblance: a plat called "Tetherow Crossing" in Redmond is
 * not inside Tetherow's polygon and does not resolve here.
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'
import { supabaseAnon } from '@/lib/data/client'
import { getAllResortCommunities, type ResortCommunityEntry } from '@/lib/data/communities/registry'

export type PlatParentCommunity = {
  /** Durable registry slug (the RPC's geo key; the visitor URL is the public pair). */
  slug: string
  label: string
}

type RegistryEntry = Pick<ResortCommunityEntry, 'slug' | 'label'>

type RpcRow = { geo_slug: string }

/**
 * Registry entries with a usable slug, normalized, in registry order. The
 * order IS the tiebreak: the first community that claims the plat wins, on
 * both the reference walk and the RPC.
 */
function orderedEntries(entries: readonly RegistryEntry[]): { slug: string; label: string }[] {
  const out: { slug: string; label: string }[] = []
  for (const entry of entries) {
    const slug = entry.slug.trim().toLowerCase()
    if (!slug) continue
    out.push({ slug, label: entry.label.trim() })
  }
  return out
}

/**
 * REFERENCE RESOLVER, not on the request path. Pure resolution over a
 * member-list reader, walking the entries in order until one lists the plat.
 * It is the oracle the SITE-208 equivalence script
 * (scratchpad/site-208-equivalence.mts) runs against production: the member
 * lists come from the live community_subdivisions RPC, and every member plat's
 * answer here must equal the plat_parent_community RPC's. Kept exported so the
 * unit test and that script can drive it without a client.
 */
export async function resolvePlatParentCommunity(
  platSlug: string,
  entries: readonly RegistryEntry[],
  readMemberSlugs: (communitySlug: string) => Promise<readonly string[]>,
): Promise<PlatParentCommunity | null> {
  const key = platSlug.trim().toLowerCase()
  if (!key) return null
  for (const entry of orderedEntries(entries)) {
    const members = await readMemberSlugs(entry.slug)
    if (members.some((m) => m.trim().toLowerCase() === key)) {
      return { slug: entry.slug, label: entry.label }
    }
  }
  return null
}

async function fetchPlatParentCommunity(platSlug: string): Promise<PlatParentCommunity | null> {
  const entries = orderedEntries(getAllResortCommunities())
  if (entries.length === 0) return null

  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('plat_parent_community', {
    p_plat_slug: platSlug,
    p_community_slugs: entries.map((e) => e.slug),
  })

  if (error) {
    // THROW (do not return null) so unstable_cache never caches a transient
    // failure as "no parent" — same no-poison rule as the other geo DALs.
    console.error('[getPlatParentCommunity] RPC error:', { platSlug, error })
    throw new Error(`plat_parent_community RPC failed for ${platSlug}: ${error.message}`)
  }

  const parentSlug = ((data ?? []) as RpcRow[])[0]?.geo_slug
  if (!parentSlug) return null
  const entry = entries.find((e) => e.slug === parentSlug)
  // The RPC can only answer a slug it was given; a slug outside the list would
  // mean the function changed under us, and that is not a parent we can label.
  if (!entry) {
    throw new Error(`plat_parent_community answered ${parentSlug} for ${platSlug}, which is not a registry community`)
  }
  return { slug: entry.slug, label: entry.label }
}

export function getPlatParentCommunity(platSlug: string): Promise<PlatParentCommunity | null> {
  const key = platSlug.trim().toLowerCase()
  if (!key) return Promise.resolve(null)
  return unstable_cache(() => fetchPlatParentCommunity(key), ['plat-parent-community-v1', key], {
    revalidate: CACHE_WINDOWS.geoNeighborhood,
    tags: ['boundaries'],
  })()
}
