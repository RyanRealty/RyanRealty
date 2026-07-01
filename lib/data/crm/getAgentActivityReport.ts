import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'this_year'

export type AgentActivityParams = {
  /** null = all brokers (superuser/Everyone view) */
  brokerSlug: string | null
  datePreset: DatePreset | 'custom'
  dateStart?: string | null  // ISO datetime, required when preset='custom'
  dateEnd?: string | null    // ISO datetime, required when preset='custom'
}

export type AgentActivityRow = {
  brokerSlug: string
  brokerName: string
  /** Path to the broker's headshot image */
  avatarUrl: string | null
  /** Leads created in the period currently assigned to this broker */
  newLeads: number
  /** Approximation of Initially Assigned (no assignment history table yet) */
  initiallyAssignedLeads: number
  /** Approximation of Currently Assigned (same as new leads, V1) */
  currentlyAssignedLeads: number
  /** Calls logged by this broker in the period (kind='call') */
  calls: number
  /** Emails sent/received personally by this broker (kind IN email_out, email_in) */
  emails: number
  /** Texts sent/received personally by this broker (kind IN sms_out, sms_in) */
  texts: number
  /** Notes added by this broker (kind='note') */
  notes: number
  /** Tasks marked complete by this broker in the period */
  tasksCompleted: number
  /** Appointments CREATED by this broker (broker_slug = slug) in the period */
  appointmentsSet: number
  /** Appointments this broker is associated with (same as set, V1 — no broker-invitees table) */
  appointments: number
}

export type AgentActivityTotals = Omit<AgentActivityRow, 'brokerSlug' | 'brokerName' | 'avatarUrl'>

export type AgentActivityResult = {
  rows: AgentActivityRow[]
  totals: AgentActivityTotals
  dateStart: string
  dateEnd: string
}

// ── Date range resolver ────────────────────────────────────────────────────────

/**
 * Convert a named preset or custom range to {start, end} ISO strings.
 * All times are in server local time (UTC on Vercel). Oregon-specific calendar
 * events are close enough for a reporting context.
 * Pure — exported for testing.
 */
export function resolveDateRange(
  preset: string,
  customStart?: string | null,
  customEnd?: string | null,
): { start: string; end: string } {
  const now = new Date()
  const endIso = now.toISOString()

  if (preset === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd }
  }

  if (preset === 'today') {
    const start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: endIso }
  }

  if (preset === 'this_week') {
    const start = new Date(now)
    start.setUTCDate(now.getUTCDate() - now.getUTCDay())
    start.setUTCHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: endIso }
  }

  if (preset === 'this_year') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    return { start: start.toISOString(), end: endIso }
  }

  // Default: this_month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { start: start.toISOString(), end: endIso }
}

// ── Broker headshot map ───────────────────────────────────────────────────────

const BROKER_HEADSHOT: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

// ── Timeline kind groupings ───────────────────────────────────────────────────

const CALL_KINDS = ['call', 'voicemail']
const EMAIL_KINDS = ['email_out', 'email_in']
const TEXT_KINDS = ['sms_out', 'sms_in']
const NOTE_KINDS = ['note']
const ALL_ACTIVITY_KINDS = [...CALL_KINDS, ...EMAIL_KINDS, ...TEXT_KINDS, ...NOTE_KINDS]

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readAgentActivity(params: AgentActivityParams): Promise<AgentActivityResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(params.datePreset, params.dateStart, params.dateEnd)

  // 1. Broker roster — only CRM-active brokers with a crm_slug
  const { data: brokerRows, error: brokerError } = await sb
    .from('brokers')
    .select('crm_slug,display_name,photo_url')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)
    .order('sort_order', { ascending: true })

  if (brokerError) console.error('[getAgentActivityReport] brokers error', brokerError.message)

  const allBrokers = (brokerRows ?? []).filter((b) => b.crm_slug) as Array<{
    crm_slug: string
    display_name: string | null
    photo_url: string | null
  }>

  // 2. Scope: which broker slugs to include
  const scopedBrokers = params.brokerSlug
    ? allBrokers.filter((b) => b.crm_slug === params.brokerSlug)
    : allBrokers

  const brokerSlugs = scopedBrokers.map((b) => b.crm_slug)

  const emptyTotals: AgentActivityTotals = {
    newLeads: 0, initiallyAssignedLeads: 0, currentlyAssignedLeads: 0,
    calls: 0, emails: 0, texts: 0, notes: 0,
    tasksCompleted: 0, appointmentsSet: 0, appointments: 0,
  }

  if (brokerSlugs.length === 0) {
    return { rows: [], totals: emptyTotals, dateStart: start, dateEnd: end }
  }

  // 3. Parallel data fetch
  //    a) New leads per broker: crm_people.created_at in range, assigned_broker=slug
  //    b) Timeline events in range for scoped brokers
  //    c) Tasks completed in range for scoped brokers
  //    d) Appointments in range for scoped brokers

  const [newLeadCounts, timelineResult, tasksResult, apptsResult] = await Promise.all([
    // a) New lead counts (one count query per broker — manageable for 3 brokers)
    Promise.all(
      brokerSlugs.map(async (slug) => {
        const { count } = await sb
          .from('crm_people')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_broker', slug)
          .eq('deleted', false)
          .gte('created_at', start)
          .lte('created_at', end)
        return { slug, count: count ?? 0 }
      }),
    ),
    // b) Timeline events (kind = call/voicemail/email_*/sms_*/note, broker set)
    sb
      .from('crm_timeline')
      .select('kind,broker')
      .gte('ts', start)
      .lte('ts', end)
      .in('kind', ALL_ACTIVITY_KINDS)
      .in('broker', brokerSlugs)
      .neq('source', 'sequence'),  // Exclude automated sequence messages
    // c) Tasks completed
    sb
      .from('crm_tasks')
      .select('assigned_broker')
      .gte('completed_at', start)
      .lte('completed_at', end)
      .in('assigned_broker', brokerSlugs),
    // d) Appointments (broker_slug = creator, person_id NOT NULL per inclusion rule)
    sb
      .from('crm_appointments')
      .select('broker_slug')
      .gte('start_at', start)
      .lte('start_at', end)
      .not('person_id', 'is', null)
      .in('broker_slug', brokerSlugs),
  ])

  // 4. Index new lead counts
  const newLeadsBySlug = new Map<string, number>()
  for (const { slug, count } of newLeadCounts) {
    newLeadsBySlug.set(slug, count)
  }

  // 5. Aggregate timeline events by broker
  const callsByBroker = new Map<string, number>()
  const emailsByBroker = new Map<string, number>()
  const textsByBroker = new Map<string, number>()
  const notesByBroker = new Map<string, number>()

  for (const row of timelineResult.data ?? []) {
    const slug = row.broker as string | null
    if (!slug) continue
    const kind = row.kind as string
    if (CALL_KINDS.includes(kind)) {
      callsByBroker.set(slug, (callsByBroker.get(slug) ?? 0) + 1)
    } else if (EMAIL_KINDS.includes(kind)) {
      emailsByBroker.set(slug, (emailsByBroker.get(slug) ?? 0) + 1)
    } else if (TEXT_KINDS.includes(kind)) {
      textsByBroker.set(slug, (textsByBroker.get(slug) ?? 0) + 1)
    } else if (NOTE_KINDS.includes(kind)) {
      notesByBroker.set(slug, (notesByBroker.get(slug) ?? 0) + 1)
    }
  }

  // 6. Aggregate tasks by broker
  const tasksByBroker = new Map<string, number>()
  for (const row of tasksResult.data ?? []) {
    const slug = row.assigned_broker as string | null
    if (!slug) continue
    tasksByBroker.set(slug, (tasksByBroker.get(slug) ?? 0) + 1)
  }

  // 7. Aggregate appointments by broker (broker_slug = creator)
  const apptsByBroker = new Map<string, number>()
  for (const row of apptsResult.data ?? []) {
    const slug = row.broker_slug as string | null
    if (!slug) continue
    apptsByBroker.set(slug, (apptsByBroker.get(slug) ?? 0) + 1)
  }

  // 8. Build typed rows
  const rows: AgentActivityRow[] = scopedBrokers.map((b) => {
    const slug = b.crm_slug
    const newLeads = newLeadsBySlug.get(slug) ?? 0
    const apptsSet = apptsByBroker.get(slug) ?? 0
    return {
      brokerSlug: slug,
      brokerName: b.display_name ?? slug,
      avatarUrl: BROKER_HEADSHOT[slug] ?? b.photo_url ?? null,
      newLeads,
      initiallyAssignedLeads: newLeads,  // V1 approximation: no history table
      currentlyAssignedLeads: newLeads,  // V1 approximation: same query
      calls: callsByBroker.get(slug) ?? 0,
      emails: emailsByBroker.get(slug) ?? 0,
      texts: textsByBroker.get(slug) ?? 0,
      notes: notesByBroker.get(slug) ?? 0,
      tasksCompleted: tasksByBroker.get(slug) ?? 0,
      appointmentsSet: apptsSet,
      appointments: apptsSet,  // V1: same as appointmentsSet (no broker-invitees field)
    }
  })

  // 9. Compute column totals
  const totals: AgentActivityTotals = rows.reduce(
    (acc, r) => ({
      newLeads: acc.newLeads + r.newLeads,
      initiallyAssignedLeads: acc.initiallyAssignedLeads + r.initiallyAssignedLeads,
      currentlyAssignedLeads: acc.currentlyAssignedLeads + r.currentlyAssignedLeads,
      calls: acc.calls + r.calls,
      emails: acc.emails + r.emails,
      texts: acc.texts + r.texts,
      notes: acc.notes + r.notes,
      tasksCompleted: acc.tasksCompleted + r.tasksCompleted,
      appointmentsSet: acc.appointmentsSet + r.appointmentsSet,
      appointments: acc.appointments + r.appointments,
    }),
    { ...emptyTotals },
  )

  return { rows, totals, dateStart: start, dateEnd: end }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Agent Activity report data — aggregate per-broker counts over a date range.
 * Cached 10 minutes to match FUB's documented cache TTL for reporting.
 * Cache is keyed on the filter params so different filter combos get separate
 * cache entries.
 *
 * Source tables:
 *   - crm_people (new lead counts, filtered by created_at + assigned_broker)
 *   - crm_timeline (calls/emails/texts/notes, filtered by ts + broker + kind)
 *   - crm_tasks (tasks completed, filtered by completed_at + assigned_broker)
 *   - crm_appointments (appointments, filtered by start_at + broker_slug)
 *
 * V1 approximations (documented):
 *   - initiallyAssignedLeads = newLeads (no crm_lead_assignments history table yet)
 *   - currentlyAssignedLeads = newLeads (same)
 *   - appointments = appointmentsSet (no per-broker invitees table yet)
 *   - Personal 1:1 filter: excludes source='sequence'; cannot distinguish
 *     personal_1to1 vs automated_marketing without a communication_type column
 */
export async function getAgentActivityReport(
  params: AgentActivityParams,
): Promise<AgentActivityResult> {
  const cached = unstable_cache(
    () => readAgentActivity(params),
    [
      'crm-agent-activity-v1',
      params.brokerSlug ?? 'all',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-agent-activity', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
