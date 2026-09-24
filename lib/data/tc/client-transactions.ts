/**
 * A signed-in client's own transactions, for ryan-realty.com/account.
 *
 * Identity: the Supabase session's email, which must be confirmed, matched to
 * the CRM person(s) with that email, matched to tc_deal_people on the file.
 * The service client reads the file, so every read here is filtered by that
 * identity first; nothing is reachable by a deal id alone.
 *
 * What leaves the server is decided by lib/tc/client-portal.ts: stage, dates,
 * what is waiting on the client, documents they signed or were shared, their
 * team, and their own milestones. Never call notes, filed mail, other offers,
 * commission, or principal review.
 */
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { dealCalendarItems } from '@/lib/tc/deal-calendar'
import { brokerEmailFromFileName } from '@/lib/tc/deal-scope'
import { earlierSigningGroupPending } from '@/lib/tc/signing'
import { normalizeEmail } from '@/lib/tc/mail-rules'
import {
  CLIENT_STAGE_LABEL,
  CLIENT_TEAM_ROLES,
  CLIENT_TEAM_ROLE_LABEL,
  clientActivity,
  clientMilestones,
  clientNextSteps,
  envelopeNameForClient,
  type ClientNextStep,
  type ClientRole,
  type Milestone,
} from '@/lib/tc/client-portal'

export type ClientIdentity = { userId: string; email: string; personIds: number[] }

/** The signed-in person, if their email is confirmed and on a CRM record. */
export async function getClientIdentity(): Promise<ClientIdentity | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !user.email_confirmed_at) return null
  const email = normalizeEmail(user.email)
  const sb = createServiceClient()
  const ids = new Set<number>()
  const { data: points } = await sb
    .from('crm_contact_points')
    .select('person_id, value')
    .eq('kind', 'email')
    .ilike('value', email.replace(/[%_\\]/g, '\\$&'))
  for (const p of points ?? []) if (normalizeEmail(String(p.value)) === email) ids.add(Number(p.person_id))
  const { data: profile } = await sb.from('profiles').select('crm_person_id').eq('user_id', user.id).maybeSingle()
  if (profile?.crm_person_id) ids.add(Number(profile.crm_person_id))
  return { userId: user.id, email, personIds: [...ids].filter((n) => Number.isFinite(n) && n > 0) }
}

export type ClientDealSummary = {
  dealId: string
  address: string
  role: ClientRole
  stage: string
  stageLabel: string
  nextDate: { label: string; date: string } | null
  waitingOnYou: number
}

type DealRow = { id: string; address: string; city: string | null; stage: string; broker_name: string | null; updated_at: string }
type CycleRow = {
  id: string
  kind: string
  status: string | null
  listing_date: string | null
  contract_acceptance_date: string | null
  escrow_closing_date: string | null
  actual_closing_date: string | null
  expiration_date: string | null
  inspection_days: number | null
  financing_days: number | null
  dead_date: string | null
  created_at: string
}

const DEAD_VISIBLE_DAYS = 60

async function dealLinks(identity: ClientIdentity): Promise<Map<string, ClientRole>> {
  if (!identity.personIds.length) return new Map()
  const { data } = await createServiceClient()
    .from('tc_deal_people')
    .select('deal_id, role')
    .in('person_id', identity.personIds)
  const out = new Map<string, ClientRole>()
  for (const r of data ?? []) {
    if (r.role !== 'buyer' && r.role !== 'seller') continue
    out.set(String(r.deal_id), r.role)
  }
  return out
}

/** The cycle the client lives in: the live or closed sale, else the listing. */
function primaryCycle(cycles: CycleRow[], role: ClientRole): CycleRow | null {
  const cancelled = (c: CycleRow) => /cancel|terminat|withdrawn|expired/i.test(c.status ?? '')
  const sales = cycles.filter((c) => c.kind === 'sale' && !cancelled(c))
  const bySale = sales.sort((a, b) => (b.contract_acceptance_date ?? b.created_at).localeCompare(a.contract_acceptance_date ?? a.created_at))[0]
  if (bySale) return bySale
  if (role === 'seller') return cycles.find((c) => c.kind === 'listing') ?? cycles[0] ?? null
  return cycles[0] ?? null
}

function calendarFor(address: string, c: CycleRow | null) {
  if (!c) return []
  return dealCalendarItems({
    address,
    cycles: [
      {
        id: c.id,
        expiration_date: null,
        contract_acceptance_date: c.contract_acceptance_date,
        escrow_closing_date: c.escrow_closing_date,
        inspectionDays: c.inspection_days,
        financingDays: c.financing_days,
      },
    ],
  })
}

type PendingSignature = { recipientId: string; envelopeId: string; envelopeName: string; sentAt: string | null }

async function pendingSignaturesFor(email: string, cycleIds: string[]): Promise<PendingSignature[]> {
  if (!cycleIds.length) return []
  const sb = createServiceClient()
  const { data: envelopes } = await sb
    .from('tc_envelopes')
    .select('id, name, status, sent_at, cycle_id')
    .in('cycle_id', cycleIds)
    .in('status', ['sent', 'partially_signed'])
  const ids = (envelopes ?? []).map((e) => String(e.id))
  if (!ids.length) return []
  const { data: recipients } = await sb
    .from('tc_envelope_recipients')
    .select('id, envelope_id, email, role, action_required, signing_order, completed_at, declined_at')
    .in('envelope_id', ids)
  const out: PendingSignature[] = []
  for (const env of envelopes ?? []) {
    const roster = (recipients ?? []).filter((r) => r.envelope_id === env.id)
    for (const r of roster) {
      if (normalizeEmail(String(r.email)) !== email) continue
      if (r.completed_at || r.declined_at || r.action_required !== 'NeedsToSign') continue
      if (earlierSigningGroupPending(r.signing_order ?? 1, roster)) continue
      out.push({ recipientId: String(r.id), envelopeId: String(env.id), envelopeName: String(env.name), sentAt: env.sent_at ?? null })
    }
  }
  return out
}

/** Does this client have any file at all? One query; for nav decisions on every /account page. */
export async function hasClientDeals(identity: ClientIdentity): Promise<boolean> {
  return (await dealLinks(identity)).size > 0
}

export async function listClientDeals(identity: ClientIdentity): Promise<ClientDealSummary[]> {
  const links = await dealLinks(identity)
  if (!links.size) return []
  const sb = createServiceClient()
  const { data: deals } = await sb
    .from('tc_deals')
    .select('id, address, city, stage, broker_name, updated_at')
    .in('id', [...links.keys()])
  const { data: cycles } = await sb
    .from('tc_cycles')
    .select(
      'id, deal_id, kind, status, listing_date, contract_acceptance_date, escrow_closing_date, actual_closing_date, expiration_date, inspection_days, financing_days, dead_date, created_at',
    )
    .in('deal_id', [...links.keys()])
  const today = new Date().toISOString().slice(0, 10)
  const out: ClientDealSummary[] = []
  for (const d of (deals ?? []) as DealRow[]) {
    const role = links.get(d.id)!
    const dealCycles = ((cycles ?? []) as Array<CycleRow & { deal_id: string }>).filter((c) => c.deal_id === d.id)
    if (d.stage === 'dead') {
      const dead = dealCycles.map((c) => c.dead_date).filter(Boolean).sort().at(-1) ?? d.updated_at
      if (Date.parse(dead) < Date.now() - DEAD_VISIBLE_DAYS * 86_400_000) continue
    }
    const primary = primaryCycle(dealCycles, role)
    const cal = calendarFor(d.address, primary)
    const steps = clientNextSteps({ role, stage: d.stage, calendar: cal, pendingSignatures: [], tasks: [], today })
    const next = steps.find((s) => s.due) ?? null
    const pending = await pendingSignaturesFor(identity.email, dealCycles.map((c) => c.id))
    out.push({
      dealId: d.id,
      address: d.address,
      role,
      stage: d.stage,
      stageLabel: CLIENT_STAGE_LABEL[d.stage] ?? d.stage,
      nextDate: next?.due ? { label: next.title, date: next.due } : null,
      waitingOnYou: pending.length,
    })
  }
  return out.sort((a, b) => (a.stage === 'closed' ? 1 : 0) - (b.stage === 'closed' ? 1 : 0))
}

export type ClientTeamMember = { role: string; roleLabel: string; name: string | null; company: string | null; email: string | null; phone: string | null }

export type ClientDealDetail = {
  dealId: string
  address: string
  role: ClientRole
  stage: string
  stageLabel: string
  milestones: Milestone[]
  nextSteps: ClientNextStep[]
  pendingSignatures: PendingSignature[]
  documents: Array<{ id: string; name: string; signedAt: string | null; kind: 'signed' | 'shared' }>
  keyDates: Array<{ label: string; date: string }>
  broker: { name: string; email: string | null; phone: string | null; photoUrl: string | null } | null
  team: ClientTeamMember[]
  activity: Array<{ at: string; label: string }>
  closeDate: string | null
}

const KEY_DATE_LABEL: Record<string, string> = {
  contract_accepted: 'Offer accepted',
  earnest_money_due: 'Earnest money due',
  inspection_period_ends: 'Inspection period ends',
  financing_contingency_ends: 'Financing deadline',
  escrow_closes: 'Closing',
}

export async function getClientDeal(identity: ClientIdentity, dealId: string): Promise<ClientDealDetail | null> {
  const links = await dealLinks(identity)
  const role = links.get(dealId)
  if (!role) return null
  const sb = createServiceClient()
  const { data: deal } = await sb
    .from('tc_deals')
    .select('id, address, city, stage, broker_name, updated_at')
    .eq('id', dealId)
    .maybeSingle()
  if (!deal) return null
  const { data: cyclesRaw } = await sb
    .from('tc_cycles')
    .select(
      'id, kind, status, listing_date, contract_acceptance_date, escrow_closing_date, actual_closing_date, expiration_date, inspection_days, financing_days, dead_date, created_at',
    )
    .eq('deal_id', dealId)
  const cycles = (cyclesRaw ?? []) as CycleRow[]
  const primary = primaryCycle(cycles, role)
  const cal = calendarFor(deal.address, primary)
  const today = new Date().toISOString().slice(0, 10)
  const cycleIds = cycles.map((c) => c.id)

  const [pendingRaw, tasksRes, envelopesRes, sharedRes, contactsRes, eventsRes] = await Promise.all([
    pendingSignaturesFor(identity.email, cycleIds),
    sb
      .from('tc_tasks')
      .select('id, title, detail, due_date, assignee_email, status')
      .eq('deal_id', dealId)
      .eq('status', 'open'),
    cycleIds.length
      ? sb.from('tc_envelopes').select('id, name, completed_at, executed_document_id, status').in('cycle_id', cycleIds).neq('status', 'draft')
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; completed_at: string | null; executed_document_id: string | null; status: string }> }),
    cycleIds.length
      ? sb.from('tc_documents').select('id, name, ingested_at').in('cycle_id', cycleIds).eq('client_visible', true).eq('archived', false)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; ingested_at: string }> }),
    sb.from('tc_deal_contacts').select('role, name, company, email, phone').eq('deal_id', dealId),
    sb.from('tc_events').select('action, detail, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(200),
  ])

  // The page already names the property; envelope names drop it.
  const pending = pendingRaw.map((p) => ({ ...p, envelopeName: envelopeNameForClient(p.envelopeName, deal.address) }))

  // Only envelopes this client was a recipient on: their signed documents, and
  // the only envelope activity they see.
  const envelopes = envelopesRes.data ?? []
  const signed: ClientDealDetail['documents'] = []
  const myEnvelopeNames = new Set<string>()
  if (envelopes.length) {
    const { data: mine } = await sb
      .from('tc_envelope_recipients')
      .select('envelope_id, email')
      .in('envelope_id', envelopes.map((e) => e.id))
    const myEnvelopes = new Set((mine ?? []).filter((r) => normalizeEmail(String(r.email)) === identity.email).map((r) => String(r.envelope_id)))
    for (const e of envelopes) {
      if (!myEnvelopes.has(String(e.id))) continue
      myEnvelopeNames.add(String(e.name))
      if (e.status !== 'completed' || !e.executed_document_id) continue
      signed.push({ id: String(e.executed_document_id), name: envelopeNameForClient(String(e.name), deal.address), signedAt: e.completed_at ?? null, kind: 'signed' })
    }
  }
  const shared = (sharedRes.data ?? [])
    .filter((d) => !signed.some((s) => s.id === d.id))
    .map((d) => ({ id: String(d.id), name: String(d.name), signedAt: null, kind: 'shared' as const }))

  const tasks = (tasksRes.data ?? [])
    .filter((t) => t.assignee_email && normalizeEmail(String(t.assignee_email)) === identity.email)
    .map((t) => ({ id: String(t.id), title: String(t.title), detail: (t.detail as string | null) ?? null, dueDate: (t.due_date as string | null) ?? null }))

  const brokerEmail = brokerEmailFromFileName(deal.broker_name)
  let broker: ClientDealDetail['broker'] = null
  if (brokerEmail) {
    const { data: b } = await sb
      .from('brokers')
      .select('display_name, email, phone, twilio_number, photo_url')
      .ilike('email', brokerEmail)
      .maybeSingle()
    broker = {
      name: (b?.display_name as string | undefined) || String(deal.broker_name ?? 'Your broker'),
      email: (b?.email as string | null) ?? brokerEmail,
      // The broker's business line: calls to it are logged to the file.
      phone: ((b?.twilio_number as string | null) || (b?.phone as string | null)) ?? null,
      photoUrl: (b?.photo_url as string | null) ?? null,
    }
  }

  const team: ClientTeamMember[] = (contactsRes.data ?? [])
    .filter((c) => CLIENT_TEAM_ROLES.has(String(c.role)))
    .map((c) => ({
      role: String(c.role),
      roleLabel: CLIENT_TEAM_ROLE_LABEL[String(c.role)] ?? String(c.role),
      name: (c.name as string | null) ?? null,
      company: (c.company as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
    }))

  const activity = clientActivity({
    events: (eventsRes.data ?? []).map((e) => ({ action: String(e.action), detail: (e.detail as Record<string, unknown>) ?? null, at: String(e.created_at) })),
    role,
    address: deal.address,
    myEnvelopeNames,
  })

  return {
    dealId,
    address: deal.address,
    role,
    stage: deal.stage,
    stageLabel: CLIENT_STAGE_LABEL[deal.stage] ?? deal.stage,
    milestones: clientMilestones({
      role,
      stage: deal.stage,
      dates: {
        listingDate: primary?.listing_date ?? cycles.find((c) => c.kind === 'listing')?.listing_date ?? null,
        acceptanceDate: primary?.contract_acceptance_date ?? null,
        closeDate: primary?.escrow_closing_date ?? null,
        actualCloseDate: primary?.actual_closing_date ?? null,
      },
      calendar: cal,
      today,
    }),
    nextSteps: clientNextSteps({ role, stage: deal.stage, calendar: cal, pendingSignatures: pending, tasks, today }),
    pendingSignatures: pending,
    documents: [...signed, ...shared],
    keyDates: cal
      .filter((c) => KEY_DATE_LABEL[c.kind] && (role === 'buyer' || c.kind !== 'earnest_money_due'))
      // A closed file's clocks past the close never ran.
      .filter((c) => !(deal.stage === 'closed' && primary?.actual_closing_date && c.kind !== 'escrow_closes' && c.date > primary.actual_closing_date))
      .map((c) => ({ label: KEY_DATE_LABEL[c.kind], date: c.kind === 'escrow_closes' && primary?.actual_closing_date ? primary.actual_closing_date : c.date })),
    broker,
    team,
    activity,
    closeDate: primary?.actual_closing_date ?? primary?.escrow_closing_date ?? null,
  }
}

/** A short-lived download link for a document the client may see. */
export async function clientDocumentUrl(identity: ClientIdentity, dealId: string, documentId: string): Promise<string | null> {
  const detail = await getClientDeal(identity, dealId)
  if (!detail || !detail.documents.some((d) => d.id === documentId)) return null
  const sb = createServiceClient()
  const { data: doc } = await sb.from('tc_documents').select('storage_path').eq('id', documentId).maybeSingle()
  if (!doc?.storage_path) return null
  const { data } = await sb.storage.from('tc-documents').createSignedUrl(String(doc.storage_path), 300)
  return data?.signedUrl ?? null
}

export type PortalSigningRecipient = {
  id: string
  email: string
  signingOrder: number
  completedAt: string | null
  declinedAt: string | null
  actionRequired: string
  envelope: { id: string; name: string; status: string; cycleId: string; dealId: string | null } | null
}

/** One signing recipient with its envelope and deal, for the portal's Sign now. */
export async function getPortalSigningRecipient(recipientId: string): Promise<PortalSigningRecipient | null> {
  const sb = createServiceClient()
  const { data: r } = await sb
    .from('tc_envelope_recipients')
    .select('id, email, signing_order, completed_at, declined_at, action_required, tc_envelopes(id, name, status, cycle_id)')
    .eq('id', recipientId)
    .maybeSingle()
  if (!r) return null
  const env = (Array.isArray(r.tc_envelopes) ? r.tc_envelopes[0] : r.tc_envelopes) as
    | { id: string; name: string; status: string; cycle_id: string }
    | null
  let dealId: string | null = null
  if (env) {
    const { data: cycle } = await sb.from('tc_cycles').select('deal_id').eq('id', env.cycle_id).maybeSingle()
    dealId = (cycle?.deal_id as string | null) ?? null
  }
  return {
    id: String(r.id),
    email: String(r.email),
    signingOrder: Number(r.signing_order ?? 1),
    completedAt: (r.completed_at as string | null) ?? null,
    declinedAt: (r.declined_at as string | null) ?? null,
    actionRequired: String(r.action_required),
    envelope: env ? { id: env.id, name: env.name, status: env.status, cycleId: env.cycle_id, dealId } : null,
  }
}
