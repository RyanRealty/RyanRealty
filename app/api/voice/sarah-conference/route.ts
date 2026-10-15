/**
 * Twilio conference status callback: when sarah-live-{CallSid} starts, add the
 * xAI SIP leg so Sarah joins the same room Matt can barge into.
 */
import { NextResponse } from 'next/server'
import { TWILIO_PUBLIC_ORIGIN, verifiedTwilioParams } from '@/lib/crm/twilio'
import {
  addConferenceParticipant,
  fetchTwilioCall,
  findConferenceParticipantCallSid,
  redirectCallToSipFallback,
  sipUriForConference,
} from '@/lib/voice/sarah-conference'
import { notifyLiveSession, sarahSessionConferenceJoin, sessionIdFromSarahConference } from '@/lib/sarah'
import { lookupPersonByPhone } from '@/lib/crm/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const p = verified.params
  const event = (p.StatusCallbackEvent ?? p.EventName ?? '').toLowerCase()
  const name = p.FriendlyName ?? p.ConferenceFriendlyName ?? ''
  const sessionId = sessionIdFromSarahConference(name)
  if (!sessionId) return NextResponse.json({ ok: true, ignored: name || null })

  if (event === 'conference-start' || event === 'start' || event === 'join' || event === 'participant-join') {
    const inbound = await fetchTwilioCall(sessionId)
    const from = inbound?.to || process.env.TWILIO_NUMBER_MARKETING?.trim() || '+15412245025'
    const join = sarahSessionConferenceJoin(sessionId)
    const existing = await findConferenceParticipantCallSid(join.conferenceName, join.label)
    const added = existing
      ? { ok: true as const, callSid: existing }
      : await addConferenceParticipant({
          conference: join.conferenceName,
          from,
          to: sipUriForConference(join.conferenceName),
          label: join.label,
          muted: join.muted,
          endConferenceOnExit: join.endConferenceOnExit,
          timeout: 20,
          statusCallback: `${TWILIO_PUBLIC_ORIGIN}/api/voice/sarah-conference`,
        })
    if (!added.ok) {
      console.error('[sarah-conference] SIP add failed', added.error)
      const recOn = process.env.CRM_CALL_RECORDING !== 'false'
      await redirectCallToSipFallback({ callSid: sessionId, site: TWILIO_PUBLIC_ORIGIN, record: recOn })
    }
    if (event === 'conference-start' || event === 'start') {
      try {
        const caller = inbound?.from || p.From || ''
        const person = caller ? await lookupPersonByPhone(caller) : null
        await notifyLiveSession({
          channel: 'voice',
          sessionId,
          personId: person?.personId ?? null,
          displayName: person?.name ?? null,
          contact: caller || null,
          summary: 'Sarah conference started',
        })
      } catch (e) {
        console.error('[sarah-conference] notify failed', e)
      }
    }
    return NextResponse.json({ ok: true, sip: added.ok })
  }

  return NextResponse.json({ ok: true, event })
}
