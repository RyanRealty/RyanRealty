/**
 * Real-DB integration test for the market_stats_cache historical depth (W2.6).
 *
 * W8.5's ten-year archive pages, and any "5 years shown" chart, need monthly
 * cache rows going back ~10 years for the report cities + region. The refresh
 * crons only keep RECENT months current, so the depth is established by the
 * one-shot scripts/backfill-market-history.mjs and must not silently erode.
 *
 * This asserts, against live Supabase, that every report city + region has
 * monthly rows reaching back to at least the ten-year floor, with no large
 * interior gap. A regression (a prune job, a failed backfill, a city that
 * stopped resolving) fails here.
 *
 * §0: city geo_slug is the lowercased SPACE form (lower("City")); a slugified
 * multi-word city would show zero depth, which this test would catch.
 *
 * Skips (no failure) without SUPABASE_SERVICE_ROLE_KEY so credential-less CI
 * stays green. Read-only.
 */
import { describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

// The ten-year floor the backfill targets. Cities must have a monthly row at or
// before this month (allowing a small margin for the exact backfill start).
const DEPTH_FLOOR = '2016-09-01'
// Cities that reliably have a decade of closed sales. La Pine / Powell Butte are
// the multi-word cities the slug fix repaired; including them proves the
// space-form slug resolves historically. (Crooked River Ranch + Tumalo are
// excluded: they have no matching listings."City", a separate registry issue.)
const CITIES = ['bend', 'redmond', 'sisters', 'la pine', 'sunriver', 'prineville']

run('market_stats_cache historical depth (W2.6, real DB)', () => {
  it('every report city + region reaches the ten-year monthly floor', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    )

    for (const geo of [...CITIES.map((c) => ({ type: 'city', slug: c })), { type: 'region', slug: 'central-oregon' }]) {
      const { data, error } = await supabase
        .from('market_stats_cache')
        .select('period_start')
        .eq('geo_type', geo.type)
        .eq('geo_slug', geo.slug)
        .eq('period_type', 'monthly')
        .order('period_start', { ascending: true })
        .limit(1)
      expect(error, `query failed for ${geo.slug}`).toBeNull()
      const earliest = data?.[0]?.period_start
      expect(earliest, `${geo.slug} has no monthly rows`).toBeTruthy()
      expect(
        String(earliest) <= DEPTH_FLOOR,
        `${geo.slug} monthly cache only reaches ${earliest}, not the ten-year floor ${DEPTH_FLOOR}`,
      ).toBe(true)
    }
  }, 20_000)

  it('has no large interior gap in the city monthly series', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    )
    // Bend has continuous sales, so its monthly series should have one row per
    // month with no multi-month hole between the floor and now.
    const { data } = await supabase
      .from('market_stats_cache')
      .select('period_start')
      .eq('geo_type', 'city')
      .eq('geo_slug', 'bend')
      .eq('period_type', 'monthly')
      .gte('period_start', DEPTH_FLOOR)
      .order('period_start', { ascending: true })
    const months = (data ?? []).map((r) => String(r.period_start))
    let maxGap = 0
    for (let i = 1; i < months.length; i++) {
      const a = new Date(months[i - 1])
      const b = new Date(months[i])
      const gap = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
      maxGap = Math.max(maxGap, gap)
    }
    expect(months.length, 'bend has too few monthly rows for a decade').toBeGreaterThan(100)
    expect(maxGap, `bend monthly series has a ${maxGap}-month gap`).toBeLessThanOrEqual(1)
  }, 20_000)
})
