/**
 * reachability: entry-point — phone-line hook points for Sarah.
 *
 * HARD CONSTRAINT: do not modify app/api/voice/* or lib/grok/voice-sip.ts from
 * this workstream. The phone main line lives there. That line should call the
 * functions below (and the persona/guardrails in this folder) instead of a
 * second prompt.
 *
 * Hook map the phone route must use:
 * 1. Greeting: sarahGreeting('voice') from ./persona (Counsel verbatim).
 *    Replace RECEPTIONIST_GREETING. The current spare-line greeting is not
 *    Counsel-compliant (it omits "not a person and not a licensed broker").
 * 2. Instructions: buildSarahSystemPrompt({ channel: 'voice', listingFreshness }).
 *    Replace RECEPTIONIST_PROMPT. Do not keep the qualify-the-caller interview.
 * 3. Call start: notifySarahLiveSession({ channel: 'voice', ... }) so Matt gets
 *    the Twilio SMS and the admin live view (implemented in a later PR).
 * 4. Barge-in: after answer, place the SIP leg in a named Twilio conference
 *    `sarah-live-{sessionId}`. Matt joins listen/coach then can cut in.
 *    Use existing referSipCall only as the transfer path, do not edit voice-sip.
 * 5. Recording objection: evaluateSarahTurn mode stop-recording. End the AI
 *    session. Do not keep recording. Take a callback number.
 * 6. Urgent: warm transfer to Matt's cell via the existing transfer_call tool
 *    / receptionist-refer allowlist. If no answer in ~25s, take a message and
 *    send Matt an URGENT SMS.
 * 7. Call end: keep logReceptionistCall, then the shared Sarah CRM recap
 *    pipeline (later PR): note, stage/tag updates attributed "by Sarah", recap
 *    SMS or email.
 * 8. Outbound AI dials: only placeSarahOutboundCall after evaluateOutboundDial
 *    returns ok. SARAH_OUTBOUND_ENABLED stays off. Never dial banned sources.
 *
 * This file exports the session contract only. Notify/SMS/conference/dialer
 * implementations land in later PRs so the phone line can import a stable API.
 */
import type { SarahChannel } from './guardrails'

export const SARAH_LIVE_CONFERENCE_PREFIX = 'sarah-live-' as const

export function sarahLiveConferenceName(sessionId: string): string {
  const id = sessionId.trim()
  if (!id) throw new Error('sarah live conference needs a session id')
  return `${SARAH_LIVE_CONFERENCE_PREFIX}${id}`
}

export type SarahLiveSessionInput = {
  channel: SarahChannel
  sessionId: string
  personId?: number | null
  displayName?: string | null
  contact?: string | null
  summary?: string | null
  xaiCallId?: string | null
}

/**
 * Phone and web call this when a Sarah session starts. Returns a signed live
 * view path for Matt's SMS. Implementation is filled in the alerts PR; this
 * stub is the stable import the phone line should already call.
 */
export async function notifySarahLiveSession(
  _input: SarahLiveSessionInput,
): Promise<{ livePath: string } | { skipped: true; reason: string }> {
  return { skipped: true, reason: 'notify-not-wired' }
}
