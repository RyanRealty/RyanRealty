/**
 * Dial-complete handler: when the forwarded call wasn't answered, capture a
 * voicemail (recorded + transcribed via /api/twilio/recording) and log it.
 * Uses find-or-create so an unknown caller who leaves a voicemail after a
 * no-answer still becomes a tracked lead (assigned to the dialed line's broker).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN, DEFAULT_DESK_BROKER, brokerForTwilioNumber, verifiedTwilioParams } from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const site = TWILIO_PUBLIC_ORIGIN
  const status = params.DialCallStatus ?? ''
  if (status === 'completed') {
    // call was answered and has ended — nothing more to do
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }

  // no-answer / busy / failed → voicemail
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
    }
  } catch (e) {
    console.error('[twilio/voice-complete] voicemail log failed (continuing):', e)
  }

  // Recording notice before the Record verb (two-party-consent posture).
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You have reached Ryan Realty. This call is recorded. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`)
}
