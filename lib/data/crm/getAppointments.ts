import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getAppointments — broker-scoped appointment reader (FUB audit §5 / §8.12).
 *
 * Returns appointments in the supplied [from, to] window sorted by start_at.
 * Uses the service client (not cached) because the result is broker-scoped and
 * must not leak across brokers. The config-table readers (types + outcomes) ARE
 * cached — small, broker-independent, safe to share.
 *
 * DAL boundary (G1): all .from() reads live here, inside lib/data/.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type AppointmentRow = {
  id: number
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  timezone: string | null
  location: string | null
  description: string | null
  typeId: number | null
  typeName: string | null
  outcomeId: number | null
  outcomeName: string | null
  personId: number | null
  personName: string | null
  brokerSlug: string
  guestPersonIds: number[]
  inviteSent: boolean
  gcalEventId: string | null
  createdAt: string
  updatedAt: string
}

export type AppointmentType = {
  id: number
  name: string
  ord: number
  active: boolean
}

export type AppointmentOutcome = {
  id: number
  name: string
  ord: number
  active: boolean
}

// ── Cache tags ───────────────────────────────────────────────────────────────

export const CRM_APPOINTMENT_TYPES_TAG    = 'crm-appointment-types'    as const
export const CRM_APPOINTMENT_OUTCOMES_TAG = 'crm-appointment-outcomes' as const

// ── Raw DB shape ─────────────────────────────────────────────────────────────

type RawAppointment = {
  id: number
  title: string
  start_at: string
  end_at: string
  all_day: boolean
  timezone: string | null
  location: string | null
  description: string | null
  type_id: number | null
  outcome_id: number | null
  person_id: number | null
  broker_slug: string
  guest_person_ids: number[]
  invite_sent: boolean
  gcal_event_id: string | null
  created_at: string
  updated_at: string
  crm_appointment_types: { id: number; name: string } | null
  crm_appointment_outcomes: { id: number; name: string } | null
  crm_people: { id: number; name: string | null } | null
}

function mapRow(r: RawAppointment): AppointmentRow {
  return {
    id: r.id,
    title: r.title,
    startAt: r.start_at,
    endAt: r.end_at,
    allDay: r.all_day,
    timezone: r.timezone,
    location: r.location,
    description: r.description,
    typeId: r.type_id,
    typeName: r.crm_appointment_types?.name ?? null,
    outcomeId: r.outcome_id,
    outcomeName: r.crm_appointment_outcomes?.name ?? null,
    personId: r.person_id,
    personName: r.crm_people?.name ?? null,
    brokerSlug: r.broker_slug,
    guestPersonIds: r.guest_person_ids ?? [],
    inviteSent: r.invite_sent,
    gcalEventId: r.gcal_event_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ── Reader: appointments in a date window ────────────────────────────────────

/**
 * getAppointments — fetch appointments in [from, to] for a broker scope.
 * brokerScope null = superuser (all brokers); a slug = own only.
 * from/to are ISO date strings (YYYY-MM-DD); the query expands to midnight–midnight UTC.
 */
export async function getAppointments({
  brokerScope,
  from,
  to,
}: {
  brokerScope: string | null
  from: string
  to: string
}): Promise<AppointmentRow[]> {
  const sb = createServiceClient()

  // Expand date strings to full timestamptz range
  const fromTs = `${from}T00:00:00.000Z`
  const toTs   = `${to}T23:59:59.999Z`

  let q = sb
    .from('crm_appointments')
    .select(
      'id,title,start_at,end_at,all_day,timezone,location,description,type_id,outcome_id,person_id,broker_slug,guest_person_ids,invite_sent,gcal_event_id,created_at,updated_at,' +
      'crm_appointment_types(id,name),' +
      'crm_appointment_outcomes(id,name),' +
      'crm_people(id,name)',
    )
    .gte('start_at', fromTs)
    .lte('start_at', toTs)
    .order('start_at', { ascending: true })
    .limit(500)

  if (brokerScope) {
    q = q.eq('broker_slug', brokerScope)
  }

  const { data, error } = await q

  if (error) {
    console.error('[getAppointments]', error.message)
    return []
  }

  return ((data ?? []) as unknown as RawAppointment[]).map(mapRow)
}

/**
 * getAppointmentsForPerson — every appointment linked to one contact (as the
 * primary person OR a guest), newest-first. Powers the §25.9 mobile Calendar
 * tab on the contact detail (P2-4 closure, 2026-07-02): the tab renders the
 * contact's real appointments next to their tasks. Not date-windowed — a
 * single contact has few rows.
 */
export async function getAppointmentsForPerson(personId: number): Promise<AppointmentRow[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_appointments')
    .select(
      'id,title,start_at,end_at,all_day,timezone,location,description,type_id,outcome_id,person_id,broker_slug,guest_person_ids,invite_sent,gcal_event_id,created_at,updated_at,' +
      'crm_appointment_types(id,name),' +
      'crm_appointment_outcomes(id,name),' +
      'crm_people(id,name)',
    )
    .or(`person_id.eq.${personId},guest_person_ids.cs.{${personId}}`)
    .order('start_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[getAppointmentsForPerson]', error.message)
    return []
  }
  return ((data ?? []) as unknown as RawAppointment[]).map(mapRow)
}

// ── Calendar's other event sources (§09 §2.5.3 color taxonomy) ───────────────

/**
 * Tasks with a due date render on the calendar in yellow (§09 §1.10 "task
 * appears on … the Calendar (in yellow, if it has a date)"); deal closings
 * render in orange (§2.5.3 taxonomy). Both broker-scoped like getAppointments.
 */
export type CalendarTaskRow = {
  id: number
  name: string
  type: string | null
  dueAt: string
  completedAt: string | null
  assignedBroker: string | null
  personId: number | null
  personName: string | null
}

export type CalendarClosingRow = {
  id: number
  name: string
  closeDate: string
  assignedBroker: string | null
}

export async function getCalendarExtras({
  brokerScope,
  from,
  to,
}: {
  brokerScope: string | null
  from: string
  to: string
}): Promise<{ tasks: CalendarTaskRow[]; closings: CalendarClosingRow[] }> {
  const sb = createServiceClient()
  const fromTs = `${from}T00:00:00.000Z`
  const toTs   = `${to}T23:59:59.999Z`

  let taskQ = sb
    .from('crm_tasks')
    .select('id,name,type,due_at,completed_at,assigned_broker,person_id,crm_people(id,name)')
    .gte('due_at', fromTs)
    .lte('due_at', toTs)
    .order('due_at', { ascending: true })
    .limit(1000)
  if (brokerScope) taskQ = taskQ.eq('assigned_broker', brokerScope)

  let dealQ = sb
    .from('crm_deals')
    .select('id,name,close_date,assigned_broker')
    .gte('close_date', from)
    .lte('close_date', to)
    .order('close_date', { ascending: true })
    .limit(200)
  if (brokerScope) dealQ = dealQ.eq('assigned_broker', brokerScope)

  const [taskRes, dealRes] = await Promise.all([taskQ, dealQ])

  if (taskRes.error) console.error('[getCalendarExtras tasks]', taskRes.error.message)
  if (dealRes.error) console.error('[getCalendarExtras deals]', dealRes.error.message)

  type RawTask = {
    id: number
    name: string
    type: string | null
    due_at: string
    completed_at: string | null
    assigned_broker: string | null
    person_id: number | null
    crm_people: { id: number; name: string | null } | Array<{ id: number; name: string | null }> | null
  }
  const tasks: CalendarTaskRow[] = ((taskRes.data ?? []) as unknown as RawTask[]).map((r) => {
    const p = Array.isArray(r.crm_people) ? r.crm_people[0] : r.crm_people
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      dueAt: r.due_at,
      completedAt: r.completed_at,
      assignedBroker: r.assigned_broker,
      personId: r.person_id,
      personName: p?.name ?? null,
    }
  })

  const closings: CalendarClosingRow[] = (
    (dealRes.data ?? []) as Array<{ id: number; name: string; close_date: string; assigned_broker: string | null }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    closeDate: r.close_date,
    assignedBroker: r.assigned_broker,
  }))

  return { tasks, closings }
}

/**
 * Contact roster for the mobile appointment sheet's picker (capped at 500 —
 * the client filters by typing). Previously an inline .from() in the page;
 * moved here to keep the DAL boundary (G1) clean.
 */
export async function getCalendarContactOptions(): Promise<Array<{ id: number; name: string | null }>> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id,name')
    .not('stage', 'in', '("Closed","Lost","Archive","Trash")')
    .order('name', { ascending: true })
    .limit(500)
  if (error || !data) {
    if (error) console.error('[getCalendarContactOptions]', error.message)
    return []
  }
  return (data as Array<{ id: number; name: string | null }>).map((r) => ({ id: r.id, name: r.name }))
}

/**
 * Resolve contact ids → display names (guest chips in the §2.6 modal — the
 * appointments table stores guest_person_ids as a bare bigint array).
 */
export async function getPersonNamesByIds(ids: number[]): Promise<Record<number, string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return {}
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id,name')
    .in('id', unique.slice(0, 500))
  if (error || !data) {
    if (error) console.error('[getPersonNamesByIds]', error.message)
    return {}
  }
  return Object.fromEntries(
    (data as Array<{ id: number; name: string | null }>).map((r) => [r.id, r.name ?? `#${r.id}`]),
  )
}

// ── Cached config-table readers ──────────────────────────────────────────────

export const getAppointmentTypes = unstable_cache(
  async (): Promise<AppointmentType[]> => {
    // Service client: crm_appointment_types has RLS enabled with no anon
    // policy, so the anon read silently returned [] (found 2026-07-01 in the
    // §09 slice — the Type dropdown had been empty). Internal config table —
    // service read inside the cache is the correct pattern.
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_appointment_types')
      .select('id,name,ord,active')
      .order('ord', { ascending: true })
      .order('name', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getAppointmentTypes]', error.message)
      return []
    }
    return (data as Array<{ id: number; name: string; ord: number; active: boolean }>).map((r) => ({
      id: r.id,
      name: r.name,
      ord: r.ord,
      active: r.active,
    }))
  },
  ['crm-appointment-types-v1'],
  { revalidate: 300, tags: [CRM_APPOINTMENT_TYPES_TAG] },
)

export const getAppointmentOutcomes = unstable_cache(
  async (): Promise<AppointmentOutcome[]> => {
    // Service client — same no-anon-policy RLS reason as getAppointmentTypes.
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_appointment_outcomes')
      .select('id,name,ord,active')
      .order('ord', { ascending: true })
      .order('name', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getAppointmentOutcomes]', error.message)
      return []
    }
    return (data as Array<{ id: number; name: string; ord: number; active: boolean }>).map((r) => ({
      id: r.id,
      name: r.name,
      ord: r.ord,
      active: r.active,
    }))
  },
  ['crm-appointment-outcomes-v1'],
  { revalidate: 300, tags: [CRM_APPOINTMENT_OUTCOMES_TAG] },
)
