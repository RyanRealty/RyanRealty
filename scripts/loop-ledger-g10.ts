/**
 * Open the G10 recruit-retain ledger row. Not imported by the app.
 *
 *   npx tsx scripts/loop-ledger-g10.ts
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
  const { data: openRows, error: readErr } = await sb
    .from('site_improvement_ledger')
    .select('id,change_class,shipped_at,window_days,actual_delta')
    .eq('domain', 'recruit-retain')
    .is('actual_delta', null)
  if (readErr) {
    console.error('ledger unreadable', readErr.message)
    process.exit(1)
  }
  console.log(JSON.stringify({ openRecruitRetain: openRows }, null, 2))
  if ((openRows ?? []).length > 0) {
    console.log('domain already has an open class — reuse, do not insert')
    return
  }
  const { data, error } = await sb
    .from('site_improvement_ledger')
    .insert({
      domain: 'recruit-retain',
      change_class: 'join-conversion',
      surface: '/join + /contact?inquiry=Join the team + /admin/today + COMPANY_SCOREBOARD',
      description:
        'G10: /join visits and conversions tracked into visitor_events and read by getJoinConversionStats so recruit-retain stops being UNKNOWN on the packet.',
      metric: 'join_convert_instrumented',
      baseline_value: 0,
      predicted_delta: 1,
      window_days: 14,
      notes:
        'Baseline 2026-08-16: packet wrote /join convert UNKNOWN. Accept: probe join.status=ok with named source visitor_events via getJoinConversionStats. Planes: dal-stat, public-site (writer), admin-crm (Today), reporting (packet), identity (recruit:join, no buyer enroll), ads (no CAPI Lead for recruits). Alerts unchanged.',
    })
    .select('id,domain,change_class,baseline_value')
    .single()
  if (error || !data?.id) {
    console.error('insert failed', error?.message ?? 'no id')
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, row: data }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
