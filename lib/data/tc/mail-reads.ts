/**
 * Vault mail index + deal conversation reads. Broker-facing only.
 * Raw .from() stays here (G1). Writes live in lib/tc/mail-index.ts and
 * app/actions/tc-mail.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { MAIL_CATEGORY_LABEL, type MailQueueGroup, type DealMailRow, type MailQueueRow, groupMailQueue } from '@/lib/tc/mail-view'

const MAIL_COLS =
  'id, sent_at, direction, from_email, from_name, to_emails, cc_emails, subject, snippet, category, status, match_method, match_detail, attachments, offer_id, property_hint, gmail_refs, deal_id, decided_by'

type MailRowDb = {
  id: string
  sent_at: string
  direction: string
  from_email: string | null
  from_name: string | null
  to_emails: string[] | null
  cc_emails: string[] | null
  subject: string | null
  snippet: string | null
  category: string
  status: string
  match_method: string | null
  match_detail: { reasons?: string[]; candidates?: Array<{ dealId: string; score: number; evidence: string[] }> } | null
  attachments: Array<{ name: string; document_id?: string | null; form_name?: string | null; execution_state?: string | null }> | null
  offer_id: string | null
  property_hint: string | null
  gmail_refs: Array<{ mailbox?: string }> | null
  deal_id: string | null
  decided_by: string
}

function mapRow(r: MailRowDb): DealMailRow {
  return {
    id: r.id,
    sentAt: r.sent_at,
    direction: (r.direction as DealMailRow['direction']) ?? 'inbound',
    fromEmail: r.from_email,
    fromName: r.from_name,
    to: r.to_emails ?? [],
    cc: r.cc_emails ?? [],
    subject: r.subject,
    snippet: r.snippet,
    category: r.category,
    categoryLabel: MAIL_CATEGORY_LABEL[r.category] ?? r.category,
    status: r.status,
    method: r.match_method,
    reasons: r.match_detail?.reasons ?? [],
    attachments: (r.attachments ?? []).map((a) => ({
      name: a.name,
      documentId: a.document_id ?? null,
      formName: a.form_name ?? null,
      executionState: a.execution_state ?? null,
    })),
    offerId: r.offer_id,
    mailboxes: [...new Set((r.gmail_refs ?? []).map((g) => g.mailbox).filter((m): m is string => !!m))],
    decidedBy: r.decided_by,
  }
}

/** Filed mail on one deal, newest first. */
export async function listDealMail(dealId: string, limit = 200): Promise<DealMailRow[]> {
  const { data, error } = await createServiceClient()
    .from('tc_mail_messages')
    .select(MAIL_COLS)
    .eq('deal_id', dealId)
    .eq('status', 'filed')
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) {
    // The index table ships with migration 20260923180000; before it lands the section is empty.
    if (!/does not exist|schema cache/i.test(error.message)) console.error('[listDealMail]', error.message)
    return []
  }
  return (data ?? []).map((r) => mapRow(r as MailRowDb))
}

/**
 * The mail queue: transaction mail the rules could not place. A broker sees
 * what reached their own mailbox; the principal sees every mailbox.
 */
export async function listMailQueue(opts: { mailbox: string | null; limit?: number }): Promise<{
  rows: MailQueueRow[]
  groups: MailQueueGroup[]
}> {
  const sb = createServiceClient()
  let q = sb
    .from('tc_mail_messages')
    .select(MAIL_COLS)
    .in('status', ['ambiguous', 'unfiled_transaction'])
    .order('sent_at', { ascending: false })
    .limit(opts.limit ?? 300)
  if (opts.mailbox) q = q.contains('gmail_refs', [{ mailbox: opts.mailbox }])
  const { data, error } = await q
  if (error) {
    if (!/does not exist|schema cache/i.test(error.message)) console.error('[listMailQueue]', error.message)
    return { rows: [], groups: [] }
  }
  const candidateIds = new Set<string>()
  for (const r of (data ?? []) as MailRowDb[]) for (const c of r.match_detail?.candidates ?? []) candidateIds.add(c.dealId)
  const { data: deals } = candidateIds.size
    ? await sb.from('tc_deals').select('id, address, property_key, stage').in('id', [...candidateIds])
    : { data: [] as Array<{ id: string; address: string; property_key: string; stage: string }> }
  const dealById = new Map((deals ?? []).map((d) => [String(d.id), d]))
  const rows: MailQueueRow[] = ((data ?? []) as MailRowDb[]).map((r) => ({
    ...mapRow(r),
    propertyHint: r.property_hint,
    candidates: (r.match_detail?.candidates ?? [])
      .map((c) => {
        const d = dealById.get(c.dealId)
        return d ? { dealId: c.dealId, address: String(d.address), propertyKey: String(d.property_key), stage: String(d.stage), evidence: c.evidence } : null
      })
      .filter((c): c is NonNullable<typeof c> => !!c),
  }))
  return { rows, groups: groupMailQueue(rows) }
}

/** Queue size for a nav badge or dashboard tile. */
export async function countMailQueue(mailbox: string | null): Promise<number> {
  let q = createServiceClient()
    .from('tc_mail_messages')
    .select('id', { count: 'exact', head: true })
    .in('status', ['ambiguous', 'unfiled_transaction'])
  if (mailbox) q = q.contains('gmail_refs', [{ mailbox }])
  const { count, error } = await q
  if (error) return 0
  return count ?? 0
}

export type DealConversationRow = {
  id: number
  ts: string
  kind: string
  personId: number
  personName: string | null
  title: string | null
  body: string | null
  broker: string | null
  durationSec: number | null
}

const CONVERSATION_KINDS = ['call', 'voicemail', 'sms_in', 'sms_out', 'note', 'email_in', 'email_out']

/**
 * Calls, texts, voicemails, notes and email with the deal's clients, from the
 * CRM timeline (the one comms store). Starts 30 days before the file opened.
 * Broker-facing only; the client portal never reads this.
 */
export async function listDealConversations(dealId: string, limit = 100): Promise<DealConversationRow[]> {
  const sb = createServiceClient()
  const { data: people } = await sb
    .from('tc_deal_people')
    .select('person_id, crm_people(name)')
    .eq('deal_id', dealId)
  const ids = (people ?? []).map((p) => Number(p.person_id)).filter((n) => Number.isFinite(n))
  if (!ids.length) return []
  const nameById = new Map(
    (people ?? []).map((p) => {
      const cp = p.crm_people as { name?: string | null } | { name?: string | null }[] | null
      const one = Array.isArray(cp) ? cp[0] : cp
      return [Number(p.person_id), one?.name ?? null]
    }),
  )
  const { data: cycles } = await sb
    .from('tc_cycles')
    .select('listing_date, contract_acceptance_date, created_at')
    .eq('deal_id', dealId)
  const starts = (cycles ?? [])
    .map((c) => c.listing_date ?? c.contract_acceptance_date ?? c.created_at)
    .filter((d): d is string => !!d)
    .map((d) => Date.parse(d))
    .filter((n) => Number.isFinite(n))
  const since = new Date((starts.length ? Math.min(...starts) : Date.now()) - 30 * 86_400_000).toISOString()
  const { data, error } = await sb
    .from('crm_timeline')
    .select('id, ts, kind, person_id, title, body, broker, payload')
    .in('person_id', ids)
    .in('kind', CONVERSATION_KINDS)
    .gte('ts', since)
    .order('ts', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[listDealConversations]', error.message)
    return []
  }
  return (data ?? []).map((r) => {
    const payload = (r.payload ?? {}) as Record<string, unknown>
    const dur = Number(payload.duration ?? payload.durationSec ?? payload.call_duration ?? NaN)
    return {
      id: Number(r.id),
      ts: String(r.ts),
      kind: String(r.kind),
      personId: Number(r.person_id),
      personName: nameById.get(Number(r.person_id)) ?? null,
      title: (r.title as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      broker: (r.broker as string | null) ?? null,
      durationSec: Number.isFinite(dur) ? dur : null,
    }
  })
}

/** Queue rows an action is about to answer: status, mailboxes, subject. */
export async function getMailMessagesForAction(ids: string[]): Promise<Array<{ id: string; status: string; gmail_refs: unknown; subject: string | null }>> {
  if (!ids.length) return []
  const { data } = await createServiceClient().from('tc_mail_messages').select('id, status, gmail_refs, subject').in('id', ids)
  return (data ?? []) as Array<{ id: string; status: string; gmail_refs: unknown; subject: string | null }>
}

/** The fields an action needs to scope and link a deal. */
export async function getDealScopeRow(dealId: string): Promise<{ id: string; address: string; property_key: string; broker_name: string | null } | null> {
  const { data } = await createServiceClient()
    .from('tc_deals')
    .select('id, address, property_key, broker_name')
    .eq('id', dealId)
    .maybeSingle()
  return (data as { id: string; address: string; property_key: string; broker_name: string | null } | null) ?? null
}

/** A document's name and the deal it sits on, for sharing it with the client. */
export async function getDocumentDealScope(documentId: string): Promise<{
  id: string
  name: string
  cycleId: string
  dealId: string
  brokerName: string | null
  propertyKey: string
} | null> {
  const { data: doc } = await createServiceClient()
    .from('tc_documents')
    .select('id, name, cycle_id, tc_cycles(deal_id, tc_deals(broker_name, property_key))')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) return null
  const cycle = (doc as unknown as { tc_cycles: { deal_id: string; tc_deals: { broker_name: string | null; property_key: string } | null } | null }).tc_cycles
  if (!cycle?.tc_deals) return null
  return {
    id: String(doc.id),
    name: String(doc.name),
    cycleId: String(doc.cycle_id),
    dealId: String(cycle.deal_id),
    brokerName: cycle.tc_deals.broker_name,
    propertyKey: cycle.tc_deals.property_key,
  }
}
