/**
 * The robots verdict for /subdivisions/[slug], when the reads behind it can fail.
 *
 * THE RULE IS R-123 AND IT DOES NOT MOVE HERE: a plat is index,follow only with
 * a recorded GIS polygon AND at least SUBDIVISION_INDEX_MIN_LIFETIME_SALES
 * lifetime closed sales inside it — the set getIndexableSubdivisions() builds,
 * which the sitemap and llms.txt submit.
 *
 * WHAT THIS FILE ADDS (P3 — DATA-6, SEO-2, 2026-09-23) is what the head does
 * when that set did not answer. getIndexableSubdivisions() falls back to [] for
 * the render on a double failure, and the head used to read [] as "this plat is
 * not indexable" and publish noindex — on an indexable, sitemapped URL, into an
 * ISR copy a crawler can fetch. Google acts on noindex by dropping the URL;
 * getting it back takes a recrawl. So an unanswered set is UNKNOWN, never "no":
 *   1. The set answered (non-empty; a real set is never empty — its own fetch
 *      throws on empty) → membership decides, as before.
 *   2. The set did not answer, but the page's own boundary read did and found
 *      no polygon → noindex. No polygon is never indexable, from either source.
 *   3. The set did not answer, but the plat's closed-count row set did →
 *      apply the same threshold to this plat's row. Every row of
 *      subdivision_plat_closed_mv is built by joining `boundaries`, so a row
 *      carries a polygon by construction.
 *   4. Nothing answered → index,follow, `known: false`. The caller shortens
 *      the copy's ISR lifetime so the real verdict replaces it within a minute.
 *      A below-floor plat briefly indexable costs far less than an indexable
 *      one briefly noindexed.
 */
import {
  SUBDIVISION_INDEX_MIN_LIFETIME_SALES,
  type IndexableSubdivision,
  type PlatClosedCount,
} from '@/lib/data/subdivisions/subdivision-index'

export type PlatRobotsVerdict = {
  noindex: boolean
  /** false only in case 4: the verdict is a default, not a reading. */
  known: boolean
  /** The plat's indexable-set row when the set answered and holds it. */
  entry: IndexableSubdivision | null
  /** Which of the four cases decided. */
  basis: 'indexable-set' | 'no-polygon' | 'plat-closed-count' | 'unknown'
}

export function decidePlatRobots(input: {
  slug: string
  /** The indexable set, or null when the read timed out or fell back to []. */
  indexableSet: readonly IndexableSubdivision[] | null
  /** The closed-count row set, or null when that read did not answer. */
  platClosedCounts: readonly PlatClosedCount[] | null
  /** The page's own boundary read: true/false when it answered, null when it did not. */
  hasPolygon: boolean | null
  minLifetimeSales?: number
}): PlatRobotsVerdict {
  const slug = input.slug.trim().toLowerCase()
  const floor = input.minLifetimeSales ?? SUBDIVISION_INDEX_MIN_LIFETIME_SALES

  if (input.indexableSet && input.indexableSet.length > 0) {
    const entry = input.indexableSet.find((s) => s.slug === slug) ?? null
    return { noindex: entry == null, known: true, entry, basis: 'indexable-set' }
  }
  if (input.hasPolygon === false) {
    return { noindex: true, known: true, entry: null, basis: 'no-polygon' }
  }
  if (input.platClosedCounts && input.platClosedCounts.length > 0) {
    const row = input.platClosedCounts.find((r) => r.slug === slug)
    const closed = row?.closedCount ?? 0
    return { noindex: closed < floor, known: true, entry: null, basis: 'plat-closed-count' }
  }
  return { noindex: false, known: false, entry: null, basis: 'unknown' }
}

/** A set read that answered with rows, or null (timed out, threw, or fell back to []). */
export function answeredRows<T>(read: { ok: boolean; value: readonly T[] }): readonly T[] | null {
  return read.ok && read.value.length > 0 ? read.value : null
}
