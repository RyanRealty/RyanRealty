/**
 * <Dial action> for the receptionist SIP leg and for receptionist transfers.
 * Completed → hang up. Anything else (SIP failure, transfer not answered) →
 * Twilio voicemail, which /api/twilio/recording transcribes onto the CRM.
 */
import { NextResponse } from 'next/server'
import { TWILIO_PUBLIC_ORIGIN, verifiedTwilioParams } from '@/lib/crm/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const status = verified.params.DialCallStatus ?? ''
  const site = TWILIO_PUBLIC_ORIGIN
  const body = status === 'completed'
    ? '<Response><Hangup/></Response>'
    : `<Response>
  <Say>Sorry, we couldn't connect you. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
