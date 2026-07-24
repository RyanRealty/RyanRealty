/**
 * getCityArchive — the decade market archive for one report city (W8.5).
 *
 * Consumes the monthly market_stats_cache series backfilled by W2.6
 * (scripts/backfill-market-history.mjs — 121 monthly rows per report city,
 * 2016-07 → present, each row a TRUE monthly median verified byte-for-byte
 * against raw SFR listings under the cache methodology). This is the CONSUMER
 * that lights up that producer: /housing-market/reports/archive/[city] renders it.
 *
 * §0 DATA ACCURACY — single source, everything reconciles by construction:
 *   - Every figure comes from ONE read (getPriceHistory, the monthly cache),
 *     so the archive can never disagree with the city market page or the chart.
 *   - Homes sold per year = the SUM of that year's monthly sold_count. sold_count
 *     is a per-MONTH closed count (verified: Bend 2024 = 1,540 across 12 months),
 *     so the annual sum is exact and additive.
 *   - We do NOT invent a "yearly median". A median of monthly medians is not a
 *     true annual median, so the price column is presented HONESTLY as the RANGE
 *     of that year's monthly medians (low–high), each of which is itself a
 *     verified aggregate. No fabricated single number.
 *   - ODS §5-4 A.4: aggregate market statistics only — never an individual sold
 *     address or price. A month's median is only counted toward the range when
 *     that month cleared MONTHLY_VOLUME_FLOOR closings, so a 1–2 sale month can
 *     never surface a near-individual price as a "median".
 *
 * Slug: the URL/report slug is the hyphen form (la-pine); the cache is keyed on
 * the SPACE form (lower("City") = "la pine"). We resolve via the REPORT_CITIES
 * registry (W8.8) and query with the space form — the exact slug trap the
 * refresh-cron fix (§27) and W2.6 established.
 */

import { REPORT_CITIES } from '@/lib/data/geo/report-cities'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

/**
 * A month needs at least this many closings for its median to count toward the
 * year's price range. Keeps a 1–2 sale month (whose "median" is essentially one
 * sale price) out of a published statistic — ODS §5-4 aggregate-only discipline.
 */
export const MONTHLY_VOLUME_FLOOR = 3

/**
 * Read the full backfilled series (2016 → present is 121+ rows and grows monthly).
 * 180 = 15 years of headroom, matching getPriceHistory's raised cap, so the
 * earliest available month is never silently dropped from a year's total.
 */
export const ARCHIVE_MONTHS = 180

export interface CityArchiveYear {
  year: number
  /** Closed single-family sales that year (Σ monthly sold_count). Exact. */
  homesSold: number
  /**
   * Monthly cache rows present for the year. This is completeness of the DATA,
   * NOT of sales — a month with zero closings still has a row, so a finished past
   * year reads 12 here even if some months sold nothing. (Used for the
   * "through N months" partial flag, so a complete year is never mislabeled
   * in-progress.)
   */
  monthsPresent: number
  /** Whether the whole year is in the cache (all 12 monthly rows present). */
  complete: boolean
  /** Lowest monthly median among the year's volume-qualifying months, or null. */
  medianLow: number | null
  /** Highest monthly median among the year's volume-qualifying months, or null. */
  medianHigh: number | null
}

export interface CityArchive {
  /** URL/report slug (hyphen form, e.g. "la-pine"). */
  slug: string
  /** Display label (MLS City spelling, e.g. "La Pine"). */
  label: string
  /** The space-form cache slug actually queried (e.g. "la pine"). */
  cacheSlug: string
  /** Newest year first (display order). */
  years: CityArchiveYear[]
  /** Total closed single-family sales across the whole archive. */
  totalSold: number
  earliestYear: number | null
  latestYear: number | null
}

/**
 * Pure aggregation of a monthly price-history series into per-year archive rows.
 * Exported so the unit test can prove the §0 properties (exact sums, honest
 * range, volume floor) without a DB. Parses the year from the ISO string prefix
 * (TZ-proof — never through Date()).
 */
export function aggregateCityArchive(points: PriceHistoryPoint[]): CityArchiveYear[] {
  const byYear = new Map<number, { sold: number; medians: number[]; present: number }>()
  for (const p of points) {
    const year = Number(String(p.periodStart).slice(0, 4))
    if (!Number.isFinite(year)) continue
    const bucket = byYear.get(year) ?? { sold: 0, medians: [], present: 0 }
    bucket.present += 1 // a cache row exists for this month (even at zero sales)
    bucket.sold += p.soldCount ?? 0
    // Only a volume-qualifying month's median feeds the range (ODS: keep a 1-2
    // sale month's near-individual "median" out of a published statistic).
    if (p.medianSalePrice != null && (p.soldCount ?? 0) >= MONTHLY_VOLUME_FLOOR) {
      bucket.medians.push(p.medianSalePrice)
    }
    byYear.set(year, bucket)
  }
  return [...byYear.entries()]
    .map(([year, b]) => ({
      year,
      homesSold: b.sold,
      monthsPresent: b.present,
      complete: b.present >= 12,
      medianLow: b.medians.length ? Math.min(...b.medians) : null,
      medianHigh: b.medians.length ? Math.max(...b.medians) : null,
    }))
    .sort((a, b) => b.year - a.year)
}

/**
 * The decade archive for one report city. Returns null for an unknown slug (the
 * page 404s). Resolves the hyphen slug → the space-form cache slug and reads the
 * monthly cache at full depth (ARCHIVE_MONTHS).
 */
export async function getCityArchive(slug: string): Promise<CityArchive | null> {
  const entry = REPORT_CITIES.find((c) => c.slug === String(slug).trim().toLowerCase())
  if (!entry) return null

  const cacheSlug = entry.label.toLowerCase() // space form, matches lower("City")
  const points = await getPriceHistory('city', cacheSlug, 'monthly', ARCHIVE_MONTHS)
  const years = aggregateCityArchive(points)
  const totalSold = years.reduce((sum, y) => sum + y.homesSold, 0)
  const yearsWithSales = years.filter((y) => y.homesSold > 0).map((y) => y.year)

  return {
    slug: entry.slug,
    label: entry.label,
    cacheSlug,
    years,
    totalSold,
    earliestYear: yearsWithSales.length ? Math.min(...yearsWithSales) : null,
    latestYear: yearsWithSales.length ? Math.max(...yearsWithSales) : null,
  }
}
