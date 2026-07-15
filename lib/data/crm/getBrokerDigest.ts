/**
 * getBrokerDigest — assembles a single broker's daily/weekly digest entirely
 * from the self-owned crm_* tables, replacing the Follow Up Boss People API the
 * digest crons used to read (CONTACT360 Phase 10.4 — broker reporting repoint).
 *
 * Before this, /api/cron/daily-broker-digest pulled every new lead from the FUB
 * People API (resolveFubUserId -> /people?assignedUserId&createdAfter) and the
 * weekly digest aggregated FUB people/deals/appointments. That meant the digest
 * stopped working the moment we cut over off FUB. This reader sources every
 * section from our own CRM, scoped to one broker by their slug (the value stored
 * in crm_people.assigned_broker / crm_tasks.assigned_broker):
 *
 *   - newLeads:        crm_people created in the window, assigned to the broker,
 *                      EXCLUDING outreach-list rows (Farm/Import/Sphere/Expired/
 *                      FSBO batches we build ourselves — classified via
 *                      leadSourceTaxonomy, the same discriminator getLeadIntake
 *                      uses; a digest that counts every crm_people row as a
 *                      "lead" mislabels bulk prospecting imports as leads).
 *                      Excluded rows surface separately as outreachAdded.
 *   - openTasks:       crm_tasks not completed, due (or overdue) for the broker.
 *   - activeEnrollments: this broker's leads on a workflow that is hot or awaiting
 *                      a broker action (crm_sequence_enrollments live statuses).
 *   - recentInbound:   inbound contact in the window (crm_timeline sms_in /
 *                      email_in / form_submit / voicemail) for the broker's leads.
 *
 * The pure shaping (summarizeDigest) is exported and unit-tested; the DB reads
 * are thin. DAL boundary (G1): the raw .from() reads live here in lib/data/.
 * createServiceClient bypasses RLS (a cron has no user session).
 *
 * FLAG: every figure here now traces to crm_* — nothing in this reader touches
 * FUB. The lead deep-link is the CRM page /admin/crm/{personId} (our own admin),
 * not a FUB person page.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { classifyLeadSource } from './leadSourceTaxonomy'

/** Inbound crm_timeline kinds that count as a real inbound touch from a contact. */
export const INBOUND_TIMELINE_KINDS = ['sms_in', 'email_in', 'form_submit', 'voicemail'] as const

/**
 * Enrollment statuses that mean the lead is HOT (actively running) or AWAITING a
 * broker action — the rows a broker should see surfaced in a digest. Mirrors the
 * live set in getContactMemberships, minus the plain-paused state (paused but not
 * awaiting reply is not a digest action item).
 */
export const DIGEST_ENROLLMENT_STATUSES = [
  'running',
  'awaiting_broker',
  'awaiting_broker_next',
  'paused_reply',
] as const

export type DigestLeadRow = {
  personId: number
  name: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  source: string | null
  stage: string | null
  tags: string[]
  createdAtIso: string
  lastActivityIso: string | null
}

export type DigestTaskRow = {
  taskId: number
  personId: number | null
  personName: string | null
  name: string
  type: string | null
  dueAtIso: string | null
}

export type DigestEnrollmentRow = {
  enrollmentId: number
  personId: number
  personName: string | null
  sequenceName: string
  status: string
  nextRunIso: string | null
}

export type DigestInboundRow = {
  timelineId: number
  personId: number
  personName: string | null
  kind: string
  title: string | null
  body: string | null
  tsIso: string
}

/** Raw rows assembled from crm_* for one broker over the window. */
export type BrokerDigestRows = {
  broker: { slug: string; firstName: string }
  windowStartIso: string
  asOfDate: string
  newLeads: DigestLeadRow[]
  openTasks: DigestTaskRow[]
  activeEnrollments: DigestEnrollmentRow[]
  recentInbound: DigestInboundRow[]
  /**
   * Contacts created in the window whose source classifies as an outreach list
   * (leadSourceTaxonomy outreachList — Farm/Import/Sphere/Expired/FSBO). These
   * are NOT leads and are excluded from newLeads. Optional for backward
   * compatibility with pre-partition callers/tests.
   */
  outreachAdded?: number
}

export type DigestLead = {
  personId: number
  name: string
  email: string | null
  phone: string | null
  source: string | null
  audience: 'seller' | 'buyer' | 'unknown'
  lastActivityIso: string | null
  crmUrl: string
}

export type DigestSummary = {
  asOfDate: string
  brokerFirstName: string
  counts: {
    newLeads: number
    sellers: number
    buyers: number
    unclassified: number
    openTasks: number
    overdueTasks: number
    activeEnrollments: number
    awaitingBroker: number
    recentInbound: number
  }
  leads: DigestLead[]
  tasks: Array<{ taskId: number; name: string; personName: string | null; dueAtIso: string | null; overdue: boolean }>
  enrollments: Array<{
    enrollmentId: number
    personName: string | null
    sequenceName: string
    status: string
    awaiting: boolean
  }>
  inbound: Array<{ timelineId: number; personName: string | null; kind: string; snippet: string | null; tsIso: string }>
  /** Outreach-list contacts added in the window (not leads — see BrokerDigestRows). */
  outreachAdded?: number
  /** One-line plain-English headline, brand voice, no banned words. */
  summarySentence: string
}

const AWAITING_STATUSES = new Set(['awaiting_broker', 'awaiting_broker_next', 'paused_reply'])

/** The CRM deep link for a contact (our own admin, not FUB). */
export function crmContactUrl(personId: number): string {
  return `https://ryan-realty.com/admin/crm/${personId}`
}

/** Pure: classify a lead's audience from its tags, matching the digest crons. */
export function classifyAudience(tags: string[] | null | undefined): 'seller' | 'buyer' | 'unknown' {
  if (!Array.isArray(tags)) return 'unknown'
  const lower = tags.map((t) => String(t).toLowerCase())
  if (lower.includes('audience:seller')) return 'seller'
  if (lower.includes('audience:buyer')) return 'buyer'
  if (lower.includes('seller')) return 'seller'
  if (lower.includes('buyer')) return 'buyer'
  return 'unknown'
}

function leadName(row: DigestLeadRow): string {
  if (row.name?.trim()) return row.name.trim()
  const joined = [row.firstName, row.lastName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  if (joined) return joined
  if (row.email?.trim()) return row.email.trim()
  return `Contact ${row.personId}`
}

function snippet(title: string | null, body: string | null): string | null {
  const text = (body?.trim() || title?.trim()) ?? ''
  if (!text) return null
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

/**
 * Pure shaping of the raw crm_* rows into the digest sections + counts the email
 * template renders. No I/O. Unit-tested. Brand voice on the summary sentence
 * (sentence case, no em-dashes, no banned words).
 */
export function summarizeDigest(rows: BrokerDigestRows): DigestSummary {
  const leads: DigestLead[] = rows.newLeads.map((l) => ({
    personId: l.personId,
    name: leadName(l),
    email: l.email,
    phone: l.phone,
    source: l.source,
    audience: classifyAudience(l.tags),
    lastActivityIso: l.lastActivityIso ?? l.createdAtIso,
    crmUrl: crmContactUrl(l.personId),
  }))

  const sellers = leads.filter((l) => l.audience === 'seller').length
  const buyers = leads.filter((l) => l.audience === 'buyer').length
  const unclassified = leads.length - sellers - buyers

  const tasks = rows.openTasks.map((t) => {
    const overdue = t.dueAtIso ? new Date(t.dueAtIso).getTime() < Date.now() : false
    return { taskId: t.taskId, name: t.name, personName: t.personName, dueAtIso: t.dueAtIso, overdue }
  })
  const overdueTasks = tasks.filter((t) => t.overdue).length

  const enrollments = rows.activeEnrollments.map((e) => ({
    enrollmentId: e.enrollmentId,
    personName: e.personName,
    sequenceName: e.sequenceName,
    status: e.status,
    awaiting: AWAITING_STATUSES.has(e.status),
  }))
  const awaitingBroker = enrollments.filter((e) => e.awaiting).length

  const inbound = rows.recentInbound.map((i) => ({
    timelineId: i.timelineId,
    personName: i.personName,
    kind: i.kind,
    snippet: snippet(i.title, i.body),
    tsIso: i.tsIso,
  }))

  return {
    asOfDate: rows.asOfDate,
    brokerFirstName: rows.broker.firstName,
    counts: {
      newLeads: leads.length,
      sellers,
      buyers,
      unclassified,
      openTasks: tasks.length,
      overdueTasks,
      activeEnrollments: enrollments.length,
      awaitingBroker,
      recentInbound: inbound.length,
    },
    leads,
    tasks,
    enrollments,
    inbound,
    outreachAdded: rows.outreachAdded,
    summarySentence: buildSummarySentence({
      newLeads: leads.length,
      sellers,
      buyers,
      unclassified,
      awaitingBroker,
      overdueTasks,
      recentInbound: inbound.length,
      outreachAdded: rows.outreachAdded,
    }),
  }
}

/** Pure: the brand-voice headline sentence for the digest. */
export function buildSummarySentence(c: {
  newLeads: number
  sellers: number
  buyers: number
  unclassified: number
  awaitingBroker: number
  overdueTasks: number
  recentInbound: number
  /** Outreach-list contacts added in the window — reported separately, never as leads. */
  outreachAdded?: number
}): string {
  const parts: string[] = []

  if (c.newLeads === 0) {
    parts.push('No new leads in this window.')
  } else if (c.newLeads === 1) {
    parts.push('You got 1 new lead.')
  } else {
    const mix: string[] = []
    if (c.sellers > 0) mix.push(`${c.sellers} ${c.sellers === 1 ? 'seller' : 'sellers'}`)
    if (c.buyers > 0) mix.push(`${c.buyers} ${c.buyers === 1 ? 'buyer' : 'buyers'}`)
    if (c.unclassified > 0) mix.push(`${c.unclassified} unclassified`)
    parts.push(mix.length > 0 ? `You got ${c.newLeads} new leads, ${mix.join(', ')}.` : `You got ${c.newLeads} new leads.`)
  }

  if ((c.outreachAdded ?? 0) > 0) {
    const n = c.outreachAdded as number
    parts.push(`${n} ${n === 1 ? 'contact was' : 'contacts were'} added from outreach lists, not counted as leads.`)
  }

  if (c.awaitingBroker > 0) {
    parts.push(`${c.awaitingBroker} ${c.awaitingBroker === 1 ? 'contact is' : 'contacts are'} awaiting your next step.`)
  }
  if (c.recentInbound > 0) {
    parts.push(`${c.recentInbound} inbound ${c.recentInbound === 1 ? 'reply' : 'replies'} came in.`)
  }
  if (c.overdueTasks > 0) {
    parts.push(`${c.overdueTasks} ${c.overdueTasks === 1 ? 'task is' : 'tasks are'} overdue.`)
  }

  return parts.join(' ')
}

/**
 * Assemble one broker's digest rows from crm_*, scoped by their slug, over a
 * window starting at windowStartIso. Returns the typed raw rows; call
 * summarizeDigest(rows) to shape them for the email.
 */
export async function getBrokerDigest(params: {
  brokerSlug: string
  brokerFirstName: string
  windowStartIso: string
  asOfDate: string
  /** Soonest, to keep the email digestible. Defaults are sane for a daily run. */
  leadLimit?: number
  taskLimit?: number
  enrollmentLimit?: number
  inboundLimit?: number
}): Promise<BrokerDigestRows> {
  const {
    brokerSlug,
    brokerFirstName,
    windowStartIso,
    asOfDate,
    leadLimit = 100,
    taskLimit = 50,
    enrollmentLimit = 50,
    inboundLimit = 50,
  } = params

  const sb = createServiceClient()
  const slug = brokerSlug.trim()

  const empty: BrokerDigestRows = {
    broker: { slug, firstName: brokerFirstName },
    windowStartIso,
    asOfDate,
    newLeads: [],
    openTasks: [],
    activeEnrollments: [],
    recentInbound: [],
  }
  if (!slug) return empty

  // 1. New leads created in the window, assigned to this broker. The digest
  //    counts LEADS, not list rows: prospecting/import batches (Farm, the
  //    expired/FSBO crons, bulk imports) also create crm_people rows, and a
  //    morning email calling those "new leads" is wrong — getLeadIntake is the
  //    org-wide rule (outreach lists are never leads). Classification is
  //    keyword JS (leadSourceTaxonomy), so it cannot run server-side: page ALL
  //    window rows (PostgREST caps one response at 1000, and a big outreach
  //    batch would otherwise crowd genuine leads out of a single page), then
  //    partition in app code. Outreach rows are counted, never listed as leads.
  type NewLeadPersonRow = {
    id: unknown
    name: unknown
    first_name: unknown
    last_name: unknown
    emails: unknown
    phones: unknown
    source: unknown
    stage: unknown
    tags: unknown
    created_at: unknown
    last_activity_at: unknown
  }
  const newLeadsP = (async (): Promise<{ leads: NewLeadPersonRow[]; outreachAdded: number }> => {
    const rows: NewLeadPersonRow[] = []
    const PAGE = 1000
    for (let from = 0; from < 100_000; from += PAGE) {
      const { data, error } = await sb
        .from('crm_people')
        .select('id,name,first_name,last_name,emails,phones,source,stage,tags,created_at,last_activity_at')
        .eq('assigned_broker', slug)
        .eq('deleted', false)
        .gte('created_at', windowStartIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[getBrokerDigest] newLeads page error', error.message)
        break
      }
      const page = (data ?? []) as NewLeadPersonRow[]
      rows.push(...page)
      if (page.length < PAGE) break
    }
    let outreachAdded = 0
    const leads: NewLeadPersonRow[] = []
    for (const r of rows) {
      // Outreach-list rows are not leads. Everything else (inbound, manual,
      // unknown source) still surfaces so a hand-keyed contact is not hidden.
      if (classifyLeadSource((r.source as string | null) ?? null).outreachList) outreachAdded += 1
      else leads.push(r)
    }
    return { leads: leads.slice(0, leadLimit), outreachAdded }
  })()

  // 2. Open (uncompleted) tasks for this broker, soonest due first.
  const openTasksP = sb
    .from('crm_tasks')
    .select('id,person_id,name,type,due_at,crm_people(name)')
    .eq('assigned_broker', slug)
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(taskLimit)

  // 3. Hot / awaiting enrollments for this broker's leads. crm_sequence_enrollments
  //    has no broker column, so we join the owning person's assigned_broker.
  const enrollmentsP = sb
    .from('crm_sequence_enrollments')
    .select('id,status,next_run_at,person_id,crm_people!inner(name,assigned_broker),crm_sequences(name)')
    .eq('crm_people.assigned_broker', slug)
    .in('status', [...DIGEST_ENROLLMENT_STATUSES])
    .order('next_run_at', { ascending: true, nullsFirst: false })
    .limit(enrollmentLimit)

  // 4. Recent inbound contact in the window for this broker's leads.
  const inboundP = sb
    .from('crm_timeline')
    .select('id,person_id,kind,title,body,ts,crm_people!inner(name,assigned_broker)')
    .eq('crm_people.assigned_broker', slug)
    .in('kind', [...INBOUND_TIMELINE_KINDS])
    .gte('ts', windowStartIso)
    .order('ts', { ascending: false })
    .limit(inboundLimit)

  const [newLeadsRes, openTasksRes, enrollmentsRes, inboundRes] = await Promise.all([
    newLeadsP,
    openTasksP,
    enrollmentsP,
    inboundP,
  ])

  const newLeads: DigestLeadRow[] = newLeadsRes.leads.map((r) => ({
    personId: Number(r.id),
    name: (r.name as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    email: firstJsonbValue(r.emails),
    phone: firstJsonbValue(r.phones),
    source: (r.source as string | null) ?? null,
    stage: (r.stage as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdAtIso: String(r.created_at),
    lastActivityIso: (r.last_activity_at as string | null) ?? null,
  }))

  const openTasks: DigestTaskRow[] = (openTasksRes.data ?? []).map((r) => ({
    taskId: Number(r.id),
    personId: r.person_id === null || r.person_id === undefined ? null : Number(r.person_id),
    personName: relatedName(r.crm_people),
    name: String(r.name ?? ''),
    type: (r.type as string | null) ?? null,
    dueAtIso: (r.due_at as string | null) ?? null,
  }))

  const activeEnrollments: DigestEnrollmentRow[] = (enrollmentsRes.data ?? []).map((r) => ({
    enrollmentId: Number(r.id),
    personId: Number(r.person_id),
    personName: relatedName(r.crm_people),
    sequenceName: relatedName(r.crm_sequences) ?? 'Workflow',
    status: String(r.status ?? ''),
    nextRunIso: (r.next_run_at as string | null) ?? null,
  }))

  const recentInbound: DigestInboundRow[] = (inboundRes.data ?? []).map((r) => ({
    timelineId: Number(r.id),
    personId: Number(r.person_id),
    personName: relatedName(r.crm_people),
    kind: String(r.kind ?? ''),
    title: (r.title as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    tsIso: String(r.ts),
  }))

  return {
    broker: { slug, firstName: brokerFirstName },
    windowStartIso,
    asOfDate,
    newLeads,
    openTasks,
    activeEnrollments,
    recentInbound,
    outreachAdded: newLeadsRes.outreachAdded,
  }
}

// ---------------------------------------------------------------------------
// Weekly pipeline digest (Matt-only) — crm_* sourced aggregates
//
// The weekly digest used to aggregate the FUB People API + FUB deals +
// appointments + smart lists + conversations. This repoints every section that
// has a clean crm_* source: new leads by audience and by source (crm_people,
// outreach-list rows partitioned out via leadSourceTaxonomy), active deals +
// pipeline value (crm_deals), and conversation volume (crm_timeline). The
// route sources appointments from crm_appointments; FUB smart-list movement
// has no crm_* equivalent and was dropped at the 2026-06-24 FUB decommission
// (getFubApiKey() is hardcoded undefined — a fetched zero would be fabricated).
// ---------------------------------------------------------------------------

export type WeeklyLeadRow = { tags: string[]; source: string | null }

export type WeeklyPipelineRows = {
  weekStartIso: string
  /** Window rows EXCLUDING outreach-list sources (leadSourceTaxonomy). */
  newLeads: WeeklyLeadRow[]
  /** Outreach-list contacts added in the window (Farm/Import/Sphere/Expired/FSBO) — not leads. */
  outreachAdded: number
  activeDeals: { count: number; value: number }
  conversations: number
}

export type WeeklyLeadSummary = {
  byAudience: Array<{ label: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  totalNewLeads: number
}

/**
 * Pure: tally the week's new leads by audience and by source. No I/O.
 * Unit-tested. Mirrors the audience labels the weekly email expects.
 */
export function summarizeWeeklyLeads(rows: WeeklyLeadRow[]): WeeklyLeadSummary {
  const audienceMap = new Map<'seller' | 'buyer' | 'unknown', number>()
  const sourceMap = new Map<string, number>()
  for (const r of rows) {
    const a = classifyAudience(r.tags)
    audienceMap.set(a, (audienceMap.get(a) ?? 0) + 1)
    const s = (r.source ?? '').trim() || 'Unknown'
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1)
  }

  const byAudience = [
    { label: 'Seller', count: audienceMap.get('seller') ?? 0 },
    { label: 'Buyer', count: audienceMap.get('buyer') ?? 0 },
    { label: 'Unclassified', count: audienceMap.get('unknown') ?? 0 },
  ].filter((r) => r.count > 0)

  const bySource = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  return { byAudience, bySource, totalNewLeads: rows.length }
}

/** Active-deal stages that should NOT count toward the open pipeline. */
const CLOSED_DEAL_MARKERS = ['lost', 'closed', 'won', 'dead']

/** Pure: count open deals + sum their value, skipping closed/lost/won stages. */
export function summarizeActiveDeals(
  deals: Array<{ stage: string | null; status: string | null; value: number | null }>,
): { count: number; value: number } {
  let count = 0
  let value = 0
  for (const d of deals) {
    const stage = (d.stage ?? '').toLowerCase()
    const status = (d.status ?? '').toLowerCase()
    if (CLOSED_DEAL_MARKERS.some((m) => stage.includes(m) || status.includes(m))) continue
    count += 1
    const v = Number(d.value)
    if (Number.isFinite(v)) value += v
  }
  return { count, value }
}

/** crm_timeline kinds that count as a two-way conversation touch (in or out). */
const CONVERSATION_KINDS = [
  'sms_in',
  'sms_out',
  'email_in',
  'email_out',
  'call',
  'voicemail',
] as const

/**
 * Assemble the weekly pipeline digest's crm_*-sourced aggregates over the window
 * starting at weekStartIso. Brokerage-wide (the weekly digest is Matt-only, not
 * per-broker). Returns raw rows; shape leads via summarizeWeeklyLeads and deals
 * via summarizeActiveDeals.
 *
 * New-lead accuracy: every crm_people row created in the week is paged in
 * (PostgREST caps a single response at 1000, so a plain .limit() silently
 * truncates on bulk-import weeks) and classified via leadSourceTaxonomy —
 * outreach-list rows (Farm/Import/Sphere/Expired/FSBO) are counted in
 * outreachAdded and never reported as leads, matching getLeadIntake. leadLimit
 * only caps the returned LEAD rows (weekly inbound volume is far below it).
 */
export async function getWeeklyPipelineDigest(params: {
  weekStartIso: string
  leadLimit?: number
}): Promise<WeeklyPipelineRows> {
  const { weekStartIso, leadLimit = 2000 } = params
  const sb = createServiceClient()

  const newLeadsP = (async (): Promise<{ leads: Array<{ tags: unknown; source: unknown }>; outreachAdded: number }> => {
    const rows: Array<{ tags: unknown; source: unknown }> = []
    const PAGE = 1000
    for (let from = 0; from < 100_000; from += PAGE) {
      const { data, error } = await sb
        .from('crm_people')
        .select('tags,source')
        .eq('deleted', false)
        .gte('created_at', weekStartIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[getWeeklyPipelineDigest] newLeads page error', error.message)
        break
      }
      const page = (data ?? []) as Array<{ tags: unknown; source: unknown }>
      rows.push(...page)
      if (page.length < PAGE) break
    }
    let outreachAdded = 0
    const leads: Array<{ tags: unknown; source: unknown }> = []
    for (const r of rows) {
      if (classifyLeadSource((r.source as string | null) ?? null).outreachList) outreachAdded += 1
      else leads.push(r)
    }
    return { leads: leads.slice(0, leadLimit), outreachAdded }
  })()

  // Open deals across the whole pipeline (not windowed — pipeline is a snapshot).
  const dealsP = sb.from('crm_deals').select('stage,status,value').limit(1000)

  // Conversation volume in the window (count only, head: true is exact).
  const conversationsP = sb
    .from('crm_timeline')
    .select('id', { count: 'exact', head: true })
    .in('kind', [...CONVERSATION_KINDS])
    .gte('ts', weekStartIso)

  const [newLeadsRes, dealsRes, conversationsRes] = await Promise.all([newLeadsP, dealsP, conversationsP])

  const newLeads: WeeklyLeadRow[] = newLeadsRes.leads.map((r) => ({
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    source: (r.source as string | null) ?? null,
  }))

  const activeDeals = summarizeActiveDeals(
    (dealsRes.data ?? []).map((r) => ({
      stage: (r.stage as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      value: r.value === null || r.value === undefined ? null : Number(r.value),
    })),
  )

  return {
    weekStartIso,
    newLeads,
    outreachAdded: newLeadsRes.outreachAdded,
    activeDeals,
    conversations: conversationsRes.count ?? 0,
  }
}

/** First string value from a crm_people emails/phones jsonb array. */
function firstJsonbValue(field: unknown): string | null {
  if (!Array.isArray(field)) return null
  for (const entry of field) {
    if (typeof entry === 'string' && entry.trim()) return entry.trim()
    if (entry && typeof entry === 'object') {
      const value = (entry as { value?: unknown }).value
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

/**
 * A Supabase embedded relation can come back as an object or a single-element
 * array depending on the join. Read its `name` safely either way.
 */
function relatedName(related: unknown): string | null {
  const row = Array.isArray(related) ? related[0] : related
  if (row && typeof row === 'object') {
    const name = (row as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return null
}
