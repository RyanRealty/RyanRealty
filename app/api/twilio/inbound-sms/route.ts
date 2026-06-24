/**
 * Twilio inbound SMS webhook (blueprint §5.5) — the "right agent depending on
 * the client" router.
 *
 * 1. Validate the Twilio signature (reject spoofed posts).
 * 2. Match the sender against crm_contact_points → known contact: write
 *    sms_in to their timeline, alert the ASSIGNED broker (email + task).
 * 3. Unknown sender → create a lead (source inbound-sms), alert immediately.
 * 4. STOP/UNSUBSCRIBE keywords → suppression chokepoint (sms channel).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_DESK_BROKER, brokerForTwilioNumber, verifiedTwilioParams } from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { addSuppression, removeSuppression } from '@/lib/crm/suppressions'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'unstop', 'yes', 'resubscribe'])

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const from = params.From ?? ''
  const to = params.To ?? ''
  const body = (params.Body ?? '').trim()
  const sid = params.MessageSid ?? `unknown-${Date.now()}`
  const sb = createServiceClient()

  // Route by the DIALED Twilio line: a text to Paul's line creates a
  // Paul-assigned lead and alerts Paul. The shared marketing line (null) falls
  // back to the default desk. Unknown sender → create a lead (a text is a hot
  // signal). Shared find-or-create so the shape matches the inbound-voice path.
  const dialedBroker = await brokerForTwilioNumber(to)
  const { match, created } = await findOrCreatePersonByPhone({
    phone: from,
    source: 'inbound-sms',
    assignBroker: dialedBroker ?? DEFAULT_DESK_BROKER,
  })

  if (match) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: match.personId,
        kind: 'sms_in',
        body,
        payload: { fromNumber: from, toNumber: to, sid },
        broker: match.broker,
        source: 'twilio',
        dedupe_key: `twilio:${sid}:p${match.personId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )

    // STOP handling → suppression chokepoint
    if (STOP_WORDS.has(body.toLowerCase())) {
      await addSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword', source: 'twilio' })
      await sb.from('crm_timeline').insert({
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-out (STOP) — sms channel suppressed', source: 'twilio',
      })
      return twiml('You have been unsubscribed and will not receive further texts. Reply START to resubscribe.')
    }

    // START handling (audit p0.3): the STOP reply promises "Reply START to
    // resubscribe", so honor it. Only clears the user's own sms stop-keyword
    // opt-out — never a compliance do-not-text/hard-stop suppression we set.
    if (START_WORDS.has(body.toLowerCase())) {
      await removeSuppression({ personId: match.personId, channel: 'sms', reason: 'stop-keyword' })
      await sb.from('crm_timeline').insert({
        person_id: match.personId, kind: 'system',
        title: 'SMS opt-in (START) — sms stop-keyword suppression removed', source: 'twilio',
      })
      return twiml('You are resubscribed and will receive texts again. Reply STOP to opt out.')
    }

    // Route the alert to the dialed line's broker (the contact's assignment for
    // the shared marketing line), then the default desk.
    const alertBroker = dialedBroker ?? match.broker ?? 'matt'

    // New-lead alert — only on a real create, so a known texter never re-alerts.
    // An inbound text from an unknown number is the hottest signal there is.
    if (created) {
      await queueBrokerAlert({
        broker: alertBroker,
        personId: match.personId,
        kind: 'new-lead',
        body: newLeadAlertBody({
          name: match.name,
          source: 'inbound-sms',
          stage: 'Lead',
          personId: match.personId,
          detail: `Texting now from ${from}: ${body.slice(0, 120)}`,
        }),
      })
    }

    // Alert the assigned broker: open a task + email notification
    await sb.from('crm_tasks').insert({
      person_id: match.personId,
      name: `Reply to text from ${match.name ?? from}`,
      type: 'Text',
      due_at: new Date(Date.now() + 15 * 60000).toISOString(),
      assigned_broker: alertBroker,
      origin: 'twilio',
    })
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === alertBroker) ?? CRM_MAILBOXES[0]
    void sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `New text from ${match.name ?? from}`,
      bodyText: `${body}\n\nFrom ${from} to ${to}\nOpen the contact: https://ryan-realty.com/admin/crm/${match.personId}`,
    })
  }

  return twiml()
}
