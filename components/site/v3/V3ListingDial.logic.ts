/**
 * V3ListingDial — the pure half. Index arithmetic, the position readout, the
 * key map, the swipe rule and the thumbnail's accessible name live here so the
 * unit suite can hold them without a DOM.
 *
 * THE DIAL WRAPS. Matt named it a dial (2026-09-23), and a dial has no end
 * stop: Next on the last home turns to the first, Previous on the first turns
 * to the last. That is also the WAI-ARIA tabs pattern's arrow-key rule
 * (focus moves from the last tab to the first), so the buttons, the keys and
 * a swipe all move the same way. Home and End are the two absolute moves.
 */

/** `index` folded into 0..count-1. A count under 1 has no position: 0. */
export function dialWrap(index: number, count: number): number {
  if (!Number.isFinite(count) || count < 1) return 0
  const n = Math.floor(count)
  const i = Math.trunc(Number.isFinite(index) ? index : 0)
  return ((i % n) + n) % n
}

/** One turn of the dial: `delta` steps from `index`, wrapping at both ends. */
export function dialStep(index: number, delta: number, count: number): number {
  return dialWrap(index + delta, count)
}

/**
 * The index a key moves the selection to, or null when the key is not the
 * dial's. Both axes are honoured in both layouts: the rail stands vertical
 * beside the card on a wide screen and lies horizontal under it on a phone,
 * and a reader should not have to know which one they are looking at.
 */
export function dialKeyTarget(key: string, index: number, count: number): number | null {
  if (count < 2) return null
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return dialStep(index, 1, count)
    case 'ArrowUp':
    case 'ArrowLeft':
      return dialStep(index, -1, count)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export type DialPosition = {
  /** 1-based position shown to the reader. */
  shown: number
  count: number
  /** "03" */
  now: string
  /** "12" */
  total: string
  /** "03 / 12", the same readout HomeRailPosition prints on the rails. */
  text: string
  /** shown / count, 0..1: how far the hairline under the readout fills. */
  fraction: number
}

/** The "03 / 12" readout for the whole dial. Null when there is nothing to count through. */
export function dialPosition(index: number, count: number): DialPosition | null {
  if (!Number.isFinite(count) || count < 2) return null
  const n = Math.floor(count)
  const shown = dialWrap(index, n) + 1
  const now = pad2(shown)
  const total = pad2(n)
  return { shown, count: n, now, total, text: `${now} / ${total}`, fraction: shown / n }
}

/** The smallest horizontal travel, in CSS px, that counts as a swipe. */
export const DIAL_SWIPE_MIN_PX = 40

/**
 * A finished touch on the lead photograph: +1 (swiped left, the next home),
 * -1 (swiped right, the previous one), or 0 (a tap, or a mostly vertical drag,
 * which is the page scrolling and must not turn the dial).
 */
export function dialSwipeDelta(dx: number, dy: number, minPx = DIAL_SWIPE_MIN_PX): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  if (Math.abs(dx) < minPx) return 0
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** Shown when the row has no ask to publish (never "Price on request"). */
export const DIAL_NO_ASK = 'Price not published'

/**
 * What the dial prints in the price slot, and whether it is a withheld line
 * rather than a figure (the card sets it quieter). A commercial lease prints
 * its rate with the unit, or its own withheld line; a sale listing its ask, or
 * DIAL_NO_ASK. `lease` is publishListingCardFacts' own, never built here.
 */
export function dialPriceSlot(facts: {
  ask: string | null
  lease: { rate: string | null; text: string } | null
}): { text: string; withheld: boolean } {
  if (facts.lease) return { text: facts.lease.text, withheld: facts.lease.rate == null }
  if (facts.ask) return { text: facts.ask, withheld: false }
  return { text: DIAL_NO_ASK, withheld: true }
}

/**
 * A thumbnail's accessible name: the ask, then the street, in the order the
 * thumbnail prints them, so the visible caption is inside the name
 * (WCAG 2.5.3). "$649,000, 1234 NW Portland Ave".
 */
export function dialThumbLabel(addressLine: string, ask: string | null): string {
  const address = addressLine.trim()
  const price = ask?.trim() || DIAL_NO_ASK
  return address ? `${price}, ${address}` : price
}

/** The id of one thumbnail tab and of the card panel it controls. */
export function dialTabId(dialId: string, index: number): string {
  return `${dialId}-tab-${index}`
}

export function dialPanelId(dialId: string, index: number): string {
  return `${dialId}-card-${index}`
}

/**
 * The scroll offset that brings item [start, start+size) fully into a
 * scroller of `viewport` length currently at `scroll`, centring it when it has
 * to move, and leaving the rail where it is when the item is already whole.
 * Returns the new offset (unclamped low bound 0).
 */
export function dialRevealOffset(
  scroll: number,
  viewport: number,
  start: number,
  size: number,
): number {
  if (start >= scroll && start + size <= scroll + viewport) return scroll
  return Math.max(0, Math.round(start - (viewport - size) / 2))
}
