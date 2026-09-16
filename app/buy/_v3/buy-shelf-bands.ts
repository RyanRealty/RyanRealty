/**
 * The /buy fold shelf's asking-price bands.
 *
 * WHY THIS EXISTS. /buy's job is helping someone buy a house, and the first
 * question every buyer arrives with is what their number gets them. The shelf
 * under the hero used to be whatever twelve photographed houses the local pool
 * returned first — on 2026-09-16 that was $1,875,000, $1,119,000, $1,180,000,
 * $998,000 across the whole first viewport, which answers that question with
 * "not this". Sorting the shelf by ask and letting the reader pick a band is
 * the brush TASTE.md names ("brush a price range"), built on the house
 * segmented control (V3ChartSwitch), whose panels stay in the DOM when hidden —
 * so every listing href on this page is still crawlable whichever band is open.
 *
 * NO NEW DATA AND NO AGGREGATE (CLAUDE.md section 0 / section 7). This function
 * reads `card.price`, which is the tile's own `ListPrice` already published on
 * the card face, and does nothing but sort and partition. It computes no
 * median, no average, no count that leaves this shelf, and it never labels a
 * band with a figure it did not receive.
 */
import type { HomeRailCard } from '@/app/_v3/home-rail-items'

export type BuyShelfBand = {
  key: string
  /** What a buyer says, not a range expression: "Under $600K". */
  label: string
  cards: HomeRailCard[]
}

/**
 * Plain ladder rungs, in the round numbers Central Oregon buyers actually use
 * when they say what they are looking for. Fixed on purpose: a ladder derived
 * from the twelve cards on screen would relabel itself every refresh, and a
 * chip whose meaning moves is worse than no chip.
 */
const LADDER: ReadonlyArray<{ key: string; label: string; min: number; max: number }> = [
  { key: 'under-600', label: 'Under $600K', min: 0, max: 600_000 },
  { key: '600-900', label: '$600K to $900K', min: 600_000, max: 900_000 },
  { key: '900-1500', label: '$900K to $1.5M', min: 900_000, max: 1_500_000 },
  { key: 'over-1500', label: '$1.5M and up', min: 1_500_000, max: Number.POSITIVE_INFINITY },
]

/** Cheapest first. A buyer's shelf opens at the bottom of the range, not the top. */
export function sortByAsk(cards: readonly HomeRailCard[]): HomeRailCard[] {
  return [...cards].sort((a, b) => {
    const pa = a.price ?? Number.POSITIVE_INFINITY
    const pb = b.price ?? Number.POSITIVE_INFINITY
    return pa - pb
  })
}

/** A band earns a chip at two houses; one house behind a filter is a dead end. */
export const BAND_FLOOR = 2

/**
 * `[]` when the shelf does not span enough of the ladder to be worth brushing —
 * the caller then renders one plain track. Otherwise "Any price" first, holding
 * every card, then each populated rung in ladder order.
 */
export function buyShelfBands(cards: readonly HomeRailCard[]): BuyShelfBand[] {
  const sorted = sortByAsk(cards)
  const rungs = LADDER.map((rung) => ({
    key: rung.key,
    label: rung.label,
    cards: sorted.filter(
      (card) => card.price != null && card.price >= rung.min && card.price < rung.max,
    ),
  })).filter((rung) => rung.cards.length >= BAND_FLOOR)

  if (rungs.length < 2) return []
  return [{ key: 'any', label: 'Any price', cards: sorted }, ...rungs]
}
