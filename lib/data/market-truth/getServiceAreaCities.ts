/**
 * getServiceAreaCities — the MLS City names Market Truth treats as inside the
 * service area (public.market_service_area.city_proper, a few dozen rows).
 *
 * market_fact_sale marks a close outside these cities non-publishable
 * (out_of_service_area), so no Market Truth closed cell counts it. The live
 * neighborhood active_count leaves such listings out too, although the
 * migration that defines it (20260823250000) would count them: measured
 * 2026-09-30, Klamath Falls listing 20260529194642378805000000 (SubdivisionName
 * "Tanglewood", a Bend subdivision label) holds a primary alias membership in
 * bend-larkspur and the cell's 29 leaves it out; a second Klamath Falls name
 * match (bend-mountain-view) is left out the same way, while in-area alias
 * listings (Broken Top, Crosswater) are counted. The market-report Spark
 * reconciliation needs the same list to rebuild those populations.
 *
 * Uncached: its caller is the render script, once per run. Throws on a read
 * error so a failed read never reads as "no service area".
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export async function getServiceAreaCities(): Promise<string[]> {
  const sb = createServiceClient()
  // row-cap-ok: market_service_area lists the service-area cities, a few dozen rows.
  const { data, error } = await sb.from('market_service_area').select('city_proper').order('city_proper', { ascending: true })
  if (error) throw new Error(`[getServiceAreaCities] ${error.message}`)
  return ((data ?? []) as Array<{ city_proper: string | null }>)
    .map((r) => (r.city_proper ?? '').trim())
    .filter(Boolean)
}
