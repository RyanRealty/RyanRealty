/**
 * ONE MAP, THREE PIN FAMILIES (Delta 3, 2026-09-08).
 *
 * Matt: "we'll just have to make the map look cooler and put better pins on it
 * to show the comps and the expired or canceled as a different kind of subset.
 * We want to actually have the actives, the closed, and the expired or
 * canceled as three different icon sets."
 *
 * This file is the vocabulary the map and the three matrices share: the family
 * a home belongs to, the KEY that names its pin, and the outcome line the pin
 * and the matrix row both print. Keeping it here rather than in `map.ts` is
 * what stops the tile builder and the table drifting apart — a pin keyed `A`
 * and a row keyed `2` is a map that answers the wrong tap, and the interaction
 * layer matches on the key alone.
 *
 * Pure: no I/O, no network, no `render_args` shape assumptions beyond the
 * fields each builder is handed.
 */

/** The three sets the document shows, plus the reader's own home. */
export type CmaMapFamily = 'closed' | 'active' | 'unsold'

export const FAMILY_LABEL: Record<CmaMapFamily, string> = {
  closed: 'Closed sales — these set the price',
  active: 'For sale or under contract now',
  unsold: 'Came off the market unsold',
}

/**
 * The keys, one alphabet per family, so a reader never has to be told which
 * set a pin belongs to: numbers closed, letters for sale, roman came off.
 */
export function closedKey(i: number): string {
  return String(i + 1)
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function activeKey(i: number): string {
  // Past Z the letters double (AA, AB) rather than wrapping onto a key another
  // home already owns.
  if (i < LETTERS.length) return LETTERS[i]!
  const first = Math.floor(i / LETTERS.length) - 1
  return `${LETTERS[first] ?? 'Z'}${LETTERS[i % LETTERS.length]}`
}

const ROMAN: ReadonlyArray<[number, string]> = [
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
]

export function unsoldKey(i: number): string {
  let n = i + 1
  let out = ''
  for (const [value, sym] of ROMAN) {
    while (n >= value) {
      out += sym
      n -= value
    }
  }
  return out || 'i'
}

export function keyFor(family: CmaMapFamily, index: number): string {
  if (family === 'closed') return closedKey(index)
  if (family === 'active') return activeKey(index)
  return unsoldKey(index)
}

/** The glyph a pin of this family draws, read aloud for a screen reader. */
export const FAMILY_GLYPH: Record<CmaMapFamily, string> = {
  closed: 'filled',
  active: 'hollow',
  unsold: 'barred',
}
