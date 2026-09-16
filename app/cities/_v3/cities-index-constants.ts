/**
 * Cities index constants. Featured slugs are the ones with a verified
 * cityHero() in lib/geo-images.ts (Family 4). Sentence fallbacks are
 * geographic facts, not market claims.
 */

import { formatCount } from '@/lib/format/count'

export const FEATURED_CITY_SLUGS = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'terrebonne',
  'prineville',
  'madras',
  'powell-butte',
  'crooked-river-ranch',
  'culver',
] as const

export const FEATURED_PULSE_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Sun River',
  'La Pine',
  'Lapine',
  'Tumalo',
  'Terrebonne',
  'Prineville',
  'Madras',
  'Powell Butte',
  'Crooked River Ranch',
  'Culver',
] as const

export const CITY_SENTENCE_FALLBACK: Record<string, string> = {
  'la-pine': 'Larger lots and ponderosa forest at the southern end of Deschutes County.',
  tumalo: 'An unincorporated community on the Deschutes River between Bend and Sisters, with acreage lots and river access.',
  terrebonne: 'Home to Smith Rock State Park, with farm parcels above the Crooked River canyon.',
  'powell-butte': 'Ranch and acreage country between Bend and Prineville, with open Cascade views.',
  culver: 'A farm town near Lake Billy Chinook and The Cove Palisades State Park.',
  'crooked-river-ranch': 'A canyon-rim community with its own golf course between Terrebonne and Madras.',
}

export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}

/**
 * A row's bar length for V3Ledger encode="bar": the SQUARE ROOT of its share
 * of the largest live count in the same directory (SITE-92 round 4).
 *
 * One linear scale keyed to Bend made every other city's bar a sliver — 616
 * against 5 is a 1.5% bar, the encode's own floor, so a reader could not tell
 * Camp Sherman's five from Metolius's four or from an unmeasured row. On a
 * square-root scale the same 5 is a 9% bar and 146 is 49%: a small count stays
 * legible and the order of magnitude is still read as length, half the length
 * being a quarter of the count. The scale is SAID on the drawing — the ledger
 * prints INDEX_BAR_SCALE_NOTE and a ruler with indexBarTicks() over the bar
 * column — because a transformed scale a reader cannot see is a lie about
 * magnitude, and the figure beside each bar is always the count itself.
 */
export function indexBarWeight(count: number | null | undefined, max: number): number | undefined {
  if (count == null || !Number.isFinite(count) || !(max > 0)) return undefined
  if (count <= 0) return 0
  return Math.min(1, Math.sqrt(count / max))
}

/** The sentence the ledger prints beside the ruler, so the scale is on the drawing. */
export const INDEX_BAR_SCALE_NOTE =
  'Bars are on a square-root scale so a small town still shows: a bar half as long is a quarter of the count. The ticks mark the count at that length; the figure beside each bar is the count itself.'

/** Round counts a tick may land on, smallest first. */
const INDEX_BAR_TICK_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const

/**
 * The ruler's ticks for a directory whose largest count is `max`: up to three
 * round counts spread across the steps below the top, then the top itself at
 * the full track. Each `at` is the tick's position on the SAME square-root
 * scale indexBarWeight() draws the bars on, so a tick sits exactly where a bar
 * of that count would end. `count` is the raw figure; the caller formats it.
 */
export function indexBarTicks(max: number): { at: number; count: number }[] {
  if (!Number.isFinite(max) || !(max > 0)) return []
  // Below 72% of the top so a tick's label never runs into the top's label
  // (sqrt(0.72) puts the last inner tick at or before 85% of the track).
  const inner = INDEX_BAR_TICK_STEPS.filter((v) => v < max * 0.72)
  const picked =
    inner.length <= 3
      ? inner
      : [inner[0]!, inner[Math.floor(inner.length / 2)]!, inner[inner.length - 1]!]
  return [
    ...picked.map((count) => ({ at: Math.sqrt(count / max), count })),
    { at: 1, count: max },
  ]
}

export function liveForSaleLabel(count: number): string {
  return count > 0 ? `${formatCount(count)} for sale` : 'None listed now'
}

/**
 * The value when no source published a count for the row. Unknown is not
 * zero: until SITE-52 the index printed a null count as "None listed now",
 * which claims an empty market the data never established (CLAUDE.md §0).
 */
export const NO_LIVE_COUNT_LABEL = 'No live count'
