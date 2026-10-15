/**
 * TwiML Twilio fetches when Matt's cell is dialed into a live Sarah conference.
 * ?conference=sarah-live-{CallSid}&mode=listen|coach|barge
 */
import { NextResponse } from 'next/server'
import { verifiedTwilioParams } from '@/lib/crm/twilio'
import {
  isSarahLiveConference,
  mattConferenceJoin,
  sarahSessionConferenceJoin,
  sessionIdFromSarahConference,
  type SarahBargeRole,
} from '@/lib/sarah'
import { bargeTwiml, findConferenceParticipantCallSid } from '@/lib/voice/sarah-conference'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function parseMode(raw: string | null): SarahBargeRole {
  if (raw === 'listen' || raw === 'coach' || raw === 'barge') return raw
  return 'barge'
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const url = new URL(request.url)
  const conference = (url.searchParams.get('conference') ?? '').trim()
  if (!isSarahLiveConference(conference)) {
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Conference not found.</Say><Hangup/></Response>')
  }
  const sessionId = sessionIdFromSarahConference(conference)
  if (!sessionId) {
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Conference not found.</Say><Hangup/></Response>')
  }
  const mode = parseMode(url.searchParams.get('mode'))
  const join = mattConferenceJoin(sessionId, mode)
  const coachCallSid =
    join.coach ? await findConferenceParticipantCallSid(join.conferenceName, sarahSessionConferenceJoin(sessionId).label) : null
  return xml(bargeTwiml({ sessionId, mode, coachCallSid }))
}
