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
import { lookupPersonByPhone, normalizeTo10, twilioWebhookValidationUrl, validateTwilioSignature } from '@/lib/crm/twilio'
import { addSuppression } from '@/lib/crm/suppressions'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const url = twilioWebhookValidationUrl(request)
  const signature = request.headers.get('x-twilio-signature')
  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const from = params.From ?? ''
  const to = params.To ?? ''
  const body = (params.Body ?? '').trim()
  const sid = params.MessageSid ?? `unknown-${Date.now()}`
  const sb = createServiceClient()

  let match = await lookupPersonByPhone(from)

  // Unknown sender → create a lead. An inbound text is a hot signal.
  if (!match) {
    const ten = normalizeTo10(from)
    const { data: created } = await sb
      .from('crm_people')
      .insert({
        name: `Text lead ${ten ?? from}`,
        stage: 'Lead',
        source: 'inbound-sms',
        assigned_broker: 'matt',
        phones: [{ value: from, type: 'Mobile', isPrimary: 1 }],
        tags: ['source:inbound-sms'],
      })
      .select('id,name,assigned_broker')
      .single()
    if (created && ten) {
      await sb.from('crm_contact_points').insert({ person_id: created.id, kind: 'phone', value: ten, is_primary: true })
      match = { personId: created.id, name: created.name, broker: 'matt' }
    }
  }

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

    // Alert the assigned broker: open a task + email notification
    await sb.from('crm_tasks').insert({
      person_id: match.personId,
      name: `Reply to text from ${match.name ?? from}`,
      type: 'Text',
      due_at: new Date(Date.now() + 15 * 60000).toISOString(),
      assigned_broker: match.broker ?? 'matt',
      origin: 'twilio',
    })
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === (match.broker ?? 'matt')) ?? CRM_MAILBOXES[0]
    void sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `New text from ${match.name ?? from}`,
      bodyText: `${body}\n\nFrom ${from} to ${to}\nOpen the contact: https://ryan-realty.com/admin/crm/${match.personId}`,
    })
  }

  return twiml()
}
