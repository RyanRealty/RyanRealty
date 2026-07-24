/**
 * Real-DB integration test for the subdivision stats producer→consumer (W2.1/W2.4).
 *
 * Producer: public.compute_subdivision_period_stats (city+SubdivisionName scoped)
 * writes market_stats_cache geo_type='subdivision', geo_slug=slugify(alias).
 * Consumer: /subdivisions/[slug] reads getMarketStats({geoType:'subdivision',
 * geoSlug: slug, periodType:'ytd'}) where slug === slugify(alias).
 *
 * This is the un-fakeable seam — it turns RED on:
 *   - MISSING STATS: fewer than the expected qualifying subdivisions have a
 *     geo_type='subdivision' ytd row (the backfill/cron stopped, or the producer
 *     writes the wrong geo_type).
 *   - §0 DRIFT: a stored subdivision median does NOT equal an independent manual
 *     recompute over the identical canonical SFR filter (the producer's
 *     methodology drifted).
 *   - KEY REGRESSION: the stored geo_slug is NOT slugify(alias) (write-key !=
 *     read-key, so the page would never find the row).
 *
 * Skips (no failure) without SUPABASE_SERVICE_ROLE_KEY. Read-only.
 */
import { describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { slugify } from '@/lib/slug'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

function client() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false },
  })
}

// Known qualifying subdivisions with stable data (verified 2026-07-24).
const CASES = [
  { slug: 'broken-top', city: 'Bend', name: 'Broken Top' },
  { slug: 'rivers-edge-village', city: 'Bend', name: 'Rivers Edge Village' },
  { slug: 'eagle-crest', city: 'Redmond', name: 'Eagle Crest' },
]

run('subdivision stats producer→consumer (W2.1/W2.4, real DB)', () => {
  it('the qualifying registry subdivisions have geo_type=subdivision ytd rows', async () => {
    const supabase = client()
    const { data, error } = await supabase
      .from('market_stats_cache')
      .select('geo_slug')
      .eq('geo_type', 'subdivision')
      .eq('period_type', 'ytd')
      .gt('sold_count', 0)
    expect(error, 'query failed').toBeNull()
    // 43 subdivisions had ytd sales at build time; require a healthy floor so a
    // stalled backfill / wrong geo_type fails here.
    expect((data ?? []).length, 'too few subdivision ytd stat rows — the producer stopped writing').toBeGreaterThanOrEqual(30)
  }, 20_000)

  it('§0: every checked stored median equals an independent manual recompute + key is slugify(alias)', async () => {
    const supabase = client()
    const year = new Date().getUTCFullYear()
    const periodStart = `${year}-01-01`
    for (const c of CASES) {
      // write-key must be slugify(alias) (== the page read-key)
      expect(c.slug, `${c.name} slug is not slugify(alias)`).toBe(slugify(c.name))

      const { data: rows } = await supabase
        .from('market_stats_cache')
        .select('sold_count, median_sale_price')
        .eq('geo_type', 'subdivision')
        .eq('geo_slug', c.slug)
        .eq('period_type', 'ytd')
        .eq('period_start', periodStart)
        .maybeSingle()
      expect(rows, `${c.slug} has no ytd subdivision row`).toBeTruthy()

      // Independent manual median over the identical canonical SFR filter.
      const { data: manual, error: mErr } = await supabase
        .from('listings')
        .select('ClosePrice:"ClosePrice"')
        .eq('StandardStatus', 'Closed')
        .gte('CloseDate', `${periodStart}T00:00:00Z`)
        .eq('PropertyType', 'A')
        .eq('property_sub_type', 'Single Family Residence')
        .eq('City', c.city)
        .eq('SubdivisionName', c.name)
        .gte('ClosePrice', 1000)
        .not('OnMarketDate', 'is', null)
      expect(mErr, `manual query failed for ${c.slug}`).toBeNull()
      const prices: number[] = ((manual ?? []) as Array<Record<string, unknown>>)
        .map((r) => Number((r as { ClosePrice?: number }).ClosePrice))
        .filter((v: number) => Number.isFinite(v))
        .sort((a: number, b: number) => a - b)
      const n = prices.length
      const manualMedian =
        n === 0 ? null : n % 2 ? prices[(n - 1) / 2] : (prices[n / 2 - 1] + prices[n / 2]) / 2

      expect(rows!.sold_count, `${c.slug} sold_count drift`).toBe(n)
      if (n >= 3) {
        expect(Number(rows!.median_sale_price), `${c.slug} median drift vs manual`).toBe(manualMedian)
      }
    }
  }, 30_000)
})
