/**
 * Probe the three Awbrey Butte "active" populations (fleet finding class).
 *
 *   npx tsx scripts/loop-probe-awbrey-count.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
const PUBLIC_ACTIVE_STATUSES = ['Active', 'Active Under Contract'] as const
const DISTRICT_SLUGS = [
  'bend-awbrey-butte',
  'bend-boyd-acres',
  'bend-century-west',
  'bend-larkspur',
  'bend-mountain-view',
  'bend-old-bend',
  'bend-old-farm-district',
  'bend-orchard-district',
  'bend-river-west',
  'bend-southeast-bend',
  'bend-southern-crossing',
  'bend-southwest-bend',
  'bend-summit-west',
]

config({ path: '.env.local' })

const GEO = 'bend-awbrey-butte'
const LABEL = 'Awbrey Butte'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const [pulse, ledger, xrefSfrPublic, xrefActiveAbc, xrefSfrActive] = await Promise.all([
    sb
      .from('market_pulse_live')
      .select('geo_slug, active_count, pending_count, median_list_price, property_type, updated_at')
      .eq('geo_type', 'neighborhood')
      .eq('geo_slug', GEO)
      .eq('property_type', 'A')
      .maybeSingle(),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('listing_tile_mv')
      .select('listing_key, standard_status, property_type, property_sub_type, list_price', { count: 'exact', head: true })
      .in('standard_status', PUBLIC_ACTIVE_STATUSES)
      .eq('property_type', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('boundary_neighborhood', LABEL),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('listing_boundary_xref_mv')
      .select('listing_key, standard_status, property_sub_type', { count: 'exact' })
      .eq('geo_type', 'neighborhood')
      .eq('geo_slug', GEO)
      .in('standard_status', PUBLIC_ACTIVE_STATUSES)
      .eq('property_type', 'A')
      .eq('property_sub_type', 'Single Family Residence'),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('listing_boundary_xref_mv')
      .select('listing_key, standard_status, property_type', { count: 'exact' })
      .eq('geo_type', 'neighborhood')
      .eq('geo_slug', GEO)
      .eq('standard_status', 'Active')
      .in('property_type', ['A', 'B', 'C']),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('listing_boundary_xref_mv')
      .select('listing_key, standard_status', { count: 'exact' })
      .eq('geo_type', 'neighborhood')
      .eq('geo_slug', GEO)
      .eq('standard_status', 'Active')
      .eq('property_type', 'A')
      .eq('property_sub_type', 'Single Family Residence'),
  ])

  const xrefRows = xrefSfrPublic.data ?? []
  const byStatus: Record<string, number> = {}
  for (const r of xrefRows) {
    const s = String(r.standard_status ?? 'null')
    byStatus[s] = (byStatus[s] ?? 0) + 1
  }

  const allXref = await sb
    .from('listing_boundary_xref_mv')
    .select('geo_slug')
    .eq('geo_type', 'neighborhood')
    .in('geo_slug', DISTRICT_SLUGS)
    .in('standard_status', PUBLIC_ACTIVE_STATUSES)
    .eq('property_type', 'A')
    .eq('property_sub_type', 'Single Family Residence')
    .limit(5000)

  const bySlug: Record<string, number> = {}
  for (const r of allXref.data ?? []) {
    const s = String(r.geo_slug)
    bySlug[s] = (bySlug[s] ?? 0) + 1
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    awbrey: {
      A_ledger_tile_mv_sfr_public: ledger.count,
      B_pulse_active_count: pulse.data?.active_count ?? null,
      pulse_updated_at: pulse.data?.updated_at ?? null,
      C_xref_active_abc: xrefActiveAbc.count,
      D_xref_sfr_public_active_auc: xrefSfrPublic.count,
      E_xref_sfr_active_only: xrefSfrActive.count,
      D_by_status: byStatus,
      errors: {
        pulse: pulse.error?.message ?? null,
        ledger: ledger.error?.message ?? null,
        xrefSfrPublic: xrefSfrPublic.error?.message ?? null,
        xrefActiveAbc: xrefActiveAbc.error?.message ?? null,
        xrefSfrActive: xrefSfrActive.error?.message ?? null,
        allXref: allXref.error?.message ?? null,
      },
    },
    districtsSfrPublic: bySlug,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
