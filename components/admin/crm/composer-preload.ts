/**
 * composer-preload — suggested-reply deep-link consumption for the canonical
 * composers (EmailComposer / SmsComposer).
 *
 * Contract: a deep link may carry a suggested reply in query params, e.g.
 *   /admin/crm/123?reply=Thanks%20for%20reaching%20out#comms          (SMS)
 *   /admin/crm/123?reply=...&replyChannel=email&replySubject=Re%3A...  (email)
 *
 * This matches the mobile inbox's existing prefill pattern (query params:
 * ?c=<id>&m=sms|email, ?compose=1, ?tpl=/?smsTpl= on the contact page) rather
 * than a sessionStorage handoff, because the carrier is a LINK in an SMS/email
 * alert (e.g. the inbound-text forward that points at /admin/crm/<id>#comms) —
 * a link cannot write sessionStorage.
 *
 * Mechanics: the FIRST composer to call consumeSuggestedReply() parses the
 * params once, snapshots the value at module scope, and strips the reply
 * params from the URL (history.replaceState, hash preserved) so a refresh or
 * back-nav never re-applies the text. The snapshot stays consumable for a
 * short window (APPLY_WINDOW_MS) so BOTH render trees of the contact page
 * (mobile Comms tab + desktop center column mount the composer twice) preload
 * consistently, while a composer remount minutes later — e.g. after the reply
 * was sent — gets nothing and the box stays empty.
 *
 * A preload only FILLS an editable input. It never sends. The send still goes
 * through the suppression-gated actions behind the composers (G50).
 */

export type SuggestedReply = {
  channel: 'email' | 'sms'
  body: string
  subject: string | null
}

/** Caps: a suggested reply is compose-box text, never a document. */
const BODY_MAX = 2000
const SUBJECT_MAX = 300

/** How long after first parse the snapshot stays consumable (both trees mount
 *  within one hydration pass; later remounts must not re-apply). */
export const APPLY_WINDOW_MS = 8000

/** Parse the suggested-reply params out of a location.search string. Pure. */
export function parseSuggestedReply(search: string): SuggestedReply | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }
  const body = (params.get('reply') ?? '').trim()
  if (!body) return null
  const channel = params.get('replyChannel') === 'email' ? 'email' : 'sms'
  const subject = (params.get('replySubject') ?? '').trim().slice(0, SUBJECT_MAX) || null
  return { channel, body: body.slice(0, BODY_MAX), subject }
}

/** Remove the reply params from a search string (other params survive). Pure. */
export function stripSuggestedReplyParams(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('reply')
  params.delete('replySubject')
  params.delete('replyChannel')
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Whether a snapshot taken at `at` is still applyable at `now`. Pure. */
export function replyStillApplies(at: number, now: number): boolean {
  return now - at <= APPLY_WINDOW_MS
}

let snapshot: { value: SuggestedReply | null; at: number } | undefined

/**
 * Consume the suggested reply for a channel. Returns the reply when the URL
 * carried one for this channel and we are still inside the apply window,
 * otherwise null. Client-only (returns null during SSR).
 */
export function consumeSuggestedReply(
  channel: 'email' | 'sms',
  now: number = Date.now(),
): SuggestedReply | null {
  if (typeof window === 'undefined') return null
  if (snapshot === undefined) {
    const value = parseSuggestedReply(window.location.search)
    snapshot = { value, at: now }
    if (value) {
      try {
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${stripSuggestedReplyParams(window.location.search)}${window.location.hash}`,
        )
      } catch {
        /* non-fatal — worst case the params stay in the URL */
      }
    }
  }
  if (!snapshot.value) return null
  if (snapshot.value.channel !== channel) return null
  if (!replyStillApplies(snapshot.at, now)) return null
  return snapshot.value
}

/** Test-only: clear the module snapshot between cases. */
export function __resetSuggestedReplyForTests(): void {
  snapshot = undefined
}
