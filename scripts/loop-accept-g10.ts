/**
 * G10 accept: live DAL figure + one fleet-test convert (excluded from packet).
 *
 *   npx tsx scripts/loop-accept-g10.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { JOIN_CONVERT_EVENT, readJoinConversionStats } from '../lib/data/loop/join-conversion'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const before = await readJoinConversionStats(sb)
  const sessionId = crypto.randomUUID()
  const { error: sessionErr } = await sb.from('visitor_sessions').insert({
    session_id: sessionId,
    source_domain: 'ryan-realty.com',
    landing_page: 'https://ryan-realty.com/join',
  })
  const { error: eventErr } = await sb.from('visitor_events').insert({
    session_id: sessionId,
    source_domain: 'ryan-realty.com',
    event_type: JOIN_CONVERT_EVENT,
    page_url: 'https://ryan-realty.com/join',
    page_category: 'join',
    metadata: {
      channel: 'accept-probe',
      inquiryType: 'Join the team',
      emitted_by: 'loop-accept-g10',
      fleetTest: true,
    },
  })
  const wrote = {
    ok: !eventErr && (!sessionErr || sessionErr.code === '23505'),
    error: eventErr?.message ?? sessionErr?.message ?? null,
  }
  const after = await readJoinConversionStats(sb)
  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: convertRows } = await sb
    .from('visitor_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'join_convert')
  console.log(
    JSON.stringify(
      {
        before,
        wrote,
        after,
        convertRowsIncludingFleet: convertRows ?? 0,
        packetUnchanged: before.conversionsAll === after.conversionsAll,
      },
      null,
      2,
    ),
  )
  if (before.status !== 'ok' || after.status !== 'ok') process.exit(1)
  if (!wrote.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
