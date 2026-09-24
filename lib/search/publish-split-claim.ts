/**
 * The split view's claim line: how many homes, where, and what the rail is
 * holding. SITE-44 put the claim over the rail; this is its publisher, so the
 * count rule is pinned by tests instead of living in JSX.
 *
 * THE RULE (Matt 2026-09-23, §0). The figure is the frame's real count. The
 * split view reads at most a display cap of rows (500 pins, and the regional
 * frame serves its first card page before the pins arrive), so a claim built
 * from the rows in hand read "491 homes on this map" over a frame that held
 * more. When the rows in hand fall short of the count:
 *   - the figure is the exact totalCount from the DAL,
 *   - the tail names the order the held rows came in ("newest listed first"), not an
 *     ask range, because a range over the first 500 is not the frame's range,
 *   - a note says how many are on the map (or listed, before the map mounts).
 * When every row is in hand the line is what it was: the drawn count and the
 * ask range across it.
 */
import { formatCount } from '@/lib/format/count'

/**
 * Sort value (SearchFilters SORT_OPTIONS) -> the order the held rows follow.
 * `newest` orders by the on-market date (lib/search/search-sort-order.ts,
 * Matt 2026-09-23), so the line says "newest listed first", not "newest
 * first", which could read as the latest MLS edit.
 */
export const SORT_ORDER_PHRASES: Readonly<Record<string, string>> = {
  newest: 'newest listed first',
  oldest: 'oldest listed first',
  price_asc: 'lowest price first',
  price_desc: 'highest price first',
  price_per_sqft_asc: 'lowest price per sq ft first',
  price_per_sqft_desc: 'highest price per sq ft first',
  year_newest: 'newest built first',
  year_oldest: 'oldest built first',
}

export function sortOrderPhrase(sort: string | null | undefined): string {
  const key = sort?.trim() || 'newest'
  return SORT_ORDER_PHRASES[key] ?? SORT_ORDER_PHRASES.newest
}

export type SplitClaim = {
  /** The number the line leads with. */
  figure: number
  /** 'home' | 'homes', agreeing with `figure`. */
  noun: 'home' | 'homes'
  /** ' in Central Oregon' for the regional frame, else ' on this map'. */
  where: string
  /** True when the rows in hand are fewer than the frame's count. */
  truncated: boolean
  /** Ask range across the held rows; only when nothing is held back. */
  range: { low: number; high: number } | null
  /** The held rows' order, only when truncated: 'newest listed first'. */
  order: string | null
  /** 'first 500 on the map' / 'first 48 listed', only when truncated. */
  note: string | null
  /** The section 0 trace behind the "Source" disclosure. */
  source: string
}

export function publishSplitClaim(input: {
  /** Rows the list and pins draw (after the viewer's hidden homes). */
  visibleCount: number
  /** Rows the fetch returned (before hidden homes). */
  rowsInHand: number
  /** The DAL's exact count for the frame and filters. */
  totalCount: number
  sort: string | null | undefined
  /** 'Central Oregon' for the regional frame; null for a map frame. */
  frameLabel: string | null
  /** False while the map has not mounted (phones open on the list). */
  mapMounted: boolean
  low: number | null
  high: number | null
  /** Held rows that publish a whole-property ask (the range population). */
  askCount: number
  /** Rows behind the $/sq ft band, when one is drawn. */
  bandCount: number | null
}): SplitClaim | null {
  const total = Math.max(0, Math.floor(input.totalCount))
  const visible = Math.max(0, Math.floor(input.visibleCount))
  const truncated = input.rowsInHand < total
  const figure = truncated ? total : visible
  if (figure <= 0) return null

  const where = input.frameLabel ? ` in ${input.frameLabel}` : ' on this map'
  const range =
    !truncated && input.low != null && input.high != null ? { low: input.low, high: input.high } : null
  const order = truncated ? sortOrderPhrase(input.sort) : null
  const note = truncated
    ? `first ${formatCount(visible)} ${input.mapMounted ? 'on the map' : 'listed'}`
    : null

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
  const scope = input.frameLabel
    ? `for ${input.frameLabel}, the service area this site covers`
    : 'for this map frame'
  const parts: string[] = [
    `Oregon Data Share, read live ${scope}: ${formatCount(total)} ${plural(total, 'listing matches', 'listings match')}.`,
  ]
  if (truncated) {
    parts.push(
      `The first ${formatCount(visible)}, ${order}, are ${input.mapMounted ? 'listed and pinned' : 'listed'}; that is the display cap, not the whole set.`,
    )
  } else if (range) {
    parts.push(
      `The range is the lowest and highest ask among the ${formatCount(input.askCount)} of them that publish a whole-property price; a fractional share and a commercial lease rate are withheld.`,
    )
  }
  if (input.bandCount != null && input.bandCount > 0) {
    parts.push(
      `The band on each card is the middle half of the ${formatCount(input.bandCount)} ${truncated ? 'shown' : 'here'} that publish a price per square foot.`,
    )
  }

  return {
    figure,
    noun: figure === 1 ? 'home' : 'homes',
    where,
    truncated,
    range,
    order,
    note,
    source: parts.join(' '),
  }
}
