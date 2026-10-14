import { createServiceClient } from '@/lib/supabase/service'

export type OneOffPriorSend = {
  emailEventId: number | null
  timelineId: number | null
  messageId: string | null
}

/** Existing tracked send for this person + key/subject. Used to refuse a second send. */
export async function findExistingOneOffSend(input: {
  personId: number
  sendKey: string
  subject: string
}): Promise<OneOffPriorSend> {
  const empty: OneOffPriorSend = { emailEventId: null, timelineId: null, messageId: null }
  if (!Number.isFinite(input.personId) || input.personId <= 0) return empty
  const sendKey = input.sendKey.trim()
  const subject = input.subject.trim()
  if (!sendKey && !subject) return empty
  const sb = createServiceClient()
  const [events, timeline] = await Promise.all([
    sb
      .from('email_events')
      .select('id, message_id, email_key, subject')
      .eq('person_id', input.personId)
      .order('occurred_at', { ascending: false })
      .limit(40),
    sb
      .from('crm_timeline')
      .select('id, title, payload')
      .eq('person_id', input.personId)
      .eq('kind', 'email_out')
      .order('ts', { ascending: false })
      .limit(40),
  ])

  const eventRow = (events.data ?? []).find((row) => {
    const key = String(row.email_key ?? '')
    const sub = String(row.subject ?? '')
    return (sendKey && key.includes(sendKey)) || (subject && sub === subject)
  })
  const timelineRow = (timeline.data ?? []).find((row) => {
    const title = String(row.title ?? '')
    const payload = (row.payload ?? {}) as { purpose?: unknown }
    const purpose = typeof payload.purpose === 'string' ? payload.purpose : ''
    return (subject && title === subject) || (sendKey && purpose === sendKey)
  })

  return {
    emailEventId: typeof eventRow?.id === 'number' ? eventRow.id : null,
    timelineId: typeof timelineRow?.id === 'number' ? timelineRow.id : null,
    messageId: typeof eventRow?.message_id === 'string' ? eventRow.message_id : null,
  }
}
