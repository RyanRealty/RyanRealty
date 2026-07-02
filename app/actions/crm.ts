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
  addPersonTags,
  assignPersonToUser,
  completeFubTask,
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
import { scopeBroker, isPersonInScope } from '@/lib/crm/scope'
import { isQualifyingStage, fireQualifiedLeadEvent } from '@/lib/meta/qualifiedEvent'

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
  price: number | null
  timeframe: string | null
  pond_id: number | null
}

export type CrmListFilters = {
  q?: string
  stage?: string
  broker?: string
  tag?: string
  view?: string
  page?: number
  /** §07 scope dropdown: restrict to one pond (crm_people.pond_id). */
  pond?: string
}

export type CrmSavedView = {
  id: number
  name: string
  description: string | null
  filter: { stage?: string; tagsAny?: string[] }
  position: number
}

const PAGE_SIZE = 50

export async function requireCrmAccess(): Promise<{ ok: true; access: CrmAccess } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  return { ok: true, access }
}

// The broker-RBAC policy (Option A — Matt is owner/superuser) lives in
// lib/crm/scope.ts as a PURE, unit-tested helper (`scopeBroker`), imported above.
// It is NOT re-exported from this 'use server' file because Next.js requires every
// export of a 'use server' module to be an async function. Pages + this module
// import `scopeBroker` directly from '@/lib/crm/scope'. Returns the slug a caller's
// reads/writes must scope to, or `null` for an owner/superuser (sees ALL brokers).

/**
 * Shared write guard: refuse a mutation when the caller is a restricted broker
 * and the target contact is not assigned to them. A superuser (slug === null)
 * passes unconditionally. Mirrors completeCrmTaskAction's inline ownership check.
 * Exported so the membership + relationship mutations in sibling action files
 * (crm-membership.ts, crm-relationships.ts) reuse the one guard.
 */
export async function requirePersonInScope(
  personId: number,
  access: CrmAccess,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = scopeBroker(access)
  if (!slug) return { ok: true }
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', personId)
    .maybeSingle()
  if (!isPersonInScope(slug, (data?.assigned_broker as string | null) ?? null)) {
    return { ok: false, error: 'Not authorized for this contact' }
  }
  return { ok: true }
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

  // SELF-SCOPING (HIGH, GAP-D1): this is the primary contacts read, so it must
  // enforce broker RBAC ITSELF — never trust the page to pass the right
  // ?broker=. Resolve the caller, derive their scope, and AND it onto
  // assigned_broker UNCONDITIONALLY. A restricted broker (scope non-null) can
  // never widen past their own slug — scope overrides any wider filters.broker
  // the URL tries to pass; a superuser (scope null) falls back to the requested
  // filter. A caller with no CRM access sees nothing.
  const access = await getCrmAccess()
  if (!access) {
    return { rows: [], total: 0, page, pageSize: PAGE_SIZE, appliedView: null }
  }
  const scope = scopeBroker(access)
  const effectiveBroker = scope ?? filters.broker

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
      'id,fub_legacy_id,name,first_name,last_name,stage,source,assigned_broker,tags,emails,phones,last_activity_at,fub_created_at,picture_url,price,timeframe,pond_id',
      { count: 'exact' },
    )
    // Baseline: never return soft-deleted contacts (matches getCrmStageCounts /
    // getCrmSavedViewsWithCounts, which already filter deleted=false).
    .eq('deleted', false)

  const stage = filters.stage || appliedView?.filter?.stage
  if (stage) query = query.eq('stage', stage)
  const tagsAny = filters.tag ? [filters.tag] : appliedView?.filter?.tagsAny
  if (tagsAny?.length) query = query.overlaps('tags', tagsAny)
  if (effectiveBroker) query = query.eq('assigned_broker', effectiveBroker)
  // Pond scope (§07): a view-level overlay, applied alongside broker scope so a
  // restricted broker still can't widen past their own book.
  const pondId = Number(filters.pond)
  if (filters.pond && Number.isInteger(pondId) && pondId > 0) query = query.eq('pond_id', pondId)

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

export async function getCrmOverview(brokerSlug?: string | null): Promise<CrmOverview> {
  const sb = createServiceClient()
  const head = { count: 'exact' as const, head: true }
  // GAP-2: scope the headline KPI counts to the caller's own book when restricted.
  // The page passes scopeBroker(access) — null (superuser) leaves them global.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byBroker = (q: any): any => (brokerSlug ? q.eq('assigned_broker', brokerSlug) : q)
  const [total, sellers, buyers, hardStops, openTasks, lastSync] = await Promise.all([
    byBroker(sb.from('crm_people').select('id', head)),
    byBroker(sb.from('crm_people').select('id', head).contains('tags', ['audience:seller'])),
    byBroker(sb.from('crm_people').select('id', head).contains('tags', ['audience:buyer'])),
    byBroker(sb.from('crm_people').select('id', head).contains('tags', ['compliance:hard-stop'])),
    byBroker(sb.from('crm_tasks').select('id', head).is('completed_at', null)),
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
  // A task >31 days overdue is FUB import cruft, not real work — exclude from the
  // overdue count so it matches the filtered action pile (Matt 2026-06-15).
  const staleTaskFloor = new Date(now.getTime() - 31 * 24 * 3600e3).toISOString()

  const [stageCounts, approvals, overdue, today, inbound, hot, newLeads, newest] = await Promise.all([
    Promise.all(
      CRM_STAGES.map(async (stage) => {
        const { count } = await withBroker(sb.from('crm_people').select('id', head).eq('stage', stage))
        return { stage, count: count ?? 0 }
      }),
    ),
    sb.from('crm_sequence_enrollments').select('id', head).eq('status', 'awaiting_broker'),
    withBroker(sb.from('crm_tasks').select('id', head).is('completed_at', null).lt('due_at', now.toISOString()).gte('due_at', staleTaskFloor)),
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
  /** §07b 8.1 star toggle — Starred Items tab. */
  starred?: boolean
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
  contactPoints: Array<{ id: number; kind: string; value: string; label: string | null; is_primary: boolean; status?: string | null }>
  timeline: CrmTimelineRow[]
  timelineTotal: number
  tasks: CrmTaskRow[]
  suppressions: Array<{ id: number; channel: string; reason: string; source: string }>
  enrollments: Array<{ id: number; status: string; step_index: number; crm_sequences: { name: string } | null }>
  geo: Record<string, unknown> | null
  cmaDeliveries: Array<Record<string, unknown>>
  visitorSessions: number
}

/** The empty bundle returned for a missing OR out-of-scope contact (GAP-0). The
 *  page calls notFound() on a null person, so this produces a clean 404. */
const EMPTY_PERSON_FULL: CrmPersonFull = {
  person: null,
  contactPoints: [],
  timeline: [],
  timelineTotal: 0,
  tasks: [],
  suppressions: [],
  enrollments: [],
  geo: null,
  cmaDeliveries: [],
  visitorSessions: 0,
}

export async function getCrmPersonFull(id: number): Promise<CrmPersonFull> {
  const sb = createServiceClient()
  const personQ = await sb.from('crm_people').select('*').eq('id', id).maybeSingle()
  const person = personQ.data as CrmPersonFull['person']

  // GAP-0 (highest risk): broker-RBAC gate. A self-guard so the contact 360
  // can't be read by id — null access OR an out-of-scope lead returns the same
  // empty bundle the page already treats as notFound(). Closes every side-panel
  // at once (they are all fed person.id from this bundle).
  const access = await getCrmAccess()
  if (!access) return EMPTY_PERSON_FULL
  const slug = scopeBroker(access)
  if (slug && !isPersonInScope(slug, (person?.assigned_broker as string | null) ?? null)) {
    return EMPTY_PERSON_FULL
  }

  const fubId = person?.fub_legacy_id ?? null
  const [points, timeline, tasks, suppressions, enrollments, geo, cma, visitors] = await Promise.all([
    sb.from('crm_contact_points').select('id,kind,value,label,is_primary,status').eq('person_id', id).order('is_primary', { ascending: false }),
    sb.from('crm_timeline').select('id,ts,kind,title,body,source,broker,payload,starred', { count: 'exact' }).eq('person_id', id).order('ts', { ascending: false }).limit(100),
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }

  const broker = access.access.brokerSlug ?? undefined
  // FUB DECOMMISSIONED (2026-06-24): the CRM is the system of record. The old
  // path gated the note on addPersonNote(fub_legacy_id) and relied on the (dead)
  // mirror sync to write the local row — so notes on ANY imported contact
  // silently failed ("FUB note write failed", 2026-07-02 audit P0). Write the
  // local timeline row directly for every contact.
  const sb = createServiceClient()
  const { error } = await sb.from('crm_timeline').insert({
    person_id: personId, kind: 'note', body, source: 'app', broker: broker ?? null,
  })
  if (error) return { ok: false, error: error.message }
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,emails,phones,addresses,assigned_broker,name,first_name,last_name,stage,source,lender_name,custom')
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
  // never reach a client literally. The context resolves agent/sender/company
  // tokens from real data (brokers + crm_company_settings).
  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const actingSlugForLinks = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
  const mergeCtx = await buildMergeContext({ person, senderSlug: actingSlugForLinks })
  const mergedSubject = renderCrmMerge(subject, person, mergeCtx)
  const mergedBody = attributeSiteLinks(renderCrmMerge(body, person, mergeCtx), actingSlugForLinks, person.fub_legacy_id as number | null)

  const { CRM_MAILBOXES, sendCrmEmail } = await import('@/lib/crm/gmail')
  const actingSlug = actingSlugForLinks
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
  const sent = await sendCrmEmail({
    fromMailbox: mailbox.email, to, subject: mergedSubject, bodyText: mergedBody, withSignature: true,
    // Instrument open/click like the sequence engine so the conversation
    // engagement panel ("Opened N×") works for manually-composed emails too.
    // label MUST equal the subject — the panel keys engagement on the email title.
    // Stamp tpl:<key> when a template was used so email_events rows are
    // queryable per-template in getTemplatePerformance / perf columns.
    track: {
      personId,
      emailKey: (() => {
        const tplKey = String(formData.get('tplKey') ?? '').trim()
        return tplKey ? `tpl:${tplKey}:${personId}:${Date.now()}` : `manual:${personId}:${Date.now()}`
      })(),
      label: mergedSubject,
    },
  })
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

/**
 * Live count per stage for the People "Stages" segment (the leads-list stage
 * chips, docs/MOBILE_CRM_FUB_PARITY.md #3 — "Seller Prospect 7.5k"). Broker-
 * scoped like every other dashboard read. One head-count per stage, run in
 * parallel; no rows returned.
 */
export async function getCrmStageCounts(brokerSlug?: string | null): Promise<Record<string, number>> {
  const sb = createServiceClient()
  const head = { count: 'exact' as const, head: true }
  const entries = await Promise.all(
    CRM_STAGES.map(async (stage) => {
      let q = sb.from('crm_people').select('id', head).eq('deleted', false).eq('stage', stage)
      if (brokerSlug) q = q.eq('assigned_broker', brokerSlug)
      const { count } = await q
      return [stage, count ?? 0] as const
    }),
  )
  return Object.fromEntries(entries)
}

export type SavedViewCount = { id: number; name: string; description: string | null; count: number }

/**
 * Saved views (the smart-list store, crm_saved_views) with a live count each —
 * the People "All Lists" segment (docs/MOBILE_CRM_FUB_PARITY.md #3, FUB: "All
 * Expireds 657"). Each view's own filter (stage or tagsAny) drives the count,
 * broker-scoped to match what opening the list will show. listCrmPeople already
 * applies a view by id, so a chip just links to ?view=<id>.
 */
export async function getCrmSavedViewsWithCounts(brokerSlug?: string | null): Promise<SavedViewCount[]> {
  const sb = createServiceClient()
  const head = { count: 'exact' as const, head: true }
  const { data: views } = await sb
    .from('crm_saved_views')
    .select('id,name,description,filter,position')
    .order('position', { nullsFirst: false })
    .order('id')
  const list = (views ?? []) as Array<{ id: number; name: string; description: string | null; filter: { stage?: string; tagsAny?: string[] } | null }>
  return Promise.all(
    list.map(async (v) => {
      let q = sb.from('crm_people').select('id', head).eq('deleted', false)
      if (v.filter?.stage) q = q.eq('stage', v.filter.stage)
      if (v.filter?.tagsAny?.length) q = q.overlaps('tags', v.filter.tagsAny)
      if (brokerSlug) q = q.eq('assigned_broker', brokerSlug)
      const { count } = await q
      return { id: v.id, name: v.name, description: v.description, count: count ?? 0 }
    }),
  )
}

export type ActivityPerson = { personId: number; name: string; pictureUrl: string | null; ts: string; label: string }

/**
 * Named-people activity for the broker dashboard "Right now" feed
 * (docs/MOBILE_CRM_FUB_PARITY.md #3). Matt 2026-06-16: show WHO — the latest
 * person on the site, who opened/sent email — not a wall of anonymous session
 * IDs. Each row resolves crm_timeline events to a named crm_people row and links
 * to that lead. Latest event per person, broker-scoped.
 */
async function recentActivityPeople(
  kinds: string[],
  labelFor: (kind: string) => string,
  brokerSlug?: string | null,
  limit = 12,
): Promise<ActivityPerson[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('person_id,ts,kind,crm_people(name,picture_url,assigned_broker,deleted)')
    .in('kind', kinds)
    .order('ts', { ascending: false })
    .limit(300)
  const seen = new Set<number>()
  const out: ActivityPerson[] = []
  type Joined = { person_id: number; ts: string; kind: string; crm_people: { name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean } | Array<{ name: string | null; picture_url: string | null; assigned_broker: string | null; deleted: boolean }> | null }
  for (const r of (data ?? []) as unknown as Joined[]) {
    const p = Array.isArray(r.crm_people) ? r.crm_people[0] : r.crm_people
    if (!p || p.deleted || !p.name) continue
    if (brokerSlug && p.assigned_broker !== brokerSlug) continue
    if (seen.has(r.person_id)) continue
    seen.add(r.person_id)
    out.push({ personId: r.person_id, name: p.name, pictureUrl: p.picture_url, ts: r.ts, label: labelFor(r.kind) })
    if (out.length >= limit) break
  }
  return out
}

/** Latest identified people who visited the website (named, newest first). */
export async function getRecentWebsiteVisitors(brokerSlug?: string | null, limit = 12): Promise<ActivityPerson[]> {
  return recentActivityPeople(['web_event'], () => 'Viewed the site', brokerSlug, limit)
}

/** Latest people with email activity — who opened your email or emailed you. */
export async function getRecentEmailPeople(brokerSlug?: string | null, limit = 12): Promise<ActivityPerson[]> {
  const label = (k: string) => (k === 'email_open' ? 'Opened your email' : k === 'email_in' ? 'Emailed you' : 'You emailed')
  return recentActivityPeople(['email_open', 'email_in', 'email_out'], label, brokerSlug, limit)
}

export type RecentLead = {
  id: number
  name: string | null
  stage: string
  source: string | null
  pictureUrl: string | null
  createdAt: string
}

/**
 * Recently-added leads for the broker dashboard "New leads" activity segment
 * (docs/MOBILE_CRM_FUB_PARITY.md #3). Broker-scoped the same way the rest of the
 * dashboard reads are — a slug sees only their own, a superuser sees everyone.
 */
export async function getRecentNewLeads(limit = 12): Promise<RecentLead[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const sb = createServiceClient()
  let q = sb
    .from('crm_people')
    .select('id,name,stage,source,picture_url,created_at,assigned_broker')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (access.brokerSlug) q = q.eq('assigned_broker', access.brokerSlug)
  const { data } = await q
  return (data ?? []).map((r) => ({
    id: r.id as number,
    name: (r.name ?? null) as string | null,
    stage: (r.stage ?? 'Lead') as string,
    source: (r.source ?? null) as string | null,
    pictureUrl: (r.picture_url ?? null) as string | null,
    createdAt: r.created_at as string,
  }))
}

export type CrmConversationRow = {
  id: number
  person_id: number
  ts: string
  kind: string
  direction: 'in' | 'out'
  title: string | null
  body: string | null
  broker: string | null
  assignedBroker: string | null
  person: { name: string | null; stage: string } | null
}

/**
 * Conversations across inbound AND outbound channels for the segmented inbox
 * (docs/MOBILE_CRM_FUB_PARITY.md #2 — Inbox / Assigned / Sent). The page splits
 * the rows by direction + assignment; counts are derived there. Closed + an
 * unread badge are intentionally absent — crm_timeline has no read/closed state
 * to back them honestly (would need a conversation-status column).
 */
export async function listCrmConversations(perDirection = 80, brokerSlug?: string | null): Promise<CrmConversationRow[]> {
  const sb = createServiceClient()
  // Embed the person (name/stage/assigned_broker). person_id is NOT NULL with an
  // FK, so an inner embed matches every row. Fetch inbound and outbound
  // SEPARATELY: outbound (automated email) is high-volume, so a single
  // time-ordered limit would starve the Inbox segment of recent inbound.
  // GAP-4: when scoped, filter BOTH selects by the embedded owner so the Inbox +
  // Sent tabs only show the caller's own contacts. The page passes scopeBroker.
  const select = 'id,person_id,ts,kind,title,body,broker,crm_people!inner(name,stage,assigned_broker)'
  const scoped = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any => (brokerSlug ? q.eq('crm_people.assigned_broker', brokerSlug) : q)
  const [inbound, outbound] = await Promise.all([
    scoped(sb.from('crm_timeline').select(select).in('kind', ['email_in', 'sms_in', 'call', 'voicemail'])).order('ts', { ascending: false }).limit(perDirection),
    scoped(sb.from('crm_timeline').select(select).in('kind', ['email_out', 'sms_out'])).order('ts', { ascending: false }).limit(perDirection),
  ])
  const data = [...(inbound.data ?? []), ...(outbound.data ?? [])]
  return data.map((r) => {
    const p = (r as unknown as { crm_people: { name: string | null; stage: string; assigned_broker: string | null } | null }).crm_people ?? null
    const kind = r.kind as string
    return {
      id: r.id as number,
      person_id: r.person_id as number,
      ts: r.ts as string,
      kind,
      direction: kind.endsWith('_out') ? ('out' as const) : ('in' as const),
      title: (r.title ?? null) as string | null,
      body: (r.body ?? null) as string | null,
      broker: (r.broker ?? null) as string | null,
      assignedBroker: p?.assigned_broker ?? null,
      person: p ? { name: p.name, stage: p.stage } : null,
    }
  })
}

// listCrmDeals retired 2026-07-01 (deals-desktop rebuild): the board now reads
// through lib/data/crm/listDealsBoard.ts (DAL — scope + §13 status/agent filters
// + the crm_deal_people junction for multi-contact cards).

export async function getCrmEmailTemplates(): Promise<Array<{ key: string; name: string; subject: string | null; body: string; category: string | null }>> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_templates')
    .select('key,name,subject,body,category')
    .eq('channel', 'email')
    .order('name')
  return (data ?? []) as Array<{ key: string; name: string; subject: string | null; body: string; category: string | null }>
}

export async function getCrmSmsTemplates(): Promise<Array<{ key: string; name: string; body: string; category: string | null; featured: boolean }>> {
  const sb = createServiceClient()
  // Featured templates (§13.2.3 "Feature" toggle) sort first so they surface
  // prominently in the quick-text picker.
  const { data } = await sb
    .from('crm_templates')
    .select('key,name,body,category,featured')
    .eq('channel', 'sms')
    .order('featured', { ascending: false })
    .order('name')
  return ((data ?? []) as Array<{ key: string; name: string; body: string; category: string | null; featured: boolean | null }>).map(
    (t) => ({ ...t, featured: t.featured === true }),
  )
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped

  // Group text: the broker can quick-add other people linked to the lead (e.g. a
  // spouse) in the composer. `recipientIds` is a comma-separated list of extra
  // crm_people ids; the same message goes to each and is logged on each timeline.
  const extraIds = String(formData.get('recipientIds') ?? '')
    .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0 && n !== personId)
  const recipientIds = [personId, ...Array.from(new Set(extraIds))]

  // TCPA quiet hours: one time-based check for the whole send. Block 9pm–8am
  // Pacific unless the broker explicitly overrides (a deliberate manual reply).
  const { inSmsQuietHours } = await import('@/lib/crm/quiet-hours')
  const override = String(formData.get('overrideQuietHours') ?? '') === '1'
  if (inSmsQuietHours() && !override) {
    return { ok: false, error: 'Quiet hours (TCPA): texts pause 9pm to 8am Pacific. Call instead, or check "send anyway" to override.' }
  }

  const sb = createServiceClient()
  const { getSendTarget } = await import('@/lib/data/crm/getSendTarget')
  const { isSuppressed } = await import('@/lib/crm/suppressions')
  const { renderCrmMerge, attributeSiteLinks } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const { sendSms, sendSmsViaMessagingService, brokerTwilioNumber } = await import('@/lib/crm/twilio')

  let sentCount = 0
  let lastError: string | null = null

  // Native group MMS: 2+ recipients → ONE real carrier group thread (everyone
  // sees everyone's number and messages) via Twilio Conversations, with the
  // broker's line projected into the group. Replies are recorded by the
  // Conversations webhook (app/api/twilio/conversations-events). Falls through
  // to the per-recipient broadcast below if the group can't be formed (a member
  // out of scope / suppressed / no phone, no broker line, or Twilio rejects).
  if (recipientIds.length >= 2) {
    const primaryTarget = await getSendTarget(personId)
    const slug = access.access.brokerSlug ?? (primaryTarget?.person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
    const proxy = await brokerTwilioNumber(slug)
    if (proxy && primaryTarget) {
      const members: Array<{ rid: number; phone: string }> = []
      let blocked = false
      for (const rid of recipientIds) {
        if (rid !== personId) {
          const s = await requirePersonInScope(rid, access.access)
          if (!s.ok) { blocked = true; break }
        }
        const t = await getSendTarget(rid)
        if (!t || !t.phone) { blocked = true; break }
        if ((await isSuppressed(rid, 'sms')).suppressed) { blocked = true; break }
        members.push({ rid, phone: t.phone })
      }
      if (!blocked && members.length >= 2) {
        const groupCtx = await buildMergeContext({ person: primaryTarget.person, senderSlug: slug })
        const mergedBody = attributeSiteLinks(renderCrmMerge(body, primaryTarget.person, groupCtx), slug, primaryTarget.person.fub_legacy_id as number | null)
        const { sendGroupMms } = await import('@/lib/crm/twilio-conversations')
        const group = await sendGroupMms({
          projectedAddress: proxy,
          participants: members.map((m) => m.phone),
          body: mergedBody,
          friendlyName: `Group · ${primaryTarget.person.name ?? personId}`,
        })
        if (group.ok) {
          for (const m of members) {
            await sb.from('crm_timeline').insert({
              person_id: m.rid, kind: 'sms_out', title: 'Group text sent', body: mergedBody,
              payload: { conversationSid: group.conversationSid, messageSid: group.messageSid, groupTo: members.map((x) => x.phone) },
              broker: slug, source: 'app', dedupe_key: `twilio:${group.messageSid}:p${m.rid}`,
            })
          }
          members.forEach((m) => revalidateCrm(m.rid))
          return { ok: true }
        }
        console.warn('[crm] group MMS failed, falling back to broadcast:', group.error)
      }
    }
  }

  for (const rid of recipientIds) {
    // Every recipient (including extras) must be in the broker's scope.
    if (rid !== personId) {
      const s = await requirePersonInScope(rid, access.access)
      if (!s.ok) { lastError = 'A recipient is outside your scope'; continue }
    }
    const target = await getSendTarget(rid)
    if (!target || !target.phone) { lastError = 'No phone number on file'; continue }
    const gate = await isSuppressed(rid, 'sms')
    if (gate.suppressed) { lastError = `Blocked by suppression (${gate.reasons.join(', ')})`; continue }

    const person = target.person
    const to = target.phone
    const slug = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
    const smsCtx = await buildMergeContext({ person, senderSlug: slug })
    const mergedBody = attributeSiteLinks(renderCrmMerge(body, person, smsCtx), slug, person.fub_legacy_id as number | null)
    // Send from the broker's OWN Twilio business line, else the A2P service.
    const fromNumber = await brokerTwilioNumber(slug)
    const sent = fromNumber
      ? await sendSms({ from: fromNumber, to, body: mergedBody })
      : await sendSmsViaMessagingService({ to, body: mergedBody })
    if (!sent.ok) { lastError = sent.error; continue }

    await sb.from('crm_timeline').insert({
      person_id: rid, kind: 'sms_out', title: 'Text sent', body: mergedBody,
      payload: { twilioSid: sent.sid, to },
      broker: slug, source: 'app', dedupe_key: `twilio:${sent.sid}:p${rid}`,
    })
    sentCount++
  }

  if (sentCount === 0) return { ok: false, error: lastError ?? 'No recipient could be texted' }
  recipientIds.forEach((rid) => revalidateCrm(rid))
  return { ok: true }
}

/**
 * Click-to-call: ring the acting broker's own cell, then bridge to the lead and
 * record the conversation (Twilio cutover 2026-06-24). The call is logged to the
 * timeline immediately (kind 'call', direction out); the recording webhook
 * attaches the audio + transcript by CallSid. Replaces the untracked tel: link.
 */
export async function startCrmCallAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  if (!personId) return { ok: false, error: 'personId required' }
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped

  const sb = createServiceClient()
  const { getSendTarget } = await import('@/lib/data/crm/getSendTarget')
  const target = await getSendTarget(personId)
  if (!target) return { ok: false, error: 'Person not found' }
  const person = target.person
  const to = target.phone
  if (!to) return { ok: false, error: 'No phone number on file' }

  const callingBroker = access.access.brokerSlug ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'
  const { brokerTwilioNumber, forwardCellForBroker, toE164, startOutboundCall, TWILIO_PUBLIC_ORIGIN } = await import('@/lib/crm/twilio')
  const [fromNumber, brokerCell] = await Promise.all([brokerTwilioNumber(callingBroker), forwardCellForBroker(callingBroker)])
  if (!fromNumber || !brokerCell) return { ok: false, error: 'Your Twilio business number or forwarding cell is not configured' }
  const leadE164 = toE164(to)
  if (!leadE164) return { ok: false, error: 'Invalid lead phone number' }

  const call = await startOutboundCall({
    toCell: brokerCell,
    fromNumber,
    bridgeUrl: `${TWILIO_PUBLIC_ORIGIN}/api/twilio/outbound-bridge`,
  })
  if (!call.ok) return { ok: false, error: call.error }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'call',
    title: 'Outbound call',
    payload: { callSid: call.sid, toNumber: leadE164, fromNumber, direction: 'out', forwardedTo: brokerCell, recordingConsent: 'announced' },
    broker: callingBroker,
    source: 'app',
    dedupe_key: `twilio:call:${call.sid}:p${personId}`,
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
  // Pause/Activate is an owner op — matches every other sequence mutation
  // (a restricted broker must not toggle a shared outbound nurture sequence).
  if (access.access.role !== 'superuser') return { ok: false, error: 'Only an owner can pause or activate a workflow.' }
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
  // Reassigning a lead is an OWNER operation (Option A, GAP-W elevated). Only a
  // superuser (Matt) may move a lead between brokers — a restricted broker
  // (scopeBroker non-null) is refused outright, so no one can steal a lead.
  if (scopeBroker(access.access) !== null) {
    return { ok: false, error: 'Not authorized — only an owner can reassign a contact' }
  }
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
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
  // Automation trigger dispatch: fire stage_changed so any crm_automation_rules
  // rows or sequence-level triggers that match this stage can enroll the person.
  // Non-blocking — a trigger failure must never abort the stage update.
  void import('@/lib/crm/trigger-dispatch').then(({ fireTrigger }) =>
    fireTrigger('stage_changed', stage, personId).catch((e) =>
      console.warn('[crm] trigger-dispatch stage_changed failed:', e),
    ),
  )
  // CRM→CAPI qualified loop: a lead crossing INTO a qualifying stage (from a
  // non-qualifying one) fires a Meta quality event so Meta learns which leads
  // convert. Fire-and-forget + dry-run-safe (gated by META_CAPI_QUALIFIED_ENABLED);
  // never blocks the stage update.
  if (isQualifyingStage(stage) && !isQualifyingStage(person.stage)) {
    void fireQualifiedLeadEvent({ personId, stage }).catch((e) =>
      console.warn('[crm] qualified CAPI event failed (non-blocking):', e),
    )
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
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

/** Add a phone or email to a contact (§25.5.4/25.5.5 — FUB supports multiple
 *  contact points per person; the mobile Info tab's "Add phone / Add email"
 *  flow lands here). Inserts into crm_contact_points (primary only when it is
 *  the person's first point of that kind) + a timeline audit row. */
export async function addCrmContactPointAction(formData: FormData): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(formData.get('personId'))
  const kind = String(formData.get('kind') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim() || null
  let value = String(formData.get('value') ?? '').trim()
  if (!personId || (kind !== 'phone' && kind !== 'email')) return { ok: false, error: 'Kind required' }
  if (kind === 'phone') {
    const digits = value.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
    if (digits.length !== 10) return { ok: false, error: 'Phone must be 10 digits' }
    value = digits
  } else {
    value = value.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { ok: false, error: 'Valid email required' }
  }
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped

  const sb = createServiceClient()
  const { data: existing } = await sb
    .from('crm_contact_points')
    .select('id,value')
    .eq('person_id', personId)
    .eq('kind', kind)
  if ((existing ?? []).some((p) => p.value === value)) return { ok: true } // already on file
  const { error } = await sb.from('crm_contact_points').insert({
    person_id: personId,
    kind,
    value,
    label,
    is_primary: (existing ?? []).length === 0,
  })
  if (error) return { ok: false, error: error.message }
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `${kind === 'phone' ? 'Phone' : 'Email'} added${label ? ` (${label})` : ''}: ${value}`,
    source: 'app',
    broker: access.access.brokerSlug ?? null,
  })
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
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
  const person = await getPersonCore(personId)
  if (!person) return { ok: false, error: 'Person not found' }

  // FUB DECOMMISSIONED (2026-06-24): always write the task natively. The old
  // fub_legacy_id branch routed through the now-dead FUB API (createRealtimeTask)
  // and returned WITHOUT writing a local crm_tasks row — so task creation was
  // silently broken for the ~18K imported (fub_legacy_id) contacts. crm_tasks is
  // the system of record now.
  const sb = createServiceClient()
  const { error } = await sb.from('crm_tasks').insert({
    person_id: personId,
    name,
    type,
    due_at: new Date(Date.now() + dueHours * 3600 * 1000).toISOString(),
    assigned_broker: access.access.brokerSlug ?? null,
    origin: 'app',
  })
  if (error) return { ok: false, error: error.message }
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
  // Drop tasks >31 days overdue (FUB import cruft, not real work — Matt
  // 2026-06-15) while keeping tasks with no due date.
  const staleTaskFloor = new Date(Date.now() - 31 * 24 * 3600e3).toISOString()
  let q = sb
    .from('crm_tasks')
    .select('id,name,type,due_at,assigned_broker,person_id,crm_people(name,stage)')
    .is('completed_at', null)
    .or(`due_at.is.null,due_at.gte.${staleTaskFloor}`)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(300)
  // GAP-3: default to the caller's own scope instead of "all brokers". A
  // restricted broker (scope non-null) can't widen past their own slug — their
  // scope overrides any wider ?broker= the URL tries to pass.
  const scope = scopeBroker(access.access)
  const effective = scope ?? broker
  if (effective) q = q.eq('assigned_broker', effective)
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
  // §16 Add Person modal: optional lead source captured at creation time.
  const source = String(formData.get('source') ?? '').trim() || 'Manual entry'
  if (!firstName) return { ok: false, error: 'First name required' }
  if (!email && !phone) return { ok: false, error: 'An email or a phone number is required' }

  const { sendEvent } = await import('@/lib/followupboss')
  const sent = await sendEvent({
    type: 'General Inquiry',
    source,
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
  const { data: task } = await sb.from('crm_tasks').select('id,fub_legacy_id,assigned_broker').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'Task not found' }
  // Ownership: a non-superuser broker may only complete their own tasks.
  if (access.access.role !== 'superuser' && access.access.brokerSlug && (task.assigned_broker ?? null) !== access.access.brokerSlug) {
    return { ok: false, error: 'not authorized for this task' }
  }
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
  // GAP-5: scope the read to the caller's own queued leads (the write is already
  // guarded by setEnrollment). The query already inner-joins crm_people.
  const slug = scopeBroker(access)
  let q = sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,created_at,crm_sequences!inner(id,name),crm_people!inner(id,name,source,assigned_broker,custom)')
    .eq('status', 'awaiting_broker')
    .order('created_at', { ascending: false })
    .limit(100)
  if (slug) q = q.eq('crm_people.assigned_broker', slug)
  const { data } = await q
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
  // Ownership: a non-superuser broker may only act on their own leads'
  // enrollments (the queue scopes the READ; this scopes the WRITE).
  if (access.role !== 'superuser' && access.brokerSlug) {
    const { data: own } = await sb
      .from('crm_sequence_enrollments')
      .select('crm_people!inner(assigned_broker)')
      .eq('id', enrollmentId)
      .maybeSingle()
    const owner = (own?.crm_people as unknown as { assigned_broker?: string | null } | null)?.assigned_broker ?? null
    if (owner !== access.brokerSlug) return { ok: false, error: 'not authorized for this lead' }
  }
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

/** Resolve a step's subject/body for PREVIEW — mirrors the engine exactly: a
 *  templateKey overrides inline subject/body from crm_templates. Without this the
 *  preview (and every guard built on it) inspects an empty inline body while the
 *  engine sends the template — a broker could one-click-send text never seen. */
async function resolveStepContent(
  sb: ReturnType<typeof createServiceClient>,
  step: Record<string, unknown>,
): Promise<{ subject: string | null; body: string }> {
  let subject = step.subject != null ? String(step.subject) : null
  let body = String(step.body ?? '')
  const templateKey = step.templateKey != null ? String(step.templateKey) : ''
  if (templateKey) {
    const { data: tpl } = await sb.from('crm_templates').select('subject,body').eq('key', templateKey).maybeSingle()
    if (tpl) {
      if (tpl.subject != null) subject = tpl.subject
      if (tpl.body != null) body = tpl.body
    }
  }
  return { subject, body }
}

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
    .select('first_name,last_name,name,stage,source,lender_name,emails,phones,addresses,assigned_broker,custom')
    .eq('id', personId)
    .maybeSingle()
  const { renderCrmMerge, findUnresolvedMergeTokens, referencesCmaLink } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const p = (person ?? {}) as { first_name?: string | null; name?: string | null; assigned_broker?: string | null; custom?: Record<string, unknown> }
  const mergeCtx = await buildMergeContext({ person: p, senderSlug: p.assigned_broker ?? null })
  const channel = String(step.channel ?? 'step')
  const isMessage = channel === 'email' || channel === 'sms'
  const resolved = await resolveStepContent(sb, step)
  const rawBody = resolved.body || String(step.taskName ?? '')
  const bodyPreview = renderCrmMerge(rawBody, p, mergeCtx)
  const subjectPreview = resolved.subject ? renderCrmMerge(resolved.subject, p, mergeCtx) : null
  const holdReason =
    referencesCmaLink(rawBody) && !((p.custom ?? {}) as Record<string, unknown>).cmaLink
      ? 'Holds until the CMA is built (the link is stamped at finalize)'
      : isMessage && !rawBody.trim()
        ? 'Message content is missing — check the template'
        : null
  return {
    enrollmentId: en.id as number,
    sequenceName: seq.name,
    stepIndex: en.step_index as number,
    channel,
    subjectPreview,
    bodyPreview,
    unresolved: findUnresolvedMergeTokens(`${subjectPreview ?? ''} ${bodyPreview}`),
    holdReason,
  }
}

export type BrokerActionItem = {
  enrollmentId: number
  personId: number
  personName: string
  firstName: string | null
  sequenceName: string
  channel: string
  subjectPreview: string | null
  preview: string
  /** Merge tokens that did not resolve — the one-click send is blocked while any remain. */
  unresolved: string[]
  holdReason: string | null
}

/** Every lead with a broker-confirmed step waiting, scoped to the signed-in
 *  broker — the "what needs you" queue for the dashboard. Each item carries the
 *  enrollment id + a fully rendered preview so the dashboard can confirm-and-send
 *  the exact message in one click (and refuse to when it would send broken text). */
export async function getBrokerActionQueue(): Promise<BrokerActionItem[]> {
  const access = await getCrmAccess()
  if (!access) return []
  const sb = createServiceClient()
  let q = sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,step_index,crm_people!inner(name,first_name,last_name,stage,source,lender_name,custom,assigned_broker,emails,phones,addresses),crm_sequences!inner(name,steps)')
    .eq('status', 'awaiting_broker_next')
    .order('updated_at', { ascending: true })
    .limit(100)
  if (access.brokerSlug) q = q.eq('crm_people.assigned_broker', access.brokerSlug)
  const { data } = await q
  const { renderCrmMerge, referencesCmaLink, findUnresolvedMergeTokens } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const out: BrokerActionItem[] = []
  for (const r of data ?? []) {
    const person = r.crm_people as unknown as {
      name?: string | null; first_name?: string | null; assigned_broker?: string | null
      custom?: Record<string, unknown>
      emails?: Array<{ value?: string }> | null
    }
    const seq = r.crm_sequences as unknown as { name: string; steps: Array<Record<string, unknown>> }
    const step = (seq.steps ?? [])[r.step_index as number] as Record<string, unknown> | undefined
    if (!step) continue
    const channel = String(step.channel ?? 'step')
    const isMessage = channel === 'email' || channel === 'sms'
    // Resolve templateKey so the preview + every guard match what the engine sends.
    const resolved = await resolveStepContent(sb, step)
    const rawBody = resolved.body || String(step.taskName ?? '')
    const mergeCtx = await buildMergeContext({ person, senderSlug: person.assigned_broker ?? null })
    const preview = renderCrmMerge(rawBody, person, mergeCtx)
    const subjectPreview = resolved.subject ? renderCrmMerge(resolved.subject, person, mergeCtx) : null
    const cmaPending = referencesCmaLink(rawBody) && !((person.custom ?? {}) as Record<string, unknown>).cmaLink
    // email has NO contact-points fallback in the engine, so empty emails[] is a
    // guaranteed non-delivery — surface it rather than show a Send that no-ops.
    const noEmail = channel === 'email' && !(Array.isArray(person.emails) && person.emails.some((e) => e?.value))
    const holdReason = cmaPending
      ? 'Waiting on the CMA'
      : isMessage && !rawBody.trim()
        ? 'Message not ready — check the template'
        : noEmail
          ? 'No email on file'
          : null
    out.push({
      enrollmentId: r.id as number,
      personId: r.person_id as number,
      personName: person.name ?? 'Unknown',
      firstName: person.first_name ?? null,
      sequenceName: seq.name,
      channel,
      subjectPreview: subjectPreview ? subjectPreview.slice(0, 120) : null,
      preview: preview.slice(0, 140),
      unresolved: findUnresolvedMergeTokens(`${subjectPreview ?? ''} ${preview}`),
      holdReason,
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
  // GAP-6: scope active enrollments to the caller's own leads. The query already
  // inner-joins crm_people; sequence DEFINITIONS above stay shared (all-brokers).
  const slug = scopeBroker(access)
  let enQ = sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,status,step_index,next_run_at,created_at,crm_people!inner(id,name,assigned_broker)')
    .in('status', ['awaiting_broker', 'running', 'paused', 'paused_reply'])
    .order('created_at', { ascending: false })
    .limit(500)
  if (slug) enQ = enQ.eq('crm_people.assigned_broker', slug)
  const { data: ens } = await enQ
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
