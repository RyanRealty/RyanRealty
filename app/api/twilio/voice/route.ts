/**
 * Twilio inbound voice webhook (blueprint §5.5): announce recording, forward
 * the call to the right broker's cell based on the contact's assigned broker
 * (caller lookup), record dual-channel, and log a `call` timeline entry.
 * Unanswered calls fall through to /api/twilio/voice-complete which captures
 * a voicemail. Recordings + voicemails are transcribed via /api/twilio/recording.
 *
 * Compliance: a brief "may be recorded" announcement plays before connecting —
 * continuing past it is consent in every state (out-of-state callers can be in
 * two-party-consent states like California). Disable recording entirely with
 * CRM_CALL_RECORDING=false.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN, forwardNumberFor, twilioWebhookValidationUrl, validateTwilioSignature } from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const site = TWILIO_PUBLIC_ORIGIN
  const url = twilioWebhookValidationUrl(request)
  const signature = request.headers.get('x-twilio-signature')
  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const from = params.From ?? ''
  // Find the caller, OR create a tracked lead when they are unknown (CONTACT360
  // Phase 0.1 — the inbound-voice lead leak). Mirrors the inbound-SMS native
  // create. This runs BEFORE forwarding so the call still rings the broker; the
  // create never blocks the dial.
  const { match, created } = await findOrCreatePersonByPhone({ phone: from, source: 'inbound-call' })
  const target = forwardNumberFor(match?.broker ?? null)
  const recording = process.env.CRM_CALL_RECORDING !== 'false'

  if (match) {
    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: match.personId,
      kind: 'call',
      title: 'Inbound call',
      payload: { fromNumber: from, toNumber: params.To ?? null, callSid: params.CallSid ?? null, forwardedTo: target },
      broker: match.broker,
      source: 'twilio',
      dedupe_key: params.CallSid ? `twilio:call:${params.CallSid}:p${match.personId}` : null,
    })

    // Instant new-lead alert — only on a real create, so a known caller never
    // re-alerts. queueBrokerAlert dedupes per person+kind on top of this.
    if (created) {
      await queueBrokerAlert({
        broker: match.broker,
        personId: match.personId,
        kind: 'new-lead',
        body: newLeadAlertBody({
          name: match.name,
          source: 'inbound-call',
          stage: 'Lead',
          personId: match.personId,
          detail: `Calling now from ${from}`,
        }),
      })
    }
  }

  // Pass the CALLER's real number through as caller ID (allowed on bridged
  // inbound calls) so the broker sees who is calling and can call back
  // directly — FUB's forwarding behavior.
  const recAttrs = recording
    ? ` record="record-from-answer-dual" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed"`
    : ''
  const announce = recording
    ? '<Say>This call may be recorded for quality purposes.</Say>'
    : ''
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announce}
  <Dial timeout="25" callerId="${from || params.To || ''}" action="${site}/api/twilio/voice-complete" method="POST"${recAttrs}>${target}</Dial>
</Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
