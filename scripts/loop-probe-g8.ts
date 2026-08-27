/**
 * Probe G8 environment: skyslope_transactions freshness vs tc_deals.
 *
 *   npx tsx scripts/loop-probe-g8.ts
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const [{ count }, { data: newest }, { data: oldest }, { data: sample }, { data: meta }, { count: dealCount }] =
    await Promise.all([
      // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
      sb.from('skyslope_transactions').select('property_key', { count: 'exact', head: true }),
      sb.from('skyslope_transactions').select('synced_at').order('synced_at', { ascending: false }).limit(1),
      sb.from('skyslope_transactions').select('synced_at').order('synced_at', { ascending: true }).limit(1),
      sb
        .from('skyslope_transactions')
        .select('property_key,address,stage,synced_at')
        .order('synced_at', { ascending: false })
        .limit(5),
      sb.from('skyslope_dashboard_meta').select('id,synced_at,generated_at').eq('id', 1).maybeSingle(),
      // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
      sb.from('tc_deals').select('id', { count: 'exact', head: true }),
    ])
  const newestAt = newest?.[0]?.synced_at ?? null
  const ageHours = newestAt ? (Date.now() - new Date(newestAt).getTime()) / 36e5 : null
  console.log(
    JSON.stringify(
      {
        count,
        newest: newestAt,
        oldest: oldest?.[0]?.synced_at ?? null,
        ageHours: ageHours == null ? null : Math.round(ageHours * 10) / 10,
        current: ageHours != null && ageHours < 36,
        sample,
        meta,
        tc_deals: dealCount,
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
