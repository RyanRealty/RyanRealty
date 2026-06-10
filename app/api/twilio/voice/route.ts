/**
 * Twilio inbound voice webhook (blueprint §5.5): forward the call to the
 * right broker's cell based on the contact's assigned broker (caller lookup),
 * falling back to the number's owner mapping, then Matt. Logs a `call`
 * timeline entry for known contacts. Unanswered calls roll to the broker's
 * own cell voicemail (v1 — no hosted voicemail yet).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { forwardNumberFor, lookupPersonByPhone, validateTwilioSignature } from '@/lib/crm/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'}/api/twilio/voice`
  const signature = request.headers.get('x-twilio-signature')
  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const from = params.From ?? ''
  const match = await lookupPersonByPhone(from)
  const target = forwardNumberFor(match?.broker ?? null)

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
  }

  // Pass the CALLER's real number through as caller ID (allowed on bridged
  // inbound calls) so the broker sees who is calling and can call back
  // directly — FUB's forwarding behavior.
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="25" callerId="${from || params.To || ''}">${target}</Dial>
</Response>`
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
