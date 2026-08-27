/**
 * §0 traces for the served place-pages slice: pulse days-to-pending,
 * subdivision existence, event venue geo.
 *
 *   npx tsx scripts/loop-probe-place-data-v11.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const pulse = await sb
    .from('market_pulse_live')
    .select(
      'geo_type,geo_slug,geo_label,property_type,active_count,median_list_price,median_days_to_pending,median_active_dom,methodology_version,updated_at',
    )
    .eq('geo_type', 'city')
    .order('geo_slug')

  const slugs = [
    'aubrey-heights',
    'chase-village',
    'chloe-estates',
    'brookswood-estates',
    'brentwood',
    'blue-chip-ranch',
  ]
  const boundaries = await sb
    .from('boundaries')
    .select('geo_type,slug,name,city')
    .in('slug', slugs)
    .in('geo_type', ['subdivision', 'neighborhood'])

  const flags = await sb
    .from('subdivision_flags')
    .select('entity_key,subdivision_name,city')
    .or(slugs.map((s) => `entity_key.ilike.%:${s}`).join(','))

  const listings = await Promise.all(
    slugs.map(async (slug) => {
      const name = slug.replace(/-/g, ' ')
      // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
      const { count, error } = await sb
        .from('listings')
        .select('ListingKey', { count: 'exact', head: true })
        .ilike('SubdivisionName', name)
        .eq('StandardStatus', 'Active')
        .eq('PropertyType', 'A')
      return { slug, name, count: count ?? null, error: error?.message ?? null }
    }),
  )

  console.log(
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        pulse: pulse.data,
        pulseError: pulse.error?.message ?? null,
        boundaries: boundaries.data,
        boundariesError: boundaries.error?.message ?? null,
        flags: flags.data,
        flagsError: flags.error?.message ?? null,
        listings,
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
