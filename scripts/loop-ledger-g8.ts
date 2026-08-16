/**
 * Open the G8 transactions ledger row. Not imported by the app.
 *
 *   npx tsx scripts/loop-ledger-g8.ts
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
  const { data: openRows, error: readErr } = await sb
    .from('site_improvement_ledger')
    .select('id,change_class,shipped_at,window_days,actual_delta')
    .eq('domain', 'transactions')
    .is('actual_delta', null)
  if (readErr) {
    console.error('ledger unreadable', readErr.message)
    process.exit(1)
  }
  console.log(JSON.stringify({ openTransactions: openRows }, null, 2))
  if ((openRows ?? []).length > 0) {
    console.log('domain already has an open class — reuse, do not insert')
    return
  }
  const { data, error } = await sb
    .from('site_improvement_ledger')
    .insert({
      domain: 'transactions',
      change_class: 'skyslope-mirror-ops',
      surface: 'skyslope_transactions + /admin/closings + loop-health-check',
      description:
        'INT-017: inbound-only SkySlope Files refresh as a registered cron so the recon mirror cannot sit stale with no ops path. Vault stays SoR.',
      metric: 'skyslope_transactions.max(synced_at) age_hours',
      baseline_value: 1616,
      predicted_delta: -1580,
      window_days: 14,
      notes:
        'Baseline 2026-08-16: newest synced_at 2026-06-10T00:35:10Z (1616h). Accept: age < 36h after cron, or named credential blocker. Planes: dal-stat, admin-crm, reporting. Public-site / ads / alerts / identity unchanged (mirror is not a public number).',
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
