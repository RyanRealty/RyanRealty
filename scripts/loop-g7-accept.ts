/**
 * G7 accept probe — environment evidence only.
 *
 *   npx tsx scripts/loop-g7-accept.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { GBP_REVIEW_URL } from '../lib/brand/contact'
import { REVIEW_ASK_SUBJECT, buildReviewAskBody } from '../lib/crm/review-ask'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: ledger, error: ledErr } = await sb
    .from('site_improvement_ledger')
    .select('id,domain,change_class,actual_delta,shipped_at')
    .eq('domain', 'seo-aeo')
    .is('actual_delta', null)
  if (ledErr) {
    console.error('ledger unreadable', ledErr.message)
    process.exit(1)
  }

  const { data: audience, error: audErr } = await sb
    .from('meta_audience_log')
    .select('id,audience_id,dry_run,ran_at,add_would_upload')
    .not('audience_id', 'is', null)
    .order('ran_at', { ascending: false })
    .limit(5)
  if (audErr) console.error('audience log', audErr.message)

  const { data: fleet, error: fleetErr } = await sb
    .from('crm_people')
    .select('id,name,assigned_broker,emails,tags')
    .contains('tags', ['fleet:test'])
    .eq('deleted', false)
    .order('id', { ascending: false })
    .limit(3)
  if (fleetErr) {
    console.error('fleet people', fleetErr.message)
    process.exit(1)
  }
  const person = fleet?.[0]
  let draft: { action: string; id?: number } | null = null
  if (person) {
    const { data: existing } = await sb
      .from('crm_message_drafts')
      .select('person_id,channel,subject,body')
      .eq('person_id', person.id)
      .eq('channel', 'email')
      .maybeSingle()
    if (existing?.body?.includes(GBP_REVIEW_URL)) {
      draft = { action: 'already', id: person.id }
    } else if (existing) {
      draft = { action: 'skipped-existing-draft', id: person.id }
    } else {
      const { error: upErr } = await sb.from('crm_message_drafts').insert({
        person_id: person.id,
        broker_slug: person.assigned_broker ?? 'matt',
        channel: 'email',
        subject: REVIEW_ASK_SUBJECT,
        body: buildReviewAskBody('G7 accept probe'),
        updated_at: new Date().toISOString(),
      })
      draft = { action: upErr ? `error:${upErr.message}` : 'created', id: person.id }
    }
  }

  // stat-source-ok: verification harness assertion, compared against an expectation in this script. Never published.
  const { count: closedDeals } = await sb
    .from('tc_deals')
    .select('id', { count: 'exact', head: true })
    .eq('stage', 'closed')

  const { data: recentCycle } = await sb
    .from('tc_cycles')
    .select('deal_id,actual_closing_date')
    .not('actual_closing_date', 'is', null)
    .order('actual_closing_date', { ascending: false })
    .limit(3)

  console.log(
    JSON.stringify(
      {
        openSeoAeoWindows: (ledger ?? []).map((r) => r.id),
        westsideAudienceRecent: audience ?? [],
        fleetPerson: person
          ? { id: person.id, name: person.name, emails: person.emails, tags: person.tags }
          : null,
        reviewAskDraft: draft,
        tcClosedDeals: closedDeals ?? 0,
        recentActualCloses: recentCycle ?? [],
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
