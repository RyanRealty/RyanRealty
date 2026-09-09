/**
 * components/search/ppsf-band.ts — the comparative mark's arithmetic.
 *
 * SITE-44: a search result card printed a price, a bed/bath/sqft line and a
 * $/sqft figure, and gave the reader nothing to compare any of it to. The mark
 * this module feeds is a hairline track under the ask: the middle half of the
 * homes CURRENTLY IN VIEW as a navy band, and this home's own price per square
 * foot as a tick on it. One glance says "cheaper per foot than most of what is
 * on this map" without the reader doing arithmetic.
 *
 * Section 0: the band is computed from the SAME array the rail renders and the
 * map pins — never a second query, never a market-wide constant. Move the map
 * and the band moves with it, because the population it describes changed.
 *
 * The domain is the visible set's own min and max, so every tick lands inside
 * the track by construction: no clamping, nothing hidden at an edge.
 */

export type PpsfBand = {
  /** Lowest price per square foot among the visible homes that report one. */
  min: number
  /** Highest among them. */
  max: number
  /** 25th percentile — the left edge of the band. */
  q1: number
  /** 75th percentile — the right edge. */
  q3: number
  /** How many of the visible homes report a living area, i.e. the band's population. */
  n: number
}

/** Linear-interpolated quantile over an ascending array. */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * The band for a set of price-per-square-foot values.
 *
 * Returns null below four values or when every home reports the same figure —
 * a band that describes three homes, or one that has no width, is a decoration
 * rather than a comparison, and TASTE.md bans marks that only look like data.
 */
export function buildPpsfBand(values: readonly (number | null | undefined)[]): PpsfBand | null {
  const clean = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)
  if (clean.length < 4) return null
  const min = clean[0]
  const max = clean[clean.length - 1]
  if (!(max > min)) return null
  return { min, max, q1: quantile(clean, 0.25), q3: quantile(clean, 0.75), n: clean.length }
}

/** Where a value sits on the band's track, as a 0-100 percentage. */
export function bandPosition(band: PpsfBand, value: number): number {
  const span = band.max - band.min
  if (!(span > 0)) return 50
  return Math.min(100, Math.max(0, ((value - band.min) / span) * 100))
}

/**
 * The sentence a screen reader (and a hover) gets. The mark is thin on purpose,
 * so the words carry the numbers rather than printing a figure on every card.
 */
export function bandLabel(band: PpsfBand, value: number | null): string {
  const set = `the ${band.n.toLocaleString('en-US')} homes in view that report a living area`
  if (value == null) {
    return `This home does not report a living area, so it has no price per square foot to place against ${set}.`
  }
  const dollars = `$${Math.round(value).toLocaleString('en-US')} per sq ft`
  if (value < band.q1) return `${dollars} — below the middle half of ${set}.`
  if (value > band.q3) return `${dollars} — above the middle half of ${set}.`
  return `${dollars} — inside the middle half of ${set}.`
}
