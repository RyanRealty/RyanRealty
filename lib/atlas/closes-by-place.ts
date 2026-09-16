/**
 * Closes by place — the sales wash's own subject, as a count.
 *
 * A map that withholds the sales-heat field (the region index: at Central
 * Oregon scale the kernel field covered the town silhouettes and read as "a
 * blurred point-density heatmap", SITE-92 2026-09-16) still owes the reader
 * what the field would have said. This counts the heat window's closes by the
 * place that holds them so the dock can list them as numbers under the key.
 *
 * Honest sums, by construction:
 *   - a closing counts ONCE, in the smallest place that holds it (nested
 *     outlines — a subdivision inside a city — never double a close);
 *   - a closing outside every drawn outline is counted in `outside`, named
 *     by the caller, never silently dropped;
 *   - the rows are the fullest places first, capped, and `placesMore` says
 *     how many more places had at least one close so the cap is visible.
 *
 * Pure: no DOM, no React. The Atlas hands it the dots, the per-dot membership
 * it already computed, the reader's live filter and its smallest-shape rule.
 */

export const CLOSES_BY_PLACE_ROWS = 8

export type ClosesByPlaceRow<S> = { shape: S; n: number }

export type ClosesByPlace<S> = {
  /** Places with at least one close, fullest first, at most `rows`. */
  rows: ClosesByPlaceRow<S>[]
  /** Closes inside some drawn outline (the sum over every place, shown or not). */
  counted: number
  /** Places with at least one close that the cap left off the list. */
  placesMore: number
  /** Closes the filter kept that fall outside every drawn outline. */
  outside: number
}

export function closesByPlace<D extends { s: string }, S extends { id: string; name: string }>(args: {
  dots: readonly D[]
  /** For each dot index, the ids of every shape whose rings hold it. */
  membership: readonly (readonly string[])[]
  shapes: readonly S[]
  /** The reader's live filter (types, price) — the one every layer shares. */
  isOn: (d: D) => boolean
  /** Which statuses are a close. */
  isClosing: (status: string) => boolean
  /** The one place among several nested holders — the smallest by area. */
  ownerOf: (ids: readonly string[]) => string
  rows?: number
}): ClosesByPlace<S> {
  const { dots, membership, shapes, isOn, isClosing, ownerOf } = args
  const cap = Math.max(0, Math.floor(args.rows ?? CLOSES_BY_PLACE_ROWS))
  const byId = new Map<string, number>()
  let counted = 0
  let outside = 0
  dots.forEach((d, i) => {
    if (!isClosing(d.s) || !isOn(d)) return
    const ids = membership[i] ?? []
    if (ids.length === 0) {
      outside += 1
      return
    }
    const owner = ids.length > 1 ? ownerOf(ids) : ids[0]!
    byId.set(owner, (byId.get(owner) ?? 0) + 1)
    counted += 1
  })
  const all = shapes
    .flatMap((shape) => {
      const n = byId.get(shape.id) ?? 0
      return n > 0 ? [{ shape, n }] : []
    })
    .sort((a, b) => b.n - a.n || a.shape.name.localeCompare(b.shape.name))
  return {
    rows: all.slice(0, cap),
    counted,
    placesMore: Math.max(0, all.length - cap),
    outside,
  }
}
