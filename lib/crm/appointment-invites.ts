import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Send the §2.11 invitation email to each contact invitee's PRIMARY email
 * (secondary emails excluded, per spec), from the assigned broker's own Gmail
 * mailbox, suppression-checked per recipient. Text reminders (the CRM
 * Power-Up) are deliberately not implemented — the modal copy says so.
 * Returns the number of invitations actually sent.
 */
export async function sendAppointmentInvites(params: {
  apptId: number
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  timezone: string | null
  location: string | null
  description: string | null
  brokerSlug: string
  personIds: number[]
}): Promise<number> {
  const ids = [...new Set(params.personIds)].filter(Boolean)
  if (ids.length === 0) return 0

  const sb = createServiceClient()
  const { data: people } = await sb
    .from('crm_people')
    .select('id,name,first_name,emails')
    .in('id', ids)
  if (!people || people.length === 0) return 0

  const { CRM_MAILBOXES } = await import('@/lib/crm/gmail')
  const { sendGovernedEmail } = await import('@/lib/comms/sendGovernedEmail')
  const { taskGroupLabel, time12, wallDateKey, wallMinutes } = await import('@/lib/crm/calendar')
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === params.brokerSlug) ?? CRM_MAILBOXES[0]

  const dayLabel = taskGroupLabel(wallDateKey(params.startAt))
  const tzLabel =
    params.timezone === 'America/New_York' ? 'Eastern Time'
    : params.timezone === 'America/Chicago' ? 'Central Time'
    : params.timezone === 'America/Denver' ? 'Mountain Time'
    : 'Pacific Time'
  const when = params.allDay
    ? `${dayLabel} (all day)`
    : `${dayLabel}, ${time12(wallMinutes(params.startAt))}–${time12(wallMinutes(params.endAt))} (${tzLabel})`
  const notesPlain = (params.description ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()

  let sent = 0
  for (const p of people as Array<{ id: number; name: string | null; first_name: string | null; emails: Array<{ value?: string; isPrimary?: number | boolean }> | null }>) {
    const to = (p.emails ?? [])
      .slice()
      .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value
    if (!to) continue

    const first = (p.first_name ?? p.name ?? '').split(' ')[0]
    const subject = `Appointment: ${params.title}`
    const lines = [
      first ? `Hi ${first},` : 'Hi,',
      '',
      `You have an appointment scheduled: ${params.title}`,
      `When: ${when}`,
      params.location ? `Where: ${params.location}` : null,
      notesPlain ? `Notes: ${notesPlain}` : null,
      '',
      'Reply to this email if you need to reschedule.',
    ].filter((l): l is string => l !== null)

    // G56: the governed chokepoint, not the provider rail. It runs hard-stop
    // and suppression ahead of the send (so the hand-rolled isSuppressed check
    // this function used to carry is gone, not merely duplicated), writes the
    // timeline row, and makes the send at-most-once per appointment+person.
    const res = await sendGovernedEmail({
      personId: p.id,
      purpose: 'crm:appointment-invite',
      idempotencyKey: `appt:${params.apptId}`,
      initiator: { kind: 'system', broker: mailbox.slug, source: 'appointment-invite' },
      payload: {
        rail: 'gmail',
        to: [to],
        subject,
        bodyText: lines.join('\n'),
        withSignature: true,
        track: { personId: p.id, emailKey: `appt:${params.apptId}:${p.id}`, label: subject },
      },
    })
    if (!res.ok) continue
    sent += 1
  }
  return sent
}
