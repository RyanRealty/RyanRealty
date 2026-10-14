/**
 * Twilio <Sip referUrl> target. When the Grok receptionist transfers (xAI SIP
 * REFER), Twilio ends the SIP leg and asks here what to do with the caller. We
 * dial the allowlisted target with the ORIGINAL caller's number as caller ID;
 * an unanswered transfer falls to voicemail via receptionist-complete.
 */
import { NextResponse } from 'next/server'
import { TWILIO_PUBLIC_ORIGIN, forwardCellForBroker, verifiedTwilioParams } from '@/lib/crm/twilio'
import { AGENT_LINES, escapeXml, parseReferTarget, transferTestTarget } from '@/lib/voice/receptionist-routing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const p = verified.params
  const site = TWILIO_PUBLIC_ORIGIN
  let matt: string | null = null
  try { matt = await forwardCellForBroker('matt') } catch { matt = null }
  const target = parseReferTarget(p.ReferTransferTarget, [matt, AGENT_LINES.rebecca, AGENT_LINES.paul, transferTestTarget()])
  console.log(`[receptionist-refer] call=${p.CallSid ?? ''} raw=${p.ReferTransferTarget ?? ''} target=${target ?? 'rejected'}`)
  if (!target) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Redirect method="POST">${site}/api/voice/receptionist-complete?transfer=1</Redirect></Response>`)
  }
  // Test mode: the test target never rings a phone; it proves the REFER reached us.
  if (target === transferTestTarget()) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>Transfer test connected.</Say><Hangup/></Response>`)
  }
  const callerId = escapeXml(p.From || p.To || '')
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="25" answerOnBridge="true" callerId="${callerId}" action="${site}/api/voice/receptionist-complete?transfer=1" method="POST">${target}</Dial>
</Response>`)
}
