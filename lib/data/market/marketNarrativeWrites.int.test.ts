/**
 * Real-DB integration test for the market narrative WRITER (W8.7).
 *
 * Generates a narrative from a real market_stats_cache row and persists it, then
 * proves the stored narrative is §0-clean end to end: it links to the exact
 * source stats row, and every number in the stored prose equals a value that
 * row actually carries. This is the producer→consumer proof — the generator's
 * §0 guarantee surviving all the way into the table a report page would read.
 *
 * Skips without SUPABASE_SERVICE_ROLE_KEY. Idempotent (upsert), so it leaves a
 * correct, real narrative in place for Bend / June 2026.
 */
import { describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const GEO = { geoType: 'city', geoSlug: 'bend', periodType: 'monthly', periodStart: '2026-06-01' }
const coreOf = (t: string) =>
  t.replace(/[↑↓]/g, '').replace(/\b(days?|months?)\b/gi, '').replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')

run('market narrative writer — §0 producer→consumer (real DB)', () => {
  it('generates from a real stats row and stores a §0-clean narrative linked to its source', async () => {
    const { generateAndStoreMarketNarrative } = await import('./marketNarrativeWrites')
    const res = await generateAndStoreMarketNarrative(GEO)
    expect(res.ok, `writer failed: ${res.reason}`).toBe(true)

    const { createServiceClient } = await import('@/lib/supabase/service')
    const sb = createServiceClient()

    // The stored narrative row.
    const { data: narr } = await sb
      .from('market_narratives')
      .select('overview, price_analysis, speed_analysis, inventory_analysis, buyer_outlook, seller_outlook, faq, generated_from_stats_id')
      .eq('geo_type', GEO.geoType)
      .eq('geo_slug', GEO.geoSlug)
      .eq('period_type', GEO.periodType)
      .eq('period_start', GEO.periodStart)
      .single()
    expect(narr, 'no narrative row was stored').toBeTruthy()
    const n = narr as Record<string, unknown>

    // It links to a real stats row, and THAT row's numbers back the prose.
    expect(n.generated_from_stats_id, 'narrative is not linked to a stats row').toBeTruthy()
    const { data: stats } = await sb
      .from('market_stats_cache')
      .select('median_sale_price, sold_count, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory')
      .eq('id', n.generated_from_stats_id as string)
      .single()
    expect(stats, 'generated_from_stats_id points at nothing').toBeTruthy()
    const s = stats as Record<string, number | null>

    // Build the set of value-cores this stats row supports (mirrors the generator's formatters).
    const usd = (v: number | null) => (v == null ? null : coreOf(`$${Math.round(v / 1000) * 1000}`))
    const usdSqft = (v: number | null) => (v == null ? null : coreOf(`$${Math.round(v)}`))
    const supported = new Set(
      [
        usd(s.median_sale_price),
        s.sold_count == null ? null : String(Math.round(s.sold_count)),
        s.median_dom == null ? null : String(Math.round(s.median_dom)),
        s.avg_sale_to_list_ratio == null ? null : coreOf(`${(s.avg_sale_to_list_ratio * 100).toFixed(1)}%`),
        usdSqft(s.median_ppsf),
        s.end_of_period_inventory == null ? null : String(Math.round(s.end_of_period_inventory)),
      ].filter((x): x is string => x != null),
    )

    // Sale-to-list EXPLICITLY (the review found the old test vacuous here): the
    // stored "sold for X% of asking" must equal ratio*100, not the raw fraction.
    // This is the number that shipped as an absurd "1.0%".
    if (s.avg_sale_to_list_ratio != null) {
      const m = /sold for\s+(\d+(?:\.\d+)?)%\s+of asking/i.exec(String(n.price_analysis))
      expect(m, 'no "sold for X% of asking" figure in the stored price analysis').toBeTruthy()
      const stl = Number(m?.[1])
      expect(stl).toBeGreaterThanOrEqual(50) // plausibility band — a raw fraction (0.97 -> 1.0) fails
      expect(stl).toBeLessThanOrEqual(150)
      expect(stl.toFixed(1)).toBe((s.avg_sale_to_list_ratio * 100).toFixed(1))
    }

    // Every OTHER number in the stored prose must trace. Percents are checked
    // above / come from the pulse (MoS) or YoY, so strip those; the remaining
    // dollar + integer figures must all be supported stats values.
    const prose = [n.overview, n.price_analysis, n.speed_analysis, n.inventory_analysis]
      .map((x) => String(x))
      .join(' ')
    const stripped = prose
      .replace(/\b\w+ 20\d{2}\b/g, ' ')
      .replace(/\d+(?:\.\d+)?\s*months?/gi, ' ')
      .replace(/\d+(?:\.\d+)?%/g, ' ')
    const nums = (stripped.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$?\d+(?:\.\d+)?/g) ?? []).map(coreOf)
    for (const num of nums) {
      expect(supported.has(num), `stored prose number "${num}" does not trace to the source stats row (${[...supported].join(', ')})`).toBe(true)
    }
  }, 20_000)
})
