'use server'

/**
 * Public appointment booking.
 *
 * A visitor picks a real slot on a real broker's calendar and it becomes a real
 * crm_appointments row. Until 2026-08-25 the site could only capture a "contact
 * me" lead and a broker created the appointment by hand afterwards.
 *
 * ORDER MATTERS, and it is: validate -> re-check the slot -> resolve identity
 * -> write the appointment -> alert -> confirm. The slot re-check sits INSIDE
 * the write path because availability was rendered seconds or minutes ago and
 * two visitors can want the same 10am. Losing that race returns `slot_taken`
 * so the UI can refresh rather than silently double-booking a broker.
 *
 * Identity follows the rule in lib/crm/submitted-identity: the email typed into
 * THIS form outranks any identity cookie left over from an earlier visit.
 */

import { z } from 'zod'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { findCrmPersonIdByEmail } from '@/lib/data/cma/crm'
import { resolveSubmittedIdentity } from '@/lib/crm/submitted-identity'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { isSlotStillFree } from '@/lib/data/crm/bookingAvailability'
import { formatDate } from '@/lib/format/date'
import { DEFAULT_SLOT_POLICY } from '@/lib/booking/slots'

import { createServiceClient } from '@/lib/supabase/service'
import { queueBrokerAlert, BROKER_ALERT_ORIGIN } from '@/lib/crm/broker-alerts'
import { sendAppointmentInvites } from '@/lib/crm/appointment-invites'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { isHardStopped } from '@/lib/canonical-lead-tagger'


const BROKER_SLUGS = ['matt', 'rebecca', 'paul'] as const
type BrokerSlug = (typeof BROKER_SLUGS)[number]

function normalizeBroker(raw: string | null | undefined): BrokerSlug {
  const v = String(raw ?? '').trim().toLowerCase()
  return (BROKER_SLUGS as readonly string[]).includes(v) ? (v as BrokerSlug) : 'matt'
}

const BookingInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(200),
  phone: z.string().trim().max(40).optional().default(''),
  note: z.string().trim().max(1000).optional().default(''),
  startIso: z.string().datetime(),
  endIso: z.string().datetime(),
  broker: z.string().trim().optional(),
  /** What the visitor wants to talk about — shown on the broker's calendar. */
  topic: z.enum(['buying', 'selling', 'both', 'other']).optional().default('other'),
  /** TCPA/A2P marketing-text consent. Governs texts only — a booking is kept
   *  either way, because the visitor asked for the meeting itself. */
  smsConsent: z.boolean().optional().default(false),
})

export type BookingResult =
  | { ok: true; appointmentId: number; startIso: string }
  | { ok: false; error: string; code: 'invalid' | 'slot_taken' | 'stopped' | 'failed' }

const TOPIC_LABEL: Record<string, string> = {
  buying: 'Buying',
  selling: 'Selling',
  both: 'Buying and selling',
  other: 'Consultation',
}

export async function bookAppointmentAction(raw: unknown): Promise<BookingResult> {
  const parsed = BookingInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, code: 'invalid', error: parsed.error.issues[0]?.message ?? 'Check the form' }
  }
  const input = parsed.data

  const startMs = Date.parse(input.startIso)
  const endMs = Date.parse(input.endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { ok: false, code: 'invalid', error: 'That time is not valid' }
  }
  // A slot in the past is never bookable, whatever the client posted.
  if (startMs <= Date.now()) {
    return { ok: false, code: 'slot_taken', error: 'That time has passed. Pick another.' }
  }

  // Broker attribution: an ad-attributed visitor books with the broker who
  // brought them, matching the LP routing rule.
  const attributed = await readAttributedAgentServer().catch(() => null)
  const brokerSlug = normalizeBroker(input.broker ?? attributed?.broker ?? undefined)

  try {
    // ── The race guard ──────────────────────────────────────────────────────
    const free = await isSlotStillFree({
      brokerSlug,
      startIso: input.startIso,
      endIso: input.endIso,
      bufferMinutes: DEFAULT_SLOT_POLICY.bufferMinutes,
    })
    if (!free) {
      return { ok: false, code: 'slot_taken', error: 'Someone just took that time. Pick another.' }
    }

    // ── Identity: the email on THIS form wins ───────────────────────────────
    const cookiePersonId = await getPersonIdFromCookie()
    const emailPersonId = await findCrmPersonIdByEmail(input.email)
    const resolved = resolveSubmittedIdentity({
      cookiePersonId,
      emailPersonId,
      hasEmail: true,
    })

    if (resolved.personId && (await isHardStopped(resolved.personId))) {
      // Do-not-contact still books the time (they asked for it) but nothing is
      // sent to them. Refusing outright would be worse: they chose to meet.
      return await finishBooking({
        personId: resolved.personId, input, brokerSlug, notifyLead: false,
      })
    }

    const lead = await ensureNativeLead({
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      source: 'Website booking',
      assignedBroker: brokerSlug,
    })
    const personId = resolved.personId ?? lead.personId
    if (!personId) return { ok: false, code: 'failed', error: 'Could not save your booking' }

    return await finishBooking({ personId, input, brokerSlug, notifyLead: true })
  } catch (e) {
    console.error('[bookAppointmentAction]', e instanceof Error ? e.message : String(e))
    return { ok: false, code: 'failed', error: 'Could not save your booking' }
  }
}

async function finishBooking(args: {
  personId: number
  input: z.infer<typeof BookingInput>
  brokerSlug: BrokerSlug
  notifyLead: boolean
}): Promise<BookingResult> {
  const { personId, input, brokerSlug } = args
  const settings = await getCrmCompanySettings()
  const timeZone = settings.time_zone || 'America/Los_Angeles'
  const topic = TOPIC_LABEL[input.topic] ?? 'Consultation'
  const title = `${topic} — ${input.name}`

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_appointments')
    .insert({
      title,
      start_at: input.startIso,
      end_at: input.endIso,
      all_day: false,
      timezone: timeZone,
      location: 'Phone or video — broker will confirm',
      description: [
        `Booked from the website by ${input.name} (${input.email}${input.phone ? `, ${input.phone}` : ''}).`,
        input.note ? `They said: ${input.note}` : null,
      ].filter(Boolean).join('\n'),
      person_id: personId,
      broker_slug: brokerSlug,
      guest_person_ids: [],
      invite_sent: false,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[bookAppointmentAction insert]', error?.message)
    return { ok: false, code: 'failed', error: 'Could not save your booking' }
  }

  const appointmentId = data.id as number
  const whenLabel = formatDate(input.startIso, {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', year: undefined,
  })

  // Tag the lead so the CRM shows why they are here, best-effort.
  await enrichNativeLead({
    personId,
    tags: ['source:website-booking', `booking:${input.topic}`],
    originNote: {
      title: 'Booked an appointment',
      body: `${topic} — ${whenLabel} (${timeZone}). Booked from the website.`,
    },
  }).catch((e) => console.warn('[bookAppointmentAction enrich]', e))

  // Confirm to the person who booked. This is transactional — they asked for
  // this exact meeting seconds ago — and it is suppression-checked per
  // recipient inside sendAppointmentInvites, so a do-not-email contact still
  // gets the calendar slot and no email. The UI promises this confirmation, so
  // it has to actually send.
  if (args.notifyLead) {
    await sendAppointmentInvites({
      apptId: appointmentId,
      title,
      startAt: input.startIso,
      endAt: input.endIso,
      allDay: false,
      timezone: timeZone,
      location: 'Phone or video — your broker will confirm',
      description: input.note || null,
      brokerSlug,
      personIds: [personId],
    })
      .then(async (sent) => {
        if (sent > 0) {
          await sb.from('crm_appointments').update({ invite_sent: true }).eq('id', appointmentId)
        }
      })
      .catch((e) => console.warn('[bookAppointmentAction confirm]', e))
  }

  // Two lines: what happened, then the labelled link (Matt 2026-08-25).
  await queueBrokerAlert({
    broker: brokerSlug,
    personId,
    kind: `appointment-booked:${appointmentId}`,
    body: [
      `${input.name} booked ${whenLabel} (${topic})`,
      `View lead: ${BROKER_ALERT_ORIGIN}/admin/people/${personId}`,
    ].join('\n'),
  }).catch((e) => console.warn('[bookAppointmentAction alert]', e))

  return { ok: true, appointmentId, startIso: input.startIso }
}
