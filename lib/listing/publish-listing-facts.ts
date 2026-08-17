/**
 * Published listing-owned facts for one listing.
 *
 * Same-labeled dollars on a listing page are exact whole dollars of the
 * MLS field — never nearest-thousand. An implausible year_built (sqft
 * leaking into the year column) is withheld, and New construction is
 * withheld when that year cannot corroborate it.
 *
 * Founding cases:
 * - /homes-for-sale/bend/21357-kilimanjaro-220222798 hero $615,000 / $615K
 *   next to rental At $614,995; Financial HOA $0 next to True cost $93
 *   (fleet 535c09e21bb5cefdf07ad18345cf96d8, 4d14df2d7a73a6ffdccd10d90b86c558)
 * - /homes-for-sale/albany/2448-violet-220223541 Year built 3672
 *   (LivingArea written into year_built) (fleet 7fad5b0fcba50d2bf10b47d13be2d3ef)
 */

const YEAR_FLOOR = 1800

export function publishListingMoney(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

export function formatListingMoney(value: number | null | undefined): string | null {
  const n = publishListingMoney(value)
  if (n == null) return null
  return `$${n.toLocaleString('en-US')}`
}

export function publishYearBuilt(
  year: number | null | undefined,
  now: number = new Date().getFullYear(),
): number | null {
  if (year == null || !Number.isFinite(year)) return null
  const y = Math.round(year)
  if (y < YEAR_FLOOR || y > now + 2) return null
  return y
}

export function publishNewConstructionYn(
  flag: boolean | null | undefined,
  year: number | null | undefined,
  now: number = new Date().getFullYear(),
): boolean {
  if (flag !== true) return false
  if (year == null || !Number.isFinite(year)) return true
  return publishYearBuilt(year, now) != null
}
