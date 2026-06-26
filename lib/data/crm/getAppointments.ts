import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'

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
      'id,title,start_at,end_at,all_day,location,description,type_id,outcome_id,person_id,broker_slug,guest_person_ids,invite_sent,gcal_event_id,created_at,updated_at,' +
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

// ── Cached config-table readers ──────────────────────────────────────────────

export const getAppointmentTypes = unstable_cache(
  async (): Promise<AppointmentType[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
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
    const sb = supabaseAnon()
    if (!sb) return []
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
