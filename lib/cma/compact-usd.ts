/**
 * THE ONE SHORT DOLLAR LABEL ON A CMA CHART (reader review 2026-10-08).
 *
 * Three copies of this formatter lived in price-path.ts, worth-strip.ts and
 * market-charts.ts, and each was wrong a different way:
 *
 * - market-charts printed millions to one place, so 915 Saginaw's $1,050,000
 *   ask read "Asked $1.1M on May 13", a price the home never asked.
 * - 62475 Woodsman's "What happened" axis printed $1,618,053 and $1,554,207
 *   as "$1.6M" and "$1.6M": two edges of one range wearing one label.
 * - `toFixed` rounds the binary float, not the decimal price, so $1,785,000
 *   printed "$1.78M" while $1,625,000 printed "$1.63M".
 *
 * The rule here: whole dollars first, then integer arithmetic, half up.
 * Under a million the label is whole thousands ("$465K"). From a million it
 * is hundredths of a million ("$1.05M", "$1.70M"), and a whole million drops
 * the decimals ("$2M"). A price that rounds to a thousand thousands is a
 * million, never "$1000K". A set of labels drawn together (an axis, the asks
 * on one line) goes through `compactUsdLabels`, which adds precision until
 * two different prices never print the same text.
 *
 * Chart axes stay on that short label: $550,951 may read "$551K" beside the
 * exact range on the cover. An ask on an outcome chip may not. $524,900 is
 * not $525K, and $514,500 is not $515K, when the same card prints the exact
 * ask. `compactOrExactUsd` keeps the short label only when it names this
 * price, the same rule `shortOrExactUsd` already uses for a close.
 */

const exactUsd = (dollars: number): string => `$${dollars.toLocaleString('en-US')}`

/** Whole dollars, half up, as a non-negative integer (the sign is handled by the caller). */
function wholeDollars(n: number): number {
  // Math.round is half up for non-negative numbers, and every x.5 is exact in binary.
  return Math.round(Math.abs(n))
}

/** a / b for non-negative integers, rounded half up, in integer arithmetic. */
function divHalfUp(a: number, b: number): number {
  return Math.floor((a + Math.floor(b / 2)) / b)
}

/**
 * The label at one level of precision.
 *   0: "$465K" / "$1.05M"
 *   1: the exact dollars under a million, "$49,600"; "$1.618M" from a million
 *   2: the exact dollars, "$1,618,053"
 * A thousands label with a decimal ("$49.6K") is not how a price is written,
 * so under a million the finer level is the price itself.
 */
function labelAt(n: number, level: 0 | 1 | 2): string {
  if (!Number.isFinite(n)) return ''
  const sign = n < 0 ? '-' : ''
  const d = wholeDollars(n)
  if (level === 2) return `${sign}${exactUsd(d)}`
  // Under a thousand dollars a K label would read $0K.
  if (d < 500) return `${sign}${exactUsd(d)}`
  const k = divHalfUp(d, 1000)
  if (k < 1000) return level === 0 ? `${sign}$${k}K` : `${sign}${exactUsd(d)}`
  const mPlaces = level === 0 ? 2 : 3
  const mUnit = 1_000_000 / 10 ** mPlaces
  const m = divHalfUp(d, mUnit)
  const whole = Math.floor(m / 10 ** mPlaces)
  const frac = m % 10 ** mPlaces
  // A whole million drops its decimals at the first level only: "$2M". At the
  // finer level the decimals are what tell two labels apart.
  if (level === 0 && frac === 0) return `${sign}$${whole.toLocaleString('en-US')}M`
  return `${sign}$${whole.toLocaleString('en-US')}.${String(frac).padStart(mPlaces, '0')}M`
}

/** "$465K", "$1.05M", "$2M". Exact half-up rounding on whole dollars. */
export function compactUsd(n: number): string {
  return labelAt(n, 0)
}

/**
 * Short label only when it names this price. Otherwise the exact dollars.
 *
 * $525,000 is "$525K". $524,900 is "$524,900", because "$525K" names
 * $525,000. From $999,500 the short form is hundredths of a million, and it
 * names the price only on a whole ten thousand ($1,050,000 is "$1.05M";
 * $1,785,000 would read "$1.79M").
 */
export function compactOrExactUsd(n: number): string {
  if (!Number.isFinite(n)) return ''
  const sign = n < 0 ? -1 : 1
  const d = sign * wholeDollars(n)
  const abs = Math.abs(d)
  const step = abs >= 999_500 ? 10_000 : 1_000
  if (abs >= 500 && abs % step === 0) return labelAt(d, 0)
  return labelAt(d, 2)
}

/**
 * Asks drawn together on one outcome chip or one price path.
 * Each price uses `compactOrExactUsd`. Two different prices never share a
 * label; if a short label ever did, both print the dollars.
 */
export function compactOrExactLabels(values: readonly (number | null | undefined)[]): (n: number) => string {
  const prices = [
    ...new Set(values.filter((v): v is number => v != null && Number.isFinite(v)).map((v) => Math.round(v))),
  ]
  const labels = new Map(prices.map((p) => [p, compactOrExactUsd(p)]))
  const seen = new Map<string, number>()
  for (const p of prices) {
    const label = labels.get(p)!
    const prior = seen.get(label)
    if (prior != null && prior !== p) {
      labels.set(prior, labelAt(prior, 2))
      labels.set(p, labelAt(p, 2))
    } else {
      seen.set(label, p)
    }
  }
  return (n: number) => {
    if (!Number.isFinite(n)) return ''
    const d = Math.round(n)
    return labels.get(d) ?? compactOrExactUsd(d)
  }
}

/**
 * Labels for a set of prices drawn together. The set prints at the first
 * level where no two different prices (in whole dollars) share a label, so an
 * axis never shows "$1.6M" twice. The same price always prints the same text.
 * A value the set did not hold is labelled at the set's level.
 */
export function compactUsdLabels(values: readonly (number | null | undefined)[]): (n: number) => string {
  const prices = [
    ...new Set(values.filter((v): v is number => v != null && Number.isFinite(v)).map((v) => Math.round(v))),
  ]
  const levels = [0, 1, 2] as const
  const level =
    levels.find((lv) => {
      const seen = new Set<string>()
      for (const p of prices) {
        const label = labelAt(p, lv)
        if (seen.has(label)) return false
        seen.add(label)
      }
      return true
    }) ?? 2
  return (n: number) => labelAt(n, level)
}
