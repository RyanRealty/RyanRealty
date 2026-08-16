/**
 * G5 accept: a non-Matt broker walks day-one; own-book scoping is fail-closed.
 *
 *   npx tsx scripts/loop-g5-day-one-accept.ts
 *
 * Environment evidence only. Does not send, post, spend, or OAuth.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { evaluateDayOne, dayOneComplete } from '../lib/crm/day-one'
import { pickCrmSlug } from '../lib/crm/resolve-broker-slug'
import { scopeBroker, UNMAPPED_OWN_BOOK, isPersonInScope } from '../lib/crm/scope'

config({ path: '.env.local' })

const PAUL_EMAIL = 'paul@ryan-realty.com'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: role } = await sb
    .from('admin_roles')
    .select('email, role, broker_id')
    .eq('email', PAUL_EMAIL)
    .maybeSingle()
  const { data: byId } = role?.broker_id
    ? await sb.from('brokers').select('id,email,crm_slug,display_name,phone,notify_new_leads,notify_sms,social_instagram,social_facebook,social_linkedin').eq('id', role.broker_id).maybeSingle()
    : { data: null }
  const { data: byEmail } = await sb
    .from('brokers')
    .select('id,email,crm_slug,display_name,phone,notify_new_leads,notify_sms,social_instagram,social_facebook,social_linkedin')
    .eq('email', PAUL_EMAIL)
    .maybeSingle()

  const slug = pickCrmSlug({
    email: PAUL_EMAIL,
    slugFromBrokerId: (byId?.crm_slug as string | null) ?? null,
    slugFromEmailRow: (byEmail?.crm_slug as string | null) ?? null,
  })
  const row = byId ?? byEmail
  if (slug !== 'paul') {
    console.error('FAIL slug', { slug, role, byId, byEmail })
    process.exit(1)
  }

  const scoped = scopeBroker({ role: 'broker', brokerSlug: slug })
  const unmapped = scopeBroker({ role: 'broker', brokerSlug: null })
  const matt = scopeBroker({ role: 'superuser', brokerSlug: 'matt' })
  if (scoped !== 'paul' || unmapped !== UNMAPPED_OWN_BOOK || matt !== null) {
    console.error('FAIL scopeBroker', { scoped, unmapped, matt })
    process.exit(1)
  }
  if (isPersonInScope(UNMAPPED_OWN_BOOK, 'matt') || isPersonInScope('paul', 'matt')) {
    console.error('FAIL isPersonInScope leak')
    process.exit(1)
  }

  const { count: paulPeople } = await sb
    .from('crm_people')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_broker', 'paul')
  const { count: allPeople } = await sb
    .from('crm_people')
    .select('id', { count: 'exact', head: true })
  const { count: unmappedPeople } = await sb
    .from('crm_people')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_broker', UNMAPPED_OWN_BOOK)

  if (!paulPeople || !allPeople || paulPeople >= allPeople) {
    console.error('FAIL book sizes', { paulPeople, allPeople })
    process.exit(1)
  }
  if ((unmappedPeople ?? 0) !== 0) {
    console.error('FAIL sentinel matched live rows', unmappedPeople)
    process.exit(1)
  }

  const items = evaluateDayOne({
    role: 'broker',
    brokerSlug: slug,
    displayName: (row?.display_name as string | null) ?? null,
    phone: (row?.phone as string | null) ?? null,
    notifyConfigured: row?.notify_new_leads != null || row?.notify_sms != null,
    socialUrls: [row?.social_instagram, row?.social_facebook, row?.social_linkedin] as Array<
      string | null
    >,
    holdsMarketing: true,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        broker: PAUL_EMAIL,
        slug,
        scope: scoped,
        unmappedScope: unmapped,
        people: { paul: paulPeople, company: allPeople, sentinel: unmappedPeople ?? 0 },
        dayOneComplete: dayOneComplete(items),
        dayOne: items,
        adminRole: role,
        brokerRowId: row?.id ?? null,
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
