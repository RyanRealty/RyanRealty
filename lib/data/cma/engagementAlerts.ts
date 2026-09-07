import 'server-only'

/**
 * The reads and the one write behind the CMA engagement alert rail
 * (lib/crm/cma-engagement.ts). Kept in the DAL so the rail itself holds no raw
 * `.from()` (§7.3 / G1).
 *
 * Each function fails to null / false rather than throwing: an alert rail runs
 * inside a webhook and a tracking beacon, and a lookup miss there must never
 * cost the inbound message or the 200.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { BROKER_ALERT_MAILBOXES } from '@/lib/crm/looking-at'

export type SentCmaForAlert = {
  id: string
  slug: string
  subjectAddress: string
  /** cmas.delivered_at — the send this engagement is about. */
  sentAt: string
  /** The contact the document was sent to. */
  personId: number | null
}

/** The person's alert identity: display name and the desk that owns them. */
export type AlertPerson = {
  id: number
  name: string | null
  assignedBroker: string | null
  /** True when this contact IS one of our brokers — never alert on ourselves. */
  isBrokerMailbox: boolean
}

/**
 * The most recently SENT, unarchived CMA for a contact.
 *
 * "Which document are they replying to" has no stored answer — an email reply
 * threads to a mailbox, not to a row. The newest send is the only defensible
 * guess, and it is the one a broker would make: an answer that arrives after
 * two documents is about the one that just went out.
 */
export async function findLatestSentCmaForPerson(personId: number): Promise<SentCmaForAlert | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cmas')
      .select('id, slug, subject_address, delivered_at, person_id')
      .eq('person_id', personId)
      .not('delivered_at', 'is', null)
      .is('archived_at', null)
      .order('delivered_at', { ascending: false })
      .limit(1)
    if (error) {
      console.warn('[cma-alerts] findLatestSentCmaForPerson failed:', error.message)
      return null
    }
    const row = (data ?? [])[0]
    if (!row) return null
    return {
      id: String(row.id),
      slug: String(row.slug),
      subjectAddress: String(row.subject_address ?? row.slug),
      sentAt: String(row.delivered_at),
      personId,
    }
  } catch (e) {
    console.warn('[cma-alerts] findLatestSentCmaForPerson threw:', e instanceof Error ? e.message : e)
    return null
  }
}

/** One sent CMA by slug — the document a tracked open or visit points at. */
export async function findSentCmaBySlug(slug: string): Promise<SentCmaForAlert | null> {
  const safe = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]{3,80}$/.test(safe)) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('cmas')
      .select('id, slug, subject_address, delivered_at, person_id')
      .eq('slug', safe)
      .limit(1)
    if (error) {
      console.warn('[cma-alerts] findSentCmaBySlug failed:', error.message)
      return null
    }
    const row = (data ?? [])[0]
    // Engagement on a document that was never sent is a broker previewing their
    // own draft. No alert.
    if (!row || row.delivered_at == null) return null
    return {
      id: String(row.id),
      slug: String(row.slug),
      subjectAddress: String(row.subject_address ?? row.slug),
      sentAt: String(row.delivered_at),
      personId: row.person_id == null ? null : Number(row.person_id),
    }
  } catch (e) {
    console.warn('[cma-alerts] findSentCmaBySlug threw:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Alert identity for a contact. Null when the person does not exist — the rail
 * treats that as "do not alert" (fail closed), never as "alert the default desk
 * about someone we cannot name".
 */
export async function getAlertPerson(personId: number): Promise<AlertPerson | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_people')
      .select('id, name, first_name, last_name, assigned_broker')
      .eq('id', personId)
      .maybeSingle()
    if (error || !data) return null
    const name =
      (data.name as string | null)?.trim() ||
      [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
      null

    // Brokers reading their own outbound mail are not leads (the same rule
    // queueReturnVisitAlert applies to site traffic). Without this, every QA
    // send would page the desk it came from.
    let isBrokerMailbox = false
    const { data: emails } = await sb
      .from('crm_contact_points')
      .select('value')
      .eq('person_id', personId)
      .eq('kind', 'email')
    isBrokerMailbox = (emails ?? []).some((e) =>
      BROKER_ALERT_MAILBOXES.has(String(e.value ?? '').trim().toLowerCase()),
    )

    return {
      id: personId,
      name,
      assignedBroker: (data.assigned_broker as string | null) ?? null,
      isBrokerMailbox,
    }
  } catch (e) {
    console.warn('[cma-alerts] getAlertPerson threw:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Stamp the reply onto the document's own record.
 *
 * `cmas` has no `replied_at` column (schema snapshot 2026-09-07), so the stamp
 * is a `cma_replied` timeline row keyed to the cma. Deduped on
 * `cma:replied:<slug>:<personId>` — a live back-and-forth is ONE reply against
 * the document, not one row per message.
 *
 * Returns true only when a NEW row landed, so the caller can use it as the
 * first-reply edge without a second read.
 */
export async function recordCmaRepliedEvent(params: {
  personId: number
  cmaId: string
  slug: string
  subjectAddress: string
  channel: 'email' | 'sms' | 'call'
  broker: string | null
}): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('crm_timeline').insert({
      person_id: params.personId,
      kind: 'cma_replied',
      title: `Replied about the ${params.subjectAddress} report`,
      source: 'cma-engagement',
      broker: params.broker,
      payload: { cmaId: params.cmaId, slug: params.slug, channel: params.channel },
      dedupe_key: `cma:replied:${params.slug}:${params.personId}`,
    })
    // A duplicate key is the expected steady state after the first reply, not
    // an error worth logging.
    return !error
  } catch (e) {
    console.warn('[cma-alerts] recordCmaRepliedEvent threw:', e instanceof Error ? e.message : e)
    return false
  }
}
