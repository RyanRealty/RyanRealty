/**
 * Outbound click-to-call bridge (Twilio cutover 2026-06-24). When a broker
 * starts a call from the CRM, Twilio rings the broker's cell first, then fetches
 * THIS TwiML to connect them to the lead and record the conversation.
 *
 * The lead number + caller-ID are NOT passed in the URL (that would put a phone
 * number in a signed-URL query string and invite toll fraud). Instead the
 * start-call action pre-inserts a crm_timeline `call` row keyed by the parent
 * CallSid; this route looks the lead number up by CallSid. Clean URL → the
 * shared signature check (which validates origin+path) holds.
 */

import { NextResponse } from 'next/server'
import { TWILIO_PUBLIC_ORIGIN, verifiedTwilioParams } from '@/lib/crm/twilio'
import { getOutboundCallLead } from '@/lib/data/crm/getOutboundCallLead'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function cannotConnect(): NextResponse {
  return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Say>We could not connect your call. Please try again.</Say><Hangup/></Response>')
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const callSid = verified.params.CallSid ?? ''

  const target = await getOutboundCallLead(callSid)
  if (!target) return cannotConnect()

  const site = TWILIO_PUBLIC_ORIGIN

  // Recording = env kill-switch AND the Company Settings master switch (spec
  // §15/§1.4 AC-3). Fail open to recording-on — a settings-read failure must
  // never silently drop the compliance-default behavior. The recorded-notice
  // <Say> is coupled to the record directive (ci:call-recording-consent).
  let companySettings: Awaited<ReturnType<typeof getCrmCompanySettings>> | null = null
  try { companySettings = await getCrmCompanySettings() } catch { companySettings = null }
  const recording =
    process.env.CRM_CALL_RECORDING !== 'false' &&
    (companySettings?.call_recording_enabled ?? true)
  const announce = recording ? '<Say>This call may be recorded for quality purposes.</Say>' : ''
  const recAttrs = recording
    ? ` record="record-from-answer-dual" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed"`
    : ''

  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announce}
  <Dial timeout="30" callerId="${target.callerId || target.leadE164}"${recAttrs}>${target.leadE164}</Dial>
</Response>`)
}
