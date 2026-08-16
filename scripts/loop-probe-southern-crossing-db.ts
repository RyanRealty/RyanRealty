/**
 * Second query shape for Southern Crossing public inventory (§0).
 * Broad counts first, then the exact public filter.
 *
 *   npx tsx scripts/loop-probe-southern-crossing-db.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const GEO = 'bend-southern-crossing'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: xrefAll, error: xrefAllErr } = await sb
    .from('listing_boundary_xref_mv')
    .select('property_type, property_sub_type, standard_status')
    .eq('geo_type', 'neighborhood')
    .eq('geo_slug', GEO)
  if (xrefAllErr) {
    console.error('xref all failed', xrefAllErr.message)
    process.exit(1)
  }

  const buckets = new Map<string, number>()
  for (const row of xrefAll ?? []) {
    const key = `${row.property_type ?? 'null'}|${row.property_sub_type ?? 'null'}|${row.standard_status ?? 'null'}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  const { count: sfrPublic, error: sfrErr } = await sb
    .from('listing_boundary_xref_mv')
    .select('listing_key', { count: 'exact', head: true })
    .eq('geo_type', 'neighborhood')
    .eq('geo_slug', GEO)
    .in('standard_status', ['Active', 'Active Under Contract'])
    .eq('property_type', 'A')
    .eq('property_sub_type', 'Single Family Residence')
  if (sfrErr) {
    console.error('sfr public failed', sfrErr.message)
    process.exit(1)
  }

  const { data: pulse, error: pulseErr } = await sb
    .from('market_pulse_live')
    .select('geo_slug, geo_type, property_type, active_count, median_list_price, methodology_version')
    .eq('geo_type', 'neighborhood')
    .eq('geo_slug', GEO)
  if (pulseErr) {
    console.error('pulse failed', pulseErr.message)
    process.exit(1)
  }

  const { count: tileTag, error: tileErr } = await sb
    .from('listing_tile_mv')
    .select('listing_key', { count: 'exact', head: true })
    .eq('boundary_neighborhood', GEO)
    .in('standard_status', ['Active', 'Active Under Contract'])
    .eq('property_type', 'A')
    .eq('property_sub_type', 'Single Family Residence')
  if (tileErr) {
    console.error('tile tag failed', tileErr.message)
  }

  console.log(
    JSON.stringify(
      {
        geo: GEO,
        xrefRowCount: xrefAll?.length ?? 0,
        xrefBuckets: Object.fromEntries([...buckets.entries()].sort()),
        sfrPublicActiveAuc: sfrPublic,
        pulse,
        tileTagSfrPublic: tileTag ?? null,
        tileTagError: tileErr?.message ?? null,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
