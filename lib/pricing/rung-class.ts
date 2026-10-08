/**
 * One classification for every rung name either ladder can emit.
 *
 * Own street, own plat, or the 0.25 mi street-cluster pocket is exclusive.
 * Every other named rung is wider geography. `broker-selected` is a curated
 * set used on its own and is neither. A name that matches nothing is
 * unclassified: a mixed set that includes one is not an exclusive pocket,
 * and the ladder builders refuse to emit one.
 */

export const EXCLUSIVE_RUNG_PREFIXES = ['own-street-', 'subdivision-', 'pocket-'] as const

/**
 * Wider than the subject's own street, plat, or quarter-mile pocket.
 * `city-` is the pricing ladder (`city-5mi-*`). `citywide-` is the CMA
 * ladder. `adjacent-sub-` is the pricing ladder; `adjacent-subdivision-`
 * is the CMA ladder. `community-` does not match `like-community-`.
 */
export const WIDEN_RUNG_PREFIXES = [
  'nearby-',
  'city-',
  'citywide-',
  'similar-',
  'widened-',
  'beyond-',
  'rural-',
  'like-community-',
  'competing-',
  'gla-bracket',
  'neighborhood-',
  'adjacent-subdivision-',
  'adjacent-sub-',
  'closer-sub-',
  'community-',
] as const

export type RungClass = 'exclusive' | 'widen' | 'broker-selected' | 'unclassified'

export function classifyRungName(name: string): RungClass {
  if (name === 'broker-selected') return 'broker-selected'
  if (EXCLUSIVE_RUNG_PREFIXES.some((prefix) => name.startsWith(prefix))) return 'exclusive'
  if (WIDEN_RUNG_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix))) return 'widen'
  return 'unclassified'
}

/** Throw when a ladder emits a name the classifier does not know. */
export function assertRungsClassified(names: readonly string[]): void {
  const bad = names.filter((name) => classifyRungName(name) === 'unclassified')
  if (bad.length > 0) {
    throw new Error(`Unclassified rung name: ${bad.join(', ')}`)
  }
}
