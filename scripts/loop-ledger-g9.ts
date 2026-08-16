/**
 * Open the G9 public-ux ledger row. Not imported by the app.
 *
 *   npx tsx scripts/loop-ledger-g9.ts
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
    .eq('domain', 'public-ux')
    .is('actual_delta', null)
  if (readErr) {
    console.error('ledger unreadable', readErr.message)
    process.exit(1)
  }
  console.log(JSON.stringify({ openPublicUx: openRows }, null, 2))
  if ((openRows ?? []).length > 0) {
    console.log('domain already has an open class — reuse, do not insert')
    return
  }
  const { data, error } = await sb
    .from('site_improvement_ledger')
    .insert({
      domain: 'public-ux',
      change_class: 'look-walk-baselines',
      surface: 'beat_on public routes + cma-19496-tumalo-reservoir + COMPANY_SCOREBOARD §1b',
      description:
        'G9: first rendered look-walk so packet §1b CMA look and public-ux walk stop being UNKNOWN. Grade wave only — no page redesign.',
      metric: 'look_walk_complete',
      baseline_value: 0,
      predicted_delta: 1,
      window_days: 14,
      notes:
        'Baseline 2026-08-16: packet wrote UNKNOWN because the probe counted cmas rows only. Accept: look-walk-baseline.json complete (8/8 beat_on at 390+1280, CMA graded). Planes: dal-stat (readLookWalkBaseline), public-site (walk), admin-crm (CMA render), reporting (packet). Ads / alerts / identity unchanged.',
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
