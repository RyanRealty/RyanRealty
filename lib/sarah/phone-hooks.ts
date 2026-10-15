/**
 * reachability: entry-point — phone-line hook points for Sarah.
 *
 * HARD CONSTRAINT: do not modify app/api/voice/*, app/api/twilio/*, or
 * lib/grok/voice-sip.ts from this workstream. Another agent owns the phone
 * main line. That line imports this module (persona, guardrails, and the
 * helpers below) instead of a second prompt.
 *
 * Hook map the phone route must use:
 * 1. Greeting: sarahGreeting('voice') from ./persona (Counsel verbatim).
 *    Replace RECEPTIONIST_GREETING. The current spare-line greeting is not
 *    Counsel-compliant (it omits "not a person and not a licensed broker").
 * 2. Instructions: buildSarahSystemPrompt({ channel: 'voice', listingFreshness }).
 *    Replace RECEPTIONIST_PROMPT. Do not keep the qualify-the-caller interview.
 * 3. Call start: notifyLiveSession({ channel: 'voice', ... }) so Matt gets
 *    the Twilio SMS and the admin live view (alerts PR fills the body).
 * 4. Barge-in: after answer, place the SIP leg in
 *    sarahLiveConferenceName(sessionId). Matt joins with mattConferenceJoin
 *    (listen, then coach, then barge). Use existing referSipCall only as the
 *    transfer path; do not edit voice-sip.
 * 5. Recording objection: evaluateSarahTurn mode stop-recording. End the AI
 *    session. Do not keep recording. Take a callback number.
 * 6. Urgent: warm transfer to Matt's cell via the existing transfer_call tool
 *    / receptionist-refer allowlist. If no answer in ~25s, take a message and
 *    send Matt an URGENT SMS.
 * 7. Public records: register LOOKUP_PUBLIC_RECORDS_TOOL from ./public-records
 *    and run runLookupPublicRecords for the call. Do not invent a permit.
 * 8. Call end: keep logReceptionistCall, then the shared Sarah CRM recap
 *    pipeline (later PR): note, stage/tag updates attributed "by Sarah", recap
 *    SMS or email.
 * 9. Outbound AI dials: only placeSarahOutboundCall after evaluateOutboundDial
 *    returns ok. SARAH_OUTBOUND_ENABLED stays off. Never dial banned sources.
 *
 * This file is the stable import. Notify/SMS/Twilio REST stay in the phone
 * agent's routes; they apply the participant flags returned here.
 */
import type { SarahChannel } from './guardrails'

export const SARAH_LIVE_CONFERENCE_PREFIX = 'sarah-live-' as const

export function sarahLiveConferenceName(sessionId: string): string {
  const id = sessionId.trim()
  if (!id) throw new Error('sarah live conference needs a session id')
  return `${SARAH_LIVE_CONFERENCE_PREFIX}${id}`
}

export function isSarahLiveConference(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim()
  return n.startsWith(SARAH_LIVE_CONFERENCE_PREFIX) && n.length > SARAH_LIVE_CONFERENCE_PREFIX.length
}

export function sessionIdFromSarahConference(name: string | null | undefined): string | null {
  const n = String(name ?? '').trim()
  if (!isSarahLiveConference(n)) return null
  return n.slice(SARAH_LIVE_CONFERENCE_PREFIX.length)
}

export type SarahLiveSessionInput = {
  channel: SarahChannel
  sessionId: string
  personId?: number | null
  displayName?: string | null
  contact?: string | null
  summary?: string | null
  xaiCallId?: string | null
  /** CRM desk broker (Matt when unassigned). Alerts and takeover follow this. */
  deskBrokerSlug?: 'matt' | 'rebecca' | 'paul' | null
}

export type NotifyLiveSessionResult = { livePath: string } | { skipped: true; reason: string }

export function sarahLiveViewPath(sessionId: string): string {
  const id = sessionId.trim()
  if (!id) throw new Error('sarah live view needs a session id')
  return `/admin/sarah/live/${encodeURIComponent(id)}`
}

/**
 * Phone and web call this when a Sarah session starts. Returns a signed live
 * view path for the resolved desk broker's SMS (Matt when unassigned).
 * Implementation is filled in the alerts PR; this stub is the stable import
 * the phone line should already call.
 */
export async function notifyLiveSession(
  input: SarahLiveSessionInput,
): Promise<NotifyLiveSessionResult> {
  const id = input.sessionId.trim()
  if (!id) return { skipped: true, reason: 'missing-session-id' }
  return { skipped: true, reason: 'notify-not-wired' }
}

/** Alias kept for existing call sites. Prefer notifyLiveSession. */
export const notifySarahLiveSession = notifyLiveSession

export const SARAH_BARGE_ROLES = ['listen', 'coach', 'barge'] as const
export type SarahBargeRole = (typeof SARAH_BARGE_ROLES)[number]
export type SarahConferenceLabel = 'session' | 'matt'

/**
 * Twilio conference participant flags. The phone line applies these when it
 * creates or updates the conference; this module does not call Twilio.
 *
 * listen: Matt hears the call, nobody hears Matt.
 * coach: Matt whispers to the Sarah/session leg only (Twilio coach=true).
 * barge: Matt is fully in; the caller hears him.
 * session: the inbound SIP/AI leg. It starts and ends the conference.
 */
export type SarahConferenceJoin = {
  conferenceName: string
  sessionId: string
  label: SarahConferenceLabel
  role: SarahBargeRole | 'session'
  muted: boolean
  coach: boolean
  startConferenceOnEnter: boolean
  endConferenceOnExit: boolean
}

export function sarahSessionConferenceJoin(sessionId: string): SarahConferenceJoin {
  const id = sessionId.trim()
  return {
    conferenceName: sarahLiveConferenceName(id),
    sessionId: id,
    label: 'session',
    role: 'session',
    muted: false,
    coach: false,
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
  }
}

export function mattConferenceJoin(sessionId: string, role: SarahBargeRole): SarahConferenceJoin {
  const id = sessionId.trim()
  const conferenceName = sarahLiveConferenceName(id)
  const base = {
    conferenceName,
    sessionId: id,
    label: 'matt' as const,
    startConferenceOnEnter: false,
    endConferenceOnExit: false,
  }
  switch (role) {
    case 'listen':
      return { ...base, role, muted: true, coach: false }
    case 'coach':
      return { ...base, role, muted: false, coach: true }
    case 'barge':
      return { ...base, role, muted: false, coach: false }
    default: {
      const _never: never = role
      throw new Error(`unknown barge role: ${String(_never)}`)
    }
  }
}
