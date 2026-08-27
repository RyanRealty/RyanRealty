/**
 * Probe live /join funnel rows. Not imported by the app.
 *
 *   npx tsx scripts/loop-probe-g10.ts
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
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [joinLike, joinConvert, recruitTagged, ledgerOpen] = await Promise.all([
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('visitor_events')
      .select('id,session_id,event_type,event_at,page_url', { count: 'exact' })
      .ilike('page_url', '%/join%')
      .order('event_at', { ascending: false })
      .limit(20),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('visitor_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'join_convert'),
    // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
    sb
      .from('crm_people')
      .select('id', { count: 'exact', head: true })
      .contains('tags', ['recruit:join'])
      .eq('deleted', false),
    sb
      .from('site_improvement_ledger')
      .select('id,change_class,actual_delta')
      .eq('domain', 'recruit-retain')
      .is('actual_delta', null),
  ])

  const rows = joinLike.data ?? []
  const types: Record<string, number> = {}
  const sessions = new Set<string>()
  let visits7d = 0
  for (const row of rows) {
    const t = String(row.event_type ?? '')
    types[t] = (types[t] ?? 0) + 1
    if (row.session_id) sessions.add(String(row.session_id))
    if (row.event_at && String(row.event_at) >= since7d) visits7d += 1
  }

  console.log(
    JSON.stringify(
      {
        joinLikeCount: joinLike.count ?? rows.length,
        joinLikeError: joinLike.error?.message ?? null,
        eventTypes: types,
        distinctSessionsSample: sessions.size,
        sample: rows.slice(0, 8).map((r) => ({
          type: r.event_type,
          at: r.event_at,
          url: r.page_url,
        })),
        joinConvertCount: joinConvert.count ?? 0,
        joinConvertError: joinConvert.error?.message ?? null,
        recruitTagged: recruitTagged.count ?? 0,
        recruitTaggedError: recruitTagged.error?.message ?? null,
        openRecruitRetain: ledgerOpen.data,
        ledgerError: ledgerOpen.error?.message ?? null,
        visits7dInSample: visits7d,
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
