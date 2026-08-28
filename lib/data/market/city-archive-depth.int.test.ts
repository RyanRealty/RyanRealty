/**
 * Real-DB integration test for the city sales archive (W8.5) — the un-fakeable
 * producer→consumer seam.
 *
 * W2.6 backfilled ten years of monthly market_stats_cache rows. W8.5's archive
 * page is the CONSUMER. The existing W2.6 depth test only queries the raw table,
 * so a page that quietly stopped reading the deep cache (e.g. getPriceHistory
 * limit dropped back to 24, or the slug regressed to the hyphen form) would keep
 * that test green. THIS test exercises the archive's actual DAL — getCityArchive
 * — so those regressions turn it RED:
 *
 *   - getCityArchive('bend'|'redmond') must reach ~10 years back to the 2016
 *     floor. A limit regression (24 months = 2 years) fails here.
 *   - getCityArchive('la-pine') must resolve the SPACE-form cache slug ("la pine")
 *     and return real depth. A slug regression fails here.
 *   - §0 RECONCILIATION: the archive's per-year homesSold must equal an
 *     independent SUM of monthly sold_count straight from the cache. A broken
 *     aggregation fails here.
 *
 * Skips (no failure) without SUPABASE_SERVICE_ROLE_KEY so credential-less CI
 * stays green. Read-only.
 */
import { describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { getCityArchive } from './getCityArchive'
import { getPublicDetachedMonthly } from '@/lib/data/market-truth/public-monthly'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

/** Independent Σ of monthly sold_count per year straight from the cache. */
async function dbSoldByYear(cacheSlug: string): Promise<Map<number, number>> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  )
  const { data, error } = await supabase
    .from('market_stats_cache')
    .select('period_start, sold_count')
    .eq('geo_type', 'city')
    .eq('geo_slug', cacheSlug)
    .eq('period_type', 'monthly')
  expect(error, `cache query failed for ${cacheSlug}`).toBeNull()
  const byYear = new Map<number, number>()
  for (const r of (data ?? []) as { period_start: string; sold_count: number | null }[]) {
    const year = Number(String(r.period_start).slice(0, 4))
    byYear.set(year, (byYear.get(year) ?? 0) + (r.sold_count ?? 0))
  }
  return byYear
}

run('city sales archive DAL depth + reconciliation (W8.5, real DB)', () => {
  it('bend and redmond archives reach ~10 years back to the 2016 floor', async () => {
    for (const slug of ['bend', 'redmond']) {
      const archive = await getCityArchive(slug)
      expect(archive, `${slug} archive is null`).toBeTruthy()
      const yearsWithSales = archive!.years.filter((y) => y.homesSold > 0)
      expect(
        yearsWithSales.length,
        `${slug} archive only covers ${yearsWithSales.length} years — the deep cache is not being consumed (limit regression?)`,
      ).toBeGreaterThanOrEqual(10)
      expect(
        archive!.earliestYear!,
        `${slug} archive only reaches ${archive!.earliestYear}, not the ~2016 floor`,
      ).toBeLessThanOrEqual(2017)
    }
  }, 30_000)

  it('resolves the space-form cache slug for a multi-word city (la-pine)', async () => {
    const archive = await getCityArchive('la-pine')
    expect(archive, 'la-pine archive is null').toBeTruthy()
    expect(archive!.cacheSlug, 'la-pine did not resolve to the space-form slug').toBe('la pine')
    const yearsWithSales = archive!.years.filter((y) => y.homesSold > 0)
    expect(
      yearsWithSales.length,
      'la-pine archive is empty — the hyphen→space slug resolution regressed',
    ).toBeGreaterThanOrEqual(8)
  }, 30_000)

  it('§0: per-year homesSold reconciles exactly with its own source (leftover rollup for overlaid years, cache sum otherwise)', async () => {
    // getCityArchive OVERLAYS the market-truth leftover monthly rollup onto
    // recent years (overlayArchiveLeftoverYears, >=6 publishable months) and
    // names those years in archive.leftoverYears. Each year must reconcile
    // exactly against the source that actually produced it; asserting every
    // year against the cache re-pins the pre-overlay contract and goes red the
    // day a year crosses the overlay threshold, which is what happened to 2026.
    const archive = await getCityArchive('bend')
    expect(archive).toBeTruthy()
    const dbByYear = await dbSoldByYear('bend')
    const leftoverYears = new Set(archive!.leftoverYears)
    const currentMonthKey = new Date().toISOString().slice(0, 7)
    const leftoverMonthly = await getPublicDetachedMonthly({
      geoType: 'city',
      geoSlug: 'bend',
      currentMonthKey,
    })
    const leftoverByYear = new Map<number, number>()
    for (const row of leftoverMonthly) {
      const year = Number(String(row.periodStart).slice(0, 4))
      leftoverByYear.set(year, (leftoverByYear.get(year) ?? 0) + (row.closedCount ?? 0))
    }
    for (const y of archive!.years) {
      if (leftoverYears.has(y.year)) {
        expect(
          y.homesSold,
          `bend ${y.year} (leftover-overlaid) archive homesSold ${y.homesSold} != leftover rollup ${leftoverByYear.get(y.year)}`,
        ).toBe(leftoverByYear.get(y.year) ?? 0)
      } else {
        expect(
          y.homesSold,
          `bend ${y.year} archive homesSold ${y.homesSold} != cache sum ${dbByYear.get(y.year)}`,
        ).toBe(dbByYear.get(y.year) ?? 0)
      }
    }
  }, 30_000)

  it('returns null for an unknown city slug (page 404s)', async () => {
    expect(await getCityArchive('not-a-real-city')).toBeNull()
  }, 15_000)
})
