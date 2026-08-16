/**
 * Insert the G7 seo-aeo ledger row (domain currently has zero open windows).
 *
 *   npx tsx scripts/loop-insert-g7-ledger.ts
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
  const { data: open, error: readErr } = await sb
    .from('site_improvement_ledger')
    .select('id')
    .eq('domain', 'seo-aeo')
    .is('actual_delta', null)
  if (readErr) {
    console.error('ledger unreadable', readErr.message)
    process.exit(1)
  }
  if ((open ?? []).length > 0) {
    console.log(JSON.stringify({ skipped: true, open: open?.map((r) => r.id) }))
    return
  }
  const { data, error } = await sb
    .from('site_improvement_ledger')
    .insert({
      domain: 'seo-aeo',
      change_class: 'westside-backlog-disposition',
      surface: 'WESTSIDE_BACKLOG + /luxury-homes-bend + crm_message_drafts',
      description:
        'G7: every westside backlog row dispositioned. Luxury money-surface links + review-ask drafts on close. Crawl/depth re-ranked to G22. Paid/expired gated.',
      metric: 'undisposed_westside_backlog_rows',
      baseline_value: 4,
      predicted_delta: -4,
      window_days: 14,
      notes:
        'Accept: no ranked row without SHIPPED/CLOSED/DONE/GATED/RE-RANKED. Draft person 61945 (fleet:test). Audience 120244510092910698 last live 2026-08-15 13588 hashed. Gate ci:westside-backlog.',
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    console.error('insert failed', error?.message)
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, id: data.id }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
