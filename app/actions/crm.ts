'use server'

/**
 * CRM server actions — reads + mutations for /admin/crm (blueprint §5).
 *
 * Dual-write rule during the parallel run: when a person has a fub_legacy_id,
 * mutations go to FUB FIRST and the mirror layer (lib/crm/mirror.ts) writes the
 * local copy — that keeps one source of merge semantics and avoids duplicate
 * timeline rows. People without a FUB id (future native leads) write locally.
 */

import { revalidatePath, unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import {
  addPersonNote,
  addPersonTags,
  assignPersonToUser,
  completeFubTask,
  createRealtimeTask,
  replacePersonTags,
  updatePersonAutomationState,
} from '@/lib/followupboss'
import { normalizeCrmPhone } from '@/lib/crm/mirror'
import {
  CRM_STAGES,
  CRM_BROKERS,
  CRM_BROKER_BY_EMAIL,
  FUB_USER_ID_BY_BROKER,
  type CrmBrokerSlug,
} from '@/lib/crm/constants'

export type CrmActionResult = { ok: true } | { ok: false; error: string }

export type CrmAccess = {
  email: string
  role: 'superuser' | 'broker' | 'report_viewer'
  /** The signed-in user's own broker slug, when their email maps to one. */
  brokerSlug: CrmBrokerSlug | null
}

/** Resolve the caller's CRM access (role + own-broker slug). Null when not an admin. */
export async function getCrmAccess(): Promise<CrmAccess | null> {
  const session = await getSession()
  const email = session?.user?.email?.trim().toLowerCase() ?? null
  const role = await getAdminRoleForEmail(email)
  if (!role || !email) return null
  return { email, role: role.role, brokerSlug: CRM_BROKER_BY_EMAIL[email] ?? null }
}

export type CrmPersonRow = {
  id: number
  fub_legacy_id: number | null
  name: string | null
  first_name: string | null
  picture_url: string | null
  last_name: string | null
  stage: string
  source: string | null
  assigned_broker: string | null
  tags: string[]
  emails: Array<{ value?: string; isPrimary?: number | boolean }>
  phones: Array<{ value?: string; isPrimary?: number | boolean }>
  last_activity_at: string | null
  fub_created_at: string | null
}

export type CrmListFilters = {
  q?: string
  stage?: string
  broker?: string
  tag?: string
  view?: string
  page?: number
}

export type CrmSavedView = {
  id: number
  name: string
  description: string | null
  filter: { stage?: string; tagsAny?: string[] }
  position: number
}

const PAGE_SIZE = 50

async function requireCrmAccess(): Promise<{ ok: true; access: CrmAccess } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  return { ok: true, access }
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listCrmSavedViews(): Promise<CrmSavedView[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_saved_views')
    .select('id,name,description,filter,position')
    .order('position', { ascending: true })
  return (data ?? []) as CrmSavedView[]
}

export async function listCrmPeople(filters: CrmListFilters): Promise<{
  rows: CrmPersonRow[]
  total: number
  page: number
  pageSize: number
  appliedView: CrmSavedView | null
}> {
  const sb = createServiceClient()
  const page = Math.max(1, filters.page ?? 1)

  let appliedView: CrmSavedView | null = null
  if (filters.view) {
    const { data } = await sb
      .from('crm_saved_views')
      .select('id,name,description,filter,position')
      .eq('id', Number(filters.view))
      .maybeSingle()
    appliedView = (data as CrmSavedView | null) ?? null
  }

  let query = sb
    .from('crm_people')
    .select(
      'id,fub_legacy_id,name,first_name,last_name,stage,source,assigned_broker,tags,emails,phones,last_activity_at,fub_created_at,picture_url',
      { count: 'exact' },
    )

  const stage = filters.stage || appliedView?.filter?.stage
  if (stage) query = query.eq('stage', stage)
  const tagsAny = filters.tag ? [filters.tag] : appliedView?.filter?.tagsAny
  if (tagsAny?.length) query = query.overlaps('tags', tagsAny)
  if (filters.broker) query = query.eq('assigned_broker', filters.broker)

  const q = filters.q?.trim()
  if (q) {
    if (q.includes('@')) {
      const { data: pts } = await sb
        .from('crm_contact_points')
        .select('person_id')
        .eq('kind', 'email')
        .eq('value', q.toLowerCase())
        .limit(200)
      const ids = (pts ?? []).map((p) => p.person_id)
      query = query.in('id', ids.length ? ids : [-1])
    } else if (q.replace(/\D/g, '').length >= 7) {
      const normalized = normalizeCrmPhone(q)
      const { data: pts } = await sb
        .from('crm_contact_points')
        .select('person_id')
        .eq('kind', 'phone')
        .eq('value', normalized ?? '')
        .limit(200)
      const ids = (pts ?? []).map((p) => p.person_id)
      query = query.in('id', ids.length ? ids : [-1])
    } else {
      query = query.ilike('name', `%${q}%`)
    }
  }

  const from = (page - 1) * PAGE_SIZE
  const { data, count, error } = await query
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('fub_created_at', { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    console.error('[listCrmPeople]', error.message)
    return { rows: [], total: 0, page, pageSize: PAGE_SIZE, appliedView }
  }
  return { rows: (data ?? []) as CrmPersonRow[], total: count ?? 0, page, pageSize: PAGE_SIZE, appliedView }
}

export type CrmOverview = {
  total: number
  sellers: number
  buyers: number
  hardStops: number
  openTasks: number
  lastDeltaSync: string | null
}

export async function getCrmOverview(): Promise<CrmOverview> {
  const sb = createServiceClient()
  const head = { count: 'exact' as const, head: true }
  const [total, sellers, buyers, hardStops, openTasks, lastSync] = await Promise.all([
    sb.from('crm_people').select('id', head),
    sb.from('crm_people').select('id', head).contains('tags', ['audience:seller']),
    sb.from('crm_people').select('id', head).contains('tags', ['audience:buyer']),
    sb.from('crm_people').select('id', head).contains('tags', ['compliance:hard-stop']),
    sb.from('crm_tasks').select('id', head).is('completed_at', null),
    sb.from('crm_imports').select('finished_at').eq('status', 'done').order('id', { ascending: false }).limit(1).maybeSingle(),
  ])
  return {
    total: total.count ?? 0,
    sellers: sellers.count ?? 0,
    buyers: buyers.count ?? 0,
    hardStops: hardStops.count ?? 0,
    openTasks: openTasks.count ?? 0,
    lastDeltaSync: lastSync.data?.finished_at ?? null,
  }
}

export type CrmHomeDashboard = {
  funnel: Array<{ stage: string; count: number }>
  attention: {
    approvalsPending: number
    tasksOverdue: number
    tasksToday: number
    inbound24h: number
    hotLeads48h: number
    newLeads7d: number
  }
  newest: Array<{
    id: number
    name: string | null
    stage: string
    source: string | null
    picture_url: string | null
    created_at: string | null
    last_activity_at: string | null
  }>
}

/** Broker-focused home dashboard: the lead funnel + what needs attention. */
export async function getCrmHomeDashboard(broker?: string): Promise<CrmHomeDashboard> {
  const sb = createServiceClient()
  const head = { count: 'exact' as const, head: true }
  // supabase's builder generics explode (TS2589) on a generic passthrough —
  // keep the helper untyped; results are cast at the destructuring sites.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withBroker = (q: any): any => (broker ? q.eq('assigned_broker', broker) : q)

  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const dayAgo = new Date(now.getTime() - 24 * 3600e3).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600e3).toISOString()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600e3).toISOString()

  const [stageCounts, approvals, overdue, today, inbound, hot, newLeads, newest] = await Promise.all([
    Promise.all(
      CRM_STAGES.map(async (stage) => {
        const { count } = await withBroker(sb.from('crm_people').select('id', head).eq('stage', stage))
        return { stage, count: count ?? 0 }
      }),
    ),
    sb.from('crm_sequence_enrollments').select('id', head).eq('status', 'awaiting_broker'),
    withBroker(sb.from('crm_tasks').select('id', head).is('completed_at', null).lt('due_at', now.toISOString())),
    withBroker(
      sb.from('crm_tasks').select('id', head).is('completed_at', null)
        .gte('due_at', now.toISOString()).lte('due_at', endOfToday.toISOString()),
    ),
    sb.from('crm_timeline').select('id', head).in('kind', ['sms_in', 'email_in', 'call', 'voicemail']).gte('ts', dayAgo),
    sb.from('visitor_sessions').select('session_id', head).gte('hot_lead_fired_at', twoDaysAgo),
    withBroker(sb.from('crm_people').select('id', head).gte('created_at', weekAgo)),
    withBroker(
      sb.from('crm_people')
        .select('id,name,stage,source,picture_url,created_at,last_activity_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ),
  ])

  return {
    funnel: stageCounts.filter((s) => s.count > 0),
    attention: {
      approvalsPending: approvals.count ?? 0,
      tasksOverdue: overdue.count ?? 0,
      tasksToday: today.count ?? 0,
      inbound24h: inbound.count ?? 0,
      hotLeads48h: hot.count ?? 0,
      newLeads7d: newLeads.count ?? 0,
    },
    newest: (newest.data ?? []) as CrmHomeDashboard['newest'],
  }
}

export type CrmTimelineRow = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  source: string
  broker: string | null
  payload: Record<string, unknown>
}

export type CrmTaskRow = {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
  assigned_broker: string | null
  fub_legacy_id: number | null
}

export type CrmPersonFull = {
  person: (CrmPersonRow & {
    addresses: unknown[]
    custom: Record<string, unknown>
    background: string | null
    source_url: string | null
    picture_url: string | null
    fub_updated_at: string | null
  }) | null
  contactPoints: Array<{ id: number; kind: string; value: string; label: string | null; is_primary: boolean }>
  timeline: CrmTimelineRow[]
  timelineTotal: number
  tasks: CrmTaskRow[]
  suppressions: Array<{ id: number; channel: string; reason: string; source: string }>
  enrollments: Array<{ id: number; status: string; step_index: number; crm_sequences: { name: string } | null }>
  geo: Record<string, unknown> | null
  cmaDeliveries: Array<Record<string, unknown>>
  visitorSessions: number
}

export async function getCrmPersonFull(id: number): Promise<CrmPersonFull> {
  const sb = createServiceClient()
  const personQ = await sb.from('crm_people').select('*').eq('id', id).maybeSingle()
  const person = personQ.data as CrmPersonFull['person']

  const fubId = person?.fub_legacy_id ?? null
  const [points, timeline, tasks, suppressions, enrollments, geo, cma, visitors] = await Promise.all([
    sb.from('crm_contact_points').select('id,kind,value,label,is_primary').eq('person_id', id).order('is_primary', { ascending: false }),
    sb.from('crm_timeline').select('id,ts,kind,title,body,source,broker,payload', { count: 'exact' }).eq('person_id', id).order('ts', { ascending: false }).limit(100),
    sb.from('crm_tasks').select('id,name,type,due_at,completed_at,assigned_broker,fub_legacy_id').eq('person_id', id).order('completed_at', { ascending: true, nullsFirst: true }).order('due_at', { ascending: true }).limit(50),
    sb.from('crm_suppressions').select('id,channel,reason,source').eq('person_id', id),
    sb.from('crm_sequence_enrollments').select('id,status,step_index,crm_sequences(name)').eq('person_id', id),
    fubId ? sb.from('fub_person_geo').select('*').eq('fub_person_id', fubId).maybeSingle() : Promise.resolve({ data: null }),
    fubId ? sb.from('cma_deliveries').select('*').eq('fub_person_id', fubId).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    // visitor_sessions keys on session_id (no `id` column — selecting it errors and reads 0 forever)
    fubId ? sb.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).eq('fub_person_id', fubId) : Promise.resolve({ count: 0 }),
  ])

  // Merge the first-party website trail (visitor_events via this person's
  // identified sessions) into the timeline view — every site touchpoint
  // visible on the contact, no data duplication (read-time merge).
  let merged = (timeline.data ?? []) as CrmTimelineRow[]
  if (fubId) {
    const { data: sessions } = await sb
      .from('visitor_sessions')
      .select('session_id')
      .eq('fub_person_id', fubId)
      .order('last_seen_at', { ascending: false })
      .limit(20)
    const sessionIds = (sessions ?? []).map((s) => s.session_id)
    if (sessionIds.length) {
      const { data: vevents } = await sb
        .from('visitor_events')
        .select('id,event_at,event_type,page_url,page_title,listing_street,listing_city,dwell_seconds,scroll_depth_pct')
        .in('session_id', sessionIds)
        .order('event_at', { ascending: false })
        .limit(30)
      const visitorRows: CrmTimelineRow[] = (vevents ?? []).map((v) => ({
        id: -Number(v.id),
        ts: v.event_at as string,
        kind: 'web_event',
        title: [v.event_type, v.listing_street ? `${v.listing_street}, ${v.listing_city ?? ''}`.trim() : v.page_title]
          .filter(Boolean).join(' · ').slice(0, 180),
        body: [v.page_url, v.dwell_seconds ? `${v.dwell_seconds}s on page` : null, v.scroll_depth_pct ? `${v.scroll_depth_pct}% scroll` : null]
          .filter(Boolean).join(' · '),
        source: 'visitor',
        broker: null,
        payload: {},
      }))
      merged = [...merged, ...visitorRows]
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, 100)
    }
  }

  return {
    person,
    contactPoints: (points.data ?? []) as CrmPersonFull['contactPoints'],
    timeline: merged,
    timelineTotal: timeline.count ?? 0,
    tasks: (tasks.data ?? []) as CrmTaskRow[],
    suppressions: (suppressions.data ?? []) as CrmPersonFull['suppressions'],
    enrollments: (enrollments.data ?? []) as unknown as CrmPersonFull['enrollments'],
    geo: (geo as { data: Record<string, unknown> | null }).data ?? null,
    cmaDeliveries: ((cma as { data: Array<Record<string, unknown>> | null }).data ?? []),
    visitorSessions: (visitors as { count: number | null }).count ?? 0,
  }
}

// ── Mutations (dual-write) ─────────────────────────────────────────────────

async function getPersonCore(personId: number): Promise<{ id: number; fub_legacy_id: number | null; tags: string[]; stage: string } | null> {
  const sb = createServiceClient()
  const { data } = await sb.from('crm_people').select('id,fub_legacy_id,tags,stage').eq('id', personId).maybeSingle()
  return (data as { id: number; fub_legacy_id: number | null; tags: string[]; stage: string } | null) ?? null
}

function revalidateCrm(personId?: number) {
  revalidatePath('/admin/crm')
  if (personId) revalidatePath(`/admin/crm/${personId}`)
}

export async function addCrmNoteAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!personId || !body) return { ok: false, error: 'Note body required' }
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }

  const broker = access.access.brokerSlug ?? undefined
  if (person.fub_legacy_id) {
    const ok = await addPersonNote(person.fub_legacy_id, body, { broker })
    if (!ok) return { ok: false, error: 'FUB note write failed' }
    // mirror layer writes the local timeline row (with the broker stamp)
  } else {
    const sb = createServiceClient()
    const { error } = await sb.from('crm_timeline').insert({
      person_id: personId, kind: 'note', body, source: 'app', broker: broker ?? null,
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidateCrm(personId)
  return { ok: true }
}

/** Send a 1:1 email from the acting broker's own Gmail mailbox. Suppression-checked. */
export async function sendCrmEmailAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!personId || !subject || !body) return { ok: false, error: 'Subject and body required' }

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,emails,assigned_broker,name,first_name,custom')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Person not found' }
  const to = (person.emails as Array<{ value?: string; isPrimary?: number | boolean }>)
    ?.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value
  if (!to) return { ok: false, error: 'No email address on file' }

  const { isSuppressed } = await import('@/lib/crm/suppressions')
  const gate = await isSuppressed(personId, 'email')
  if (gate.suppressed) return { ok: false, error: `Blocked by suppression (${gate.reasons.join(', ')})` }

  // Merge tokens like the SMS path does — a template body with %first% must
  // never reach a client literally.
  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const actingSlugForLinks = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
  const mergedSubject = renderCrmMerge(subject, person)
  const mergedBody = attributeSiteLinks(renderCrmMerge(body, person), actingSlugForLinks)

  const { CRM_MAILBOXES, sendCrmEmail } = await import('@/lib/crm/gmail')
  const actingSlug = actingSlugForLinks
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
  const sent = await sendCrmEmail({ fromMailbox: mailbox.email, to, subject: mergedSubject, bodyText: mergedBody, withSignature: true })
  if (!sent.ok) return { ok: false, error: sent.error }

  await sb.from('crm_timeline').insert({
    person_id: personId, kind: 'email_out', title: mergedSubject, body: sent.plainBody,
    payload: { gmailId: sent.gmailId, to, mailbox: mailbox.email },
    broker: mailbox.slug, source: 'app', dedupe_key: `gmail:${sent.gmailId}:p${personId}`,
  })
  revalidateCrm(personId)
  return { ok: true }
}

export type CrmInboxRow = {
  id: number
  person_id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  broker: string | null
  person: { name: string | null; stage: string } | null
}

/** Latest inbound communications across all contacts (the unified inbox feed). */
export async function listCrmInbox(limit = 100): Promise<CrmInboxRow[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('id,person_id,ts,kind,title,body,broker,crm_people!inner(name,stage)')
    .in('kind', ['email_in', 'sms_in', 'call', 'voicemail'])
    .order('ts', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id as number,
    person_id: r.person_id as number,
    ts: r.ts as string,
    kind: r.kind as string,
    title: (r.title ?? null) as string | null,
    body: (r.body ?? null) as string | null,
    broker: (r.broker ?? null) as string | null,
    person: (r as unknown as { crm_people: { name: string | null; stage: string } }).crm_people ?? null,
  }))
}

export type CrmDealRow = {
  id: number
  name: string | null
  pipeline: string | null
  stage: string | null
  value: number | null
  entered_stage_at: string | null
  person_id: number | null
  person: { name: string | null } | null
}

export async function listCrmDeals(): Promise<CrmDealRow[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_deals')
    .select('id,name,pipeline,stage,value,entered_stage_at,person_id,crm_people(name)')
    .order('pipeline')
    .order('entered_stage_at', { ascending: false })
  return (data ?? []).map((r) => ({
    ...(r as unknown as Omit<CrmDealRow, 'person'>),
    person: (r as unknown as { crm_people: { name: string | null } | null }).crm_people ?? null,
  }))
}

export async function getCrmEmailTemplates(): Promise<Array<{ key: string; name: string; subject: string | null; body: string }>> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_templates')
    .select('key,name,subject,body')
    .eq('channel', 'email')
    .order('name')
  return (data ?? []) as Array<{ key: string; name: string; subject: string | null; body: string }>
}

export async function getCrmSmsTemplates(): Promise<Array<{ key: string; name: string; body: string }>> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_templates')
    .select('key,name,body')
    .eq('channel', 'sms')
    .order('name')
  return (data ?? []) as Array<{ key: string; name: string; body: string }>
}

// A2P campaign status changes on a multi-day carrier-review cadence — a live
// Twilio API roundtrip per admin page view is pure latency. 5-min cache.
const getCachedA2pStatus = unstable_cache(
  async () => {
    const { getA2pCampaignStatus } = await import('@/lib/crm/twilio')
    return getA2pCampaignStatus()
  },
  ['crm-a2p-status'],
  { revalidate: 300 },
)

export async function getTwilioSmsStatus(): Promise<{ a2p: string | null; canSend: boolean }> {
  const a2p = await getCachedA2pStatus()
  return { a2p, canSend: a2p === 'VERIFIED' }
}

/** Send a 1:1 SMS from the broker line via Twilio messaging service. Suppression-checked. */
export async function sendCrmSmsAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!personId || !body) return { ok: false, error: 'Message body required' }

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,phones,assigned_broker,name,first_name,custom')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Person not found' }

  let to =
    (person.phones as Array<{ value?: string; isPrimary?: number | boolean }> | null)
      ?.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value ?? ''
  if (!to) {
    const { data: pt } = await sb.from('crm_contact_points').select('value').eq('person_id', personId).eq('kind', 'phone').limit(1).maybeSingle()
    to = pt?.value ?? ''
  }
  if (!to) return { ok: false, error: 'No phone number on file' }

  const { isSuppressed } = await import('@/lib/crm/suppressions')
  const gate = await isSuppressed(personId, 'sms')
  if (gate.suppressed) return { ok: false, error: `Blocked by suppression (${gate.reasons.join(', ')})` }

  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const smsBrokerSlug = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
  const mergedBody = attributeSiteLinks(renderCrmMerge(body, person), smsBrokerSlug)
  const { sendSmsViaMessagingService } = await import('@/lib/crm/twilio')
  const sent = await sendSmsViaMessagingService({ to, body: mergedBody })
  if (!sent.ok) return { ok: false, error: sent.error }

  const actingSlug = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
  await sb.from('crm_timeline').insert({
    person_id: personId, kind: 'sms_out', title: 'Text sent', body: mergedBody,
    payload: { twilioSid: sent.sid, to },
    broker: actingSlug, source: 'app', dedupe_key: `twilio:${sent.sid}:p${personId}`,
  })
  revalidateCrm(personId)
  return { ok: true }
}

export type CrmSequenceRow = {
  id: number
  name: string
  status: string
  stop_on_reply: boolean
  steps: Array<{ channel: string; delayDays?: number; templateKey?: string; taskName?: string; addTags?: string[]; removeTags?: string[] }>
  fub_legacy_plan_id: number | null
  counts: { running: number; paused_reply: number; completed: number; stopped: number; suppressed: number }
}

export async function listCrmSequences(): Promise<CrmSequenceRow[]> {
  const sb = createServiceClient()
  const { data: seqs } = await sb
    .from('crm_sequences')
    .select('id,name,status,stop_on_reply,steps,fub_legacy_plan_id')
    .order('fub_legacy_plan_id', { ascending: true, nullsFirst: false })
  const out: CrmSequenceRow[] = []
  for (const s of seqs ?? []) {
    const counts = { running: 0, paused_reply: 0, completed: 0, stopped: 0, suppressed: 0 }
    const { data: rows } = await sb
      .from('crm_sequence_enrollments')
      .select('status')
      .eq('sequence_id', s.id)
    for (const r of rows ?? []) {
      const k = r.status as keyof typeof counts
      if (k in counts) counts[k]++
    }
    out.push({ ...(s as Omit<CrmSequenceRow, 'counts'>), counts })
  }
  return out
}

/** Activate or pause a sequence. Paused sequences' enrollments hold in place. */
export async function setCrmSequenceStatusAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const sequenceId = Number(formData.get('sequenceId'))
  const status = String(formData.get('status') ?? '')
  if (!sequenceId || !['active', 'paused'].includes(status)) return { ok: false, error: 'Bad input' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_sequences').update({ status, updated_at: new Date().toISOString() }).eq('id', sequenceId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/crm/sequences')
  return { ok: true }
}

export type BrokerLicenseRow = {
  slug: string
  display_name: string
  license_number: string | null
  license_type: string | null
  license_status: string | null
  license_expires_on: string | null
  license_checked_at: string | null
  nrds_id: string | null
}

/** License + membership info for the license card (broker sees own, superuser sees all). */
export async function listBrokerLicenses(): Promise<BrokerLicenseRow[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('brokers')
    .select('slug,display_name,license_number,license_type,license_status,license_expires_on,license_checked_at,nrds_id')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as BrokerLicenseRow[]
}

/** Reassign a contact to a broker — updates CRM + FUB assignedUserId + broker: tag, logs to timeline. */
export async function assignCrmBrokerAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const brokerSlug = String(formData.get('broker') ?? '').trim() as CrmBrokerSlug
  if (!personId || !(CRM_BROKERS as readonly string[]).includes(brokerSlug)) {
    return { ok: false, error: 'Broker required' }
  }
  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,tags,assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Person not found' }
  if (person.assigned_broker === brokerSlug) return { ok: true }

  const newTags = [
    ...(person.tags as string[]).filter((t) => !t.startsWith('broker:')),
    `broker:${brokerSlug}`,
  ]
  const { error } = await sb.from('crm_people').update({
    assigned_broker: brokerSlug,
    assigned_fub_user_id: FUB_USER_ID_BY_BROKER[brokerSlug],
    tags: newTags,
    updated_at: new Date().toISOString(),
  }).eq('id', personId)
  if (error) return { ok: false, error: error.message }
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Assigned to ${brokerSlug}${person.assigned_broker ? ` (was ${person.assigned_broker})` : ''}`,
    source: 'app',
    broker: access.access.brokerSlug,
  })
  if (person.fub_legacy_id) {
    await assignPersonToUser(person.fub_legacy_id, FUB_USER_ID_BY_BROKER[brokerSlug])
    await replacePersonTags(person.fub_legacy_id, newTags)
  }
  revalidateCrm(personId)
  return { ok: true }
}

export async function updateCrmStageAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const stage = String(formData.get('stage') ?? '').trim()
  if (!personId || !stage) return { ok: false, error: 'Stage required' }
  if (!(CRM_STAGES as readonly string[]).includes(stage)) return { ok: false, error: 'Unknown stage' }
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }
  if (person.stage === stage) return { ok: true }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_people').update({ stage, updated_at: new Date().toISOString() }).eq('id', personId)
  if (error) return { ok: false, error: error.message }
  await sb.from('crm_timeline').insert({
    person_id: personId, kind: 'stage_change',
    title: `Stage: ${person.stage} → ${stage}`, source: 'app',
  })
  if (person.fub_legacy_id) {
    await updatePersonAutomationState({ personId: person.fub_legacy_id, stage })
  }
  revalidateCrm(personId)
  return { ok: true }
}

export async function addCrmTagAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const tag = String(formData.get('tag') ?? '').trim().toLowerCase()
  if (!personId || !tag || tag.length > 80) return { ok: false, error: 'Tag required (max 80 chars)' }
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }
  if (person.tags.includes(tag)) return { ok: true }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_people').update({
    tags: [...person.tags, tag], updated_at: new Date().toISOString(),
  }).eq('id', personId)
  if (error) return { ok: false, error: error.message }
  if (person.fub_legacy_id) await addPersonTags(person.fub_legacy_id, [tag])
  revalidateCrm(personId)
  return { ok: true }
}

export async function removeCrmTagAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const tag = String(formData.get('tag') ?? '').trim()
  if (!personId || !tag) return { ok: false, error: 'Tag required' }
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }
  const nextTags = person.tags.filter((t) => t !== tag)
  if (nextTags.length === person.tags.length) return { ok: true }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_people').update({
    tags: nextTags, updated_at: new Date().toISOString(),
  }).eq('id', personId)
  if (error) return { ok: false, error: error.message }
  if (person.fub_legacy_id) await replacePersonTags(person.fub_legacy_id, nextTags)
  revalidateCrm(personId)
  return { ok: true }
}

export async function addCrmTaskAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const name = String(formData.get('name') ?? '').trim()
  const type = String(formData.get('type') ?? 'Follow Up')
  const dueHours = Math.max(0.05, Number(formData.get('dueHours') ?? 24))
  if (!personId || !name) return { ok: false, error: 'Task name required' }
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }

  if (person.fub_legacy_id) {
    const ok = await createRealtimeTask({
      personId: person.fub_legacy_id,
      taskName: name,
      taskType: (['Follow Up', 'Call', 'Text', 'Email'].includes(type) ? type : 'Follow Up') as 'Follow Up' | 'Call' | 'Text' | 'Email',
      dueInMinutes: Math.round(dueHours * 60),
    })
    if (!ok) return { ok: false, error: 'FUB task create failed' }
    // mirror layer writes the local task row
  } else {
    const sb = createServiceClient()
    const { error } = await sb.from('crm_tasks').insert({
      person_id: personId, name, type,
      due_at: new Date(Date.now() + dueHours * 3600 * 1000).toISOString(),
      origin: 'app',
    })
    if (error) return { ok: false, error: error.message }
  }
  revalidateCrm(personId)
  return { ok: true }
}

export type CrmOpenTask = {
  id: number
  name: string
  type: string | null
  due_at: string | null
  assigned_broker: string | null
  person_id: number | null
  person: { name: string | null; stage: string } | null
}

/** All open tasks across the book — the global Tasks page. */
export async function listCrmOpenTasks(broker?: string): Promise<CrmOpenTask[]> {
  const access = await requireCrmAccess()
  if (!access.ok) return []
  const sb = createServiceClient()
  let q = sb
    .from('crm_tasks')
    .select('id,name,type,due_at,assigned_broker,person_id,crm_people(name,stage)')
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(300)
  if (broker) q = q.eq('assigned_broker', broker)
  const { data } = await q
  return (data ?? []).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    type: (r.type ?? null) as string | null,
    due_at: (r.due_at ?? null) as string | null,
    assigned_broker: (r.assigned_broker ?? null) as string | null,
    person_id: (r.person_id ?? null) as number | null,
    person: (r as unknown as { crm_people: { name: string | null; stage: string } | null }).crm_people ?? null,
  }))
}

/**
 * Manual contact creation. Routes through the FUB events API (sendEvent) so
 * dedupe-by-email/phone and the standard enrollment pipeline behave exactly
 * like a site lead, then mirrors the person locally and returns the CRM id.
 */
export async function createCrmContactAction(formData: FormData): Promise<CrmActionResult & { personId?: number }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  const broker = String(formData.get('broker') ?? '').trim() || (access.access.brokerSlug ?? 'matt')
  if (!firstName) return { ok: false, error: 'First name required' }
  if (!email && !phone) return { ok: false, error: 'An email or a phone number is required' }

  const { sendEvent } = await import('@/lib/followupboss')
  const sent = await sendEvent({
    type: 'General Inquiry',
    source: 'Manual entry',
    system: 'RyanRealtyPlatform',
    person: {
      firstName,
      lastName: lastName || undefined,
      emails: email ? [{ value: email }] : undefined,
      phones: phone ? [{ value: phone }] : undefined,
    },
    message: note || `Added manually in the CRM by ${access.access.email}`,
    brokerAttribution: { brokerSlug: broker },
  })
  if (!sent.ok) return { ok: false, error: `FUB create failed: ${'error' in sent ? sent.error : sent.status}` }

  // Mirror into the local CRM and resolve the new local id.
  const sb = createServiceClient()
  let personId: number | undefined
  if (email) {
    const { mirrorPersonByEmail } = await import('@/lib/crm/mirror')
    await mirrorPersonByEmail(email)
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id')
      .eq('kind', 'email')
      .eq('value', email)
      .order('person_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    personId = (pt?.person_id as number | undefined) ?? undefined
  }
  if (!personId && phone) {
    const digits = phone.replace(/\D/g, '').slice(-10)
    const { data: pt } = await sb
      .from('crm_contact_points')
      .select('person_id,value')
      .eq('kind', 'phone')
      .ilike('value', `%${digits}`)
      .order('person_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    personId = (pt?.person_id as number | undefined) ?? undefined
  }
  revalidateCrm(personId)
  return { ok: true, personId }
}

export async function completeCrmTaskAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const taskId = Number(formData.get('taskId'))
  const personId = Number(formData.get('personId')) || undefined
  if (!taskId) return { ok: false, error: 'Task id required' }
  const sb = createServiceClient()
  const { data: task } = await sb.from('crm_tasks').select('id,fub_legacy_id').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'Task not found' }
  const { error } = await sb.from('crm_tasks').update({
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  if (task.fub_legacy_id) await completeFubTask(task.fub_legacy_id)
  revalidateCrm(personId)
  return { ok: true }
}

// ─── Workflow approval gate + board (Matt directive 2026-06-12) ─────────────
// New enrollments wait in status='awaiting_broker' with a prepared first
// touch. The broker approves (optionally editing the text), skips, or
// dismisses. The board actions move people through workflows manually.

export type AwaitingApproval = {
  enrollmentId: number
  personId: number
  personName: string | null
  assignedBroker: string | null
  source: string | null
  sequenceId: number
  sequenceName: string
  enrolledAt: string
  preview: { channel: string; body: string } | null
  cmaLink: string | null
}

export async function getAwaitingApprovals(): Promise<AwaitingApproval[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,created_at,crm_sequences!inner(id,name),crm_people!inner(id,name,source,assigned_broker,custom)')
    .eq('status', 'awaiting_broker')
    .order('created_at', { ascending: false })
    .limit(100)
  const { renderFirstTouchPreview } = await import('@/lib/crm/enroll')
  const out: AwaitingApproval[] = []
  for (const row of data ?? []) {
    const seq = row.crm_sequences as unknown as { id: number; name: string }
    const person = row.crm_people as unknown as { id: number; name: string | null; source: string | null; assigned_broker: string | null; custom: Record<string, unknown> | null }
    out.push({
      enrollmentId: row.id as number,
      personId: person.id,
      personName: person.name,
      assignedBroker: person.assigned_broker,
      source: person.source,
      sequenceId: seq.id,
      sequenceName: seq.name,
      enrolledAt: row.created_at as string,
      preview: await renderFirstTouchPreview(seq.id, person.id),
      cmaLink: (person.custom?.cmaLink as string | undefined) ?? null,
    })
  }
  return out
}

async function setEnrollment(
  enrollmentId: number,
  patch: Record<string, unknown>,
  timelineTitle: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'not authorized' }
  const sb = createServiceClient()
  const { data: en, error } = await sb
    .from('crm_sequence_enrollments')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId)
    .select('person_id')
    .maybeSingle()
  if (error || !en) return { ok: false, error: error?.message ?? 'enrollment not found' }
  await sb.from('crm_timeline').insert({
    person_id: en.person_id,
    kind: 'system',
    title: timelineTitle,
    source: 'workflow-board',
  })
  revalidatePath('/admin/crm/approvals')
  revalidatePath('/admin/crm/workflows')
  return { ok: true }
}

/** Approve the prepared first touch (optionally edited) and start the workflow. */
export async function approveEnrollmentAction(
  enrollmentId: number,
  editedBody?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'not authorized' }
  const trimmed = editedBody?.trim() || null
  return setEnrollment(
    enrollmentId,
    {
      status: 'running',
      next_run_at: new Date().toISOString(),
      approved_by: access.email,
      approved_at: new Date().toISOString(),
      ...(trimmed ? { first_touch_override: trimmed } : {}),
    },
    trimmed ? 'Workflow approved with edited first text' : 'Workflow approved — first touch queued to send',
  )
}

/** Start the workflow but skip the prepared first touch. */
export async function skipFirstTouchAction(enrollmentId: number) {
  const access = await getCrmAccess()
  if (!access) return { ok: false as const, error: 'not authorized' }
  return setEnrollment(
    enrollmentId,
    { status: 'running', step_index: 1, next_run_at: new Date().toISOString(), approved_by: access.email, approved_at: new Date().toISOString() },
    'Workflow started — first text skipped by broker',
  )
}

export async function dismissEnrollmentAction(enrollmentId: number) {
  return setEnrollment(enrollmentId, { status: 'stopped' }, 'Workflow dismissed by broker')
}

export async function pauseEnrollmentAction(enrollmentId: number) {
  return setEnrollment(enrollmentId, { status: 'paused' }, 'Workflow paused by broker')
}

export async function resumeEnrollmentAction(enrollmentId: number) {
  return setEnrollment(
    enrollmentId,
    { status: 'running', next_run_at: new Date().toISOString() },
    'Workflow resumed by broker',
  )
}

/** Run the next step now instead of waiting for its scheduled time. */
export async function advanceEnrollmentNowAction(enrollmentId: number) {
  return setEnrollment(
    enrollmentId,
    { next_run_at: new Date().toISOString() },
    'Next workflow step pulled forward by broker',
  )
}

export type CrmNextRec = {
  enrollmentId: number
  sequenceName: string
  stepIndex: number
  channel: string
  subjectPreview: string | null
  bodyPreview: string
  unresolved: string[]
  holdReason: string | null
} | null

/** The broker-confirmed "recommended next step" for a contact, fully rendered
 *  exactly as the lead would receive it. Drives the color-coded next-step card
 *  + the in-app message preview. Returns null when nothing is waiting. */
export async function getNextRecommendation(personId: number): Promise<CrmNextRec> {
  const access = await getCrmAccess()
  if (!access) return null
  const sb = createServiceClient()
  const { data: en } = await sb
    .from('crm_sequence_enrollments')
    .select('id,step_index,status,crm_sequences!inner(name,steps)')
    .eq('person_id', personId)
    .eq('status', 'awaiting_broker_next')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!en) return null
  const seq = en.crm_sequences as unknown as { name: string; steps: Array<Record<string, unknown>> }
  const step = (seq.steps ?? [])[en.step_index as number] as Record<string, unknown> | undefined
  if (!step) return null
  const { data: person } = await sb
    .from('crm_people')
    .select('first_name,name,custom')
    .eq('id', personId)
    .maybeSingle()
  const { renderCrmMerge, findUnresolvedMergeTokens, referencesCmaLink } = await import('@/lib/crm/merge')
  const p = (person ?? {}) as { first_name?: string | null; name?: string | null; custom?: Record<string, unknown> }
  const rawBody = String(step.body ?? step.taskName ?? '')
  const bodyPreview = renderCrmMerge(rawBody, p)
  const subjectPreview = step.subject ? renderCrmMerge(String(step.subject), p) : null
  const holdReason =
    referencesCmaLink(rawBody) && !((p.custom ?? {}) as Record<string, unknown>).cmaLink
      ? 'Holds until the CMA is built (the link is stamped at finalize)'
      : null
  return {
    enrollmentId: en.id as number,
    sequenceName: seq.name,
    stepIndex: en.step_index as number,
    channel: String(step.channel ?? 'step'),
    subjectPreview,
    bodyPreview,
    unresolved: findUnresolvedMergeTokens(`${subjectPreview ?? ''} ${bodyPreview}`),
    holdReason,
  }
}

export type BrokerActionItem = {
  personId: number
  personName: string
  sequenceName: string
  channel: string
  preview: string
  holdReason: string | null
}

/** Every lead with a broker-confirmed step waiting, scoped to the signed-in
 *  broker — the "what needs you" queue for the dashboard. Color-coded by channel. */
export async function getBrokerActionQueue(): Promise<BrokerActionItem[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const sb = createServiceClient()
  let q = sb
    .from('crm_sequence_enrollments')
    .select('person_id,step_index,crm_people!inner(name,first_name,custom,assigned_broker),crm_sequences!inner(name,steps)')
    .eq('status', 'awaiting_broker_next')
    .order('updated_at', { ascending: true })
    .limit(100)
  if (access.brokerSlug) q = q.eq('crm_people.assigned_broker', access.brokerSlug)
  const { data } = await q
  const { renderCrmMerge, referencesCmaLink } = await import('@/lib/crm/merge')
  const out: BrokerActionItem[] = []
  for (const r of data ?? []) {
    const person = r.crm_people as unknown as { name?: string | null; first_name?: string | null; custom?: Record<string, unknown> }
    const seq = r.crm_sequences as unknown as { name: string; steps: Array<Record<string, unknown>> }
    const step = (seq.steps ?? [])[r.step_index as number] as Record<string, unknown> | undefined
    if (!step) continue
    const raw = String(step.body ?? step.taskName ?? '')
    out.push({
      personId: r.person_id as number,
      personName: person.name ?? 'Unknown',
      sequenceName: seq.name,
      channel: String(step.channel ?? 'step'),
      preview: renderCrmMerge(raw, person).slice(0, 140),
      holdReason: referencesCmaLink(raw) && !((person.custom ?? {}) as Record<string, unknown>).cmaLink ? 'CMA building' : null,
    })
  }
  return out
}

/** Broker confirms the recommended next step — engine sends it on the next run. */
export async function confirmNextStepAction(enrollmentId: number) {
  const access = await getCrmAccess()
  if (!access) return { ok: false as const, error: 'not authorized' }
  return setEnrollment(
    enrollmentId,
    { status: 'running', next_run_at: new Date().toISOString(), approved_by: access.email, approved_at: new Date().toISOString() },
    'Recommended next step confirmed by broker — sending',
  )
}

/** Broker skips the recommended step — advance to the next, re-park if it is
 *  also broker-confirmed, complete if there are no more steps. */
export async function skipNextStepAction(enrollmentId: number) {
  const access = await getCrmAccess()
  if (!access) return { ok: false as const, error: 'not authorized' }
  const sb = createServiceClient()
  const { data: en } = await sb
    .from('crm_sequence_enrollments')
    .select('step_index,crm_sequences!inner(steps)')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (!en) return { ok: false as const, error: 'enrollment not found' }
  const steps = ((en.crm_sequences as unknown as { steps: unknown[] }).steps) ?? []
  const nextIdx = (en.step_index as number) + 1
  if (nextIdx >= steps.length) {
    return setEnrollment(enrollmentId, { status: 'completed', step_index: nextIdx }, 'Recommended step skipped — sequence complete')
  }
  const nextStep = steps[nextIdx] as { confirm?: boolean }
  return setEnrollment(
    enrollmentId,
    nextStep?.confirm
      ? { step_index: nextIdx, status: 'awaiting_broker_next', next_run_at: null }
      : { step_index: nextIdx, status: 'running', next_run_at: new Date().toISOString() },
    'Recommended step skipped by broker',
  )
}

export type WorkflowBoardSequence = {
  sequenceId: number
  sequenceName: string
  stepCount: number
  stepLabels: string[]
  enrollments: Array<{
    enrollmentId: number
    personId: number
    personName: string | null
    assignedBroker: string | null
    status: string
    stepIndex: number
    nextRunAt: string | null
    enrolledAt: string
  }>
}

export async function getWorkflowBoard(): Promise<WorkflowBoardSequence[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const sb = createServiceClient()
  const { data: seqs } = await sb
    .from('crm_sequences')
    .select('id,name,steps,status')
    .eq('status', 'active')
    .order('id')
  const { data: ens } = await sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,status,step_index,next_run_at,created_at,crm_people!inner(id,name,assigned_broker)')
    .in('status', ['awaiting_broker', 'running', 'paused', 'paused_reply'])
    .order('created_at', { ascending: false })
    .limit(500)
  return (seqs ?? []).map((s) => {
    const steps = (s.steps as Array<{ channel?: string; delayDays?: number; taskName?: string }> | null) ?? []
    return {
      sequenceId: s.id as number,
      sequenceName: s.name as string,
      stepCount: steps.length,
      stepLabels: steps.map((st, i) => `${i + 1}. ${st.channel ?? 'step'}${st.delayDays ? ` +${st.delayDays}d` : ''}`),
      enrollments: (ens ?? [])
        .filter((e) => e.sequence_id === s.id)
        .map((e) => {
          const p = e.crm_people as unknown as { id: number; name: string | null; assigned_broker: string | null }
          return {
            enrollmentId: e.id as number,
            personId: p.id,
            personName: p.name,
            assignedBroker: p.assigned_broker,
            status: e.status as string,
            stepIndex: e.step_index as number,
            nextRunAt: e.next_run_at as string | null,
            enrolledAt: e.created_at as string,
          }
        }),
    }
  })
}
