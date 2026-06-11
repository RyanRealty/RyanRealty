/**
 * Dial-complete handler: when the forwarded call wasn't answered, capture a
 * voicemail (recorded + transcribed via /api/twilio/recording) and log it.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN, lookupPersonByPhone, twilioWebhookValidationUrl, validateTwilioSignature } from '@/lib/crm/twilio'

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

  const status = params.DialCallStatus ?? ''
  if (status === 'completed') {
    // call was answered and has ended — nothing more to do
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  }

  // no-answer / busy / failed → voicemail
  const from = params.From ?? ''
  const match = await lookupPersonByPhone(from)
  if (match) {
    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: match.personId,
      kind: 'voicemail',
      title: 'Voicemail (recording)',
      payload: { fromNumber: from, toNumber: params.To ?? null, callSid: params.CallSid ?? null, dialStatus: status },
      broker: match.broker,
      source: 'twilio',
      dedupe_key: params.CallSid ? `twilio:vm:${params.CallSid}:p${match.personId}` : null,
    })
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You have reached Ryan Realty. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
