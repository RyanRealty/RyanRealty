/**
 * Twilio <Sip referUrl> target. When the Grok receptionist transfers (xAI SIP
 * REFER), Twilio ends the SIP leg and asks here what to do with the caller. We
 * dial the allowlisted target with the ORIGINAL caller's number as caller ID;
 * an unanswered transfer falls to voicemail via receptionist-complete.
 */
import { NextResponse } from 'next/server'
import { TWILIO_PUBLIC_ORIGIN, forwardCellForBroker, verifiedTwilioParams } from '@/lib/crm/twilio'
import { escapeXml, parseReferTarget, transferTestTarget } from '@/lib/voice/receptionist-routing'

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
  const cells: Record<string, string | null> = {}
  for (const b of ['matt', 'rebecca', 'paul']) { try { cells[b] = await forwardCellForBroker(b) } catch { cells[b] = null } }
  const target = parseReferTarget(p.ReferTransferTarget, [...Object.values(cells), transferTestTarget()])
  const who = Object.keys(cells).find((k) => cells[k] && cells[k] === target) ?? 'matt'
  console.log(`[receptionist-refer] call=${p.CallSid ?? ''} raw=${p.ReferTransferTarget ?? ''} target=${target ?? 'rejected'}`)
  if (!target) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Redirect method="POST">${site}/api/voice/receptionist-complete?transfer=matt</Redirect></Response>`)
  }
  // Test mode: the test target never rings a phone; it proves the REFER reached us.
  if (target === transferTestTarget()) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>Transfer test connected.</Say><Hangup/></Response>`)
  }
  const callerId = escapeXml(p.From || p.To || '')
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="25" answerOnBridge="true" callerId="${callerId}" action="${site}/api/voice/receptionist-complete?transfer=${who}" method="POST">${target}</Dial>
</Response>`)
}
