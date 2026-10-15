/**
 * TwiML Twilio fetches when Matt's cell is dialed into a live Sarah conference.
 * ?conference=sarah-live-{CallSid}&mode=listen|coach|barge
 */
import { NextResponse } from 'next/server'
import { verifiedTwilioParams } from '@/lib/crm/twilio'
import { bargeTwiml, findConferenceParticipantCallSid, type SarahBargeMode } from '@/lib/voice/sarah-conference'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function parseMode(raw: string | null): SarahBargeMode {
  if (raw === 'listen' || raw === 'coach' || raw === 'barge') return raw
  return 'barge'
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const url = new URL(request.url)
  const conference = (url.searchParams.get('conference') ?? '').trim()
  if (!conference.startsWith('sarah-live-')) {
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Conference not found.</Say><Hangup/></Response>')
  }
  const mode = parseMode(url.searchParams.get('mode'))
  const coachCallSid = mode === 'coach' ? await findConferenceParticipantCallSid(conference, 'sarah') : null
  return xml(bargeTwiml({ conferenceName: conference, mode, coachCallSid }))
}
