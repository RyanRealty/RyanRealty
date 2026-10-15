/**
 * Dial-complete handler: when the forwarded call wasn't answered, capture a
 * voicemail (recorded + transcribed via /api/twilio/recording) and log it.
 *
 * Hot path: signature, raw persist, voicemail TwiML. CRM writes run after ack.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN, DEFAULT_DESK_BROKER, brokerForTwilioNumber } from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { ackTwilioWebhook } from '@/lib/crm/twilio-webhook-ack'
import { applyInboundConsentClear } from '@/lib/data/crm/applyInboundConsentClear'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(request: Request) {
  return ackTwilioWebhook({
    request,
    kind: 'voice-complete',
    process: processVoiceComplete,
    respond: voiceCompleteTwiml,
  })
}

export function voiceCompleteTwiml(params: Record<string, string>): NextResponse {
  const site = TWILIO_PUBLIC_ORIGIN
  const status = params.DialCallStatus ?? ''
  if (status === 'completed') {
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You have reached Ryan Realty. This call is recorded. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`)
}

export async function processVoiceComplete(params: Record<string, string>): Promise<void> {
  const status = params.DialCallStatus ?? ''
  if (status === 'completed') return

  const from = params.From ?? ''
  const dialed = params.To ?? ''
  const dialedBroker = await brokerForTwilioNumber(dialed)
  try {
    const { match } = await findOrCreatePersonByPhone({
      phone: from,
      source: 'inbound-call',
      assignBroker: dialedBroker ?? DEFAULT_DESK_BROKER,
    })
    if (match) {
      const sb = createServiceClient()
      await sb.from('crm_timeline').upsert(
        {
          person_id: match.personId,
          kind: 'voicemail',
          title: 'Voicemail (recording)',
          payload: { fromNumber: from, toNumber: dialed, callSid: params.CallSid ?? null, dialStatus: status, dialedBroker, recordingConsent: 'announced' },
          broker: dialedBroker ?? match.broker,
          source: 'twilio',
          dedupe_key: params.CallSid ? `twilio:vm:${params.CallSid}:p${match.personId}` : null,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      try {
        await applyInboundConsentClear({
          personId: match.personId,
          event: 'voicemail',
          eventId: params.CallSid ?? null,
          broker: dialedBroker ?? match.broker,
        })
      } catch (e) {
        console.warn('[twilio/voice-complete] inbound consent clear failed', e)
      }
    }
  } catch (e) {
    console.error('[twilio/voice-complete] voicemail log failed:', e)
  }
}
