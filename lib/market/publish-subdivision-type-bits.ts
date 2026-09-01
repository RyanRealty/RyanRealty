/**
 * publish-subdivision-type-bits — the "Subdivision 1 has 5 townhomes" line on
 * a parent place's Subdivisions ledger (Matt, 2026-09-01: "on each of the
 * subdivisions, it'll be broken out as well").
 *
 * ONE SOURCE (CLAUDE.md §0): the bits are the SAME Market Truth recorded-plat
 * segment rows the destination /subdivisions/[slug] page prints as its
 * property-type run (getSubdivisionCounts extras). A ledger row can therefore
 * never disagree with the page it opens. The detached count is NOT repeated
 * here — the row's live "N active" line already carries single-family from
 * the live-MLS bin; extras are the OTHER property types by construction.
 *
 * A miss publishes nothing: a failed or empty read returns no bits, never a
 * zero (§0 unknown-is-not-zero).
 */

import {
  getSubdivisionCountsForSlugs,
  type SubdivisionCounts,
} from '@/lib/data/market-truth/subdivision-counts'
import { publicSegmentNoun } from '@/lib/data/market-truth/public-segments'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

/** "2 townhomes · 1 condo" from the plat's own segment counts, or null. */
export function publishSubdivisionTypeBits(counts: SubdivisionCounts): string | null {
  const bits = counts.extras
    .filter((e) => e.activeCount != null && e.activeCount >= 1)
    .map((e) => `${e.activeCount} ${publicSegmentNoun(e.segment, e.activeCount ?? 0)}`)
  return bits.length > 0 ? bits.join(' · ') : null
}

/**
 * Timeout-guarded bits for a set of plat slugs (a parent place's children).
 * ONE metric read for the whole set (getSubdivisionCountsForSlugs) — a
 * per-slug fan-out here multiplied into a 250-query storm that held the
 * neighborhood page stream open for minutes (Larkspur, 2026-09-01). Slugs
 * that publish nothing are absent from the map; a failed read returns an
 * empty map (no bits, never zeros).
 */
export async function loadSubdivisionTypeBits(
  slugs: readonly string[],
  timeoutMs = 3500,
): Promise<Map<string, string>> {
  const countsBySlug = await withTimeoutFallback(
    getSubdivisionCountsForSlugs(slugs),
    new Map<string, SubdivisionCounts>(),
    timeoutMs,
    'type-bits',
  )
  const out = new Map<string, string>()
  for (const [slug, counts] of countsBySlug) {
    const bits = publishSubdivisionTypeBits(counts)
    if (bits) out.set(slug, bits)
  }
  return out
}
