/**
 * Membership-consent decision helper (CONTACT360 Phase 3.3).
 *
 * The one-click membership toggles (workflow / newsletter / listing-alerts) let
 * a broker re-subscribe a contact INTO a channel. That re-subscribe is a
 * compliance decision, not a UI nicety: a contact who hard-opted-out of a
 * channel (CAN-SPAM unsubscribe, a hard bounce, a spam complaint, a TCPA
 * do-not-text STOP keyword, a do-not-call / hard-stop flag) must NEVER be
 * silently re-enabled by a broker click. This module is the PURE decision: given
 * the channel and the contact's current suppression footprint, may we subscribe?
 *
 * It is intentionally side-effect free (no DB, no client) so the rule is
 * unit-testable in isolation and so app/actions/crm-membership.ts cannot
 * accidentally route a re-subscribe around it. The action reads the live
 * suppression rows (via lib/crm/suppressions + the person's tags) and feeds them
 * here BEFORE removing any suppression.
 *
 * Two kinds of suppression exist on a channel:
 *   1. HARD-STOP — a compliance / deliverability / legal opt-out we must honor.
 *      Re-subscribing over one is forbidden. The contact (or a carrier, or a
 *      mailbox provider) said no. Examples by reason:
 *        email: unsubscribe, bounce, complaint, do_not_email, unsubscribed,
 *               bounced, complained, hard-stop
 *        sms:   stop-keyword, twilio-opt-out, do-not-text, do-not-call, hard-stop
 *        all:   hard-stop (compliance:hard-stop tag) — blocks every channel
 *   2. SOFT / SYSTEM-DEFAULT — a suppression WE set as a fail-closed default,
 *      reversible by an explicit broker/contact action. Today the only one is
 *      'no-sms-consent' (the A2P 10DLC default applied to every lead that did
 *      not check the SMS consent box). A broker turning a contact's workflow on
 *      MAY clear this, because no opt-out was ever expressed — it was simply the
 *      absence of an opt-in. Email is never gated this way.
 *
 * The 'channel:all' suppression (compliance:hard-stop) blocks EVERY channel —
 * it is always a hard-stop regardless of the channel being subscribed.
 */

/** Channels a membership toggle can subscribe a contact into. */
export type ConsentChannel = 'email' | 'sms'

/**
 * A normalized suppression signal the decision reads. `channel` is the channel
 * the suppression applies to ('all' blocks everything). `reason` is the raw
 * suppression reason string (from crm_suppressions.reason) OR a tag-derived
 * pseudo-reason. The decision never trusts a bare presence — it classifies the
 * reason so a soft system default ('no-sms-consent') does not masquerade as a
 * legal opt-out.
 */
export type SuppressionSignal = {
  channel: 'all' | 'email' | 'sms' | 'call'
  reason: string
}

export type CanSubscribeResult = { allowed: boolean; reason?: string }

/**
 * Suppression reasons that are a SOFT, system-set fail-closed default — NOT an
 * expressed opt-out. These are the only reasons a re-subscribe may clear. Today
 * this is exactly the A2P "no opt-in yet" default on the sms channel. Everything
 * NOT in this set is treated as a hard-stop (fail-closed: an unknown reason is a
 * real opt-out we must honor, never something to silently override).
 */
const SOFT_DEFAULT_REASONS = new Set<string>(['no-sms-consent'])

/** Normalize a reason for comparison (lowercase, trimmed). */
function normReason(reason: string): string {
  return String(reason ?? '').trim().toLowerCase()
}

/**
 * PURE: may we subscribe this contact into `channel`?
 *
 * Returns `{ allowed: false, reason }` when ANY of:
 *   - a 'channel:all' suppression exists (compliance hard-stop blocks everything)
 *   - a suppression on THIS channel exists whose reason is not a soft default
 *     (a hard-stop / stop-keyword / opt-out on the same channel)
 * Otherwise `{ allowed: true }` — a clean channel, or a channel carrying only a
 * soft system default (e.g. 'no-sms-consent') the broker is clearing on purpose.
 *
 * Suppressions on OTHER channels are ignored: an email unsubscribe never blocks
 * re-subscribing SMS, and vice-versa. Only 'all' crosses channels.
 */
export function canSubscribe(channel: ConsentChannel, suppressions: SuppressionSignal[]): CanSubscribeResult {
  const rows = Array.isArray(suppressions) ? suppressions : []

  // 1. A compliance hard-stop on 'all' blocks every channel, always.
  const hardStopAll = rows.find((s) => s.channel === 'all')
  if (hardStopAll) {
    return { allowed: false, reason: `compliance hard-stop (${normReason(hardStopAll.reason) || 'all'}) blocks every channel` }
  }

  // 2. Any suppression on THIS channel that is not a soft system default is a
  //    real opt-out we must honor.
  for (const s of rows) {
    if (s.channel !== channel) continue
    if (SOFT_DEFAULT_REASONS.has(normReason(s.reason))) continue
    return { allowed: false, reason: `${channel} opt-out on file (${normReason(s.reason) || channel}) — cannot re-subscribe` }
  }

  return { allowed: true }
}

/**
 * PURE: is a given suppression reason on a channel a SOFT system default that a
 * re-subscribe is allowed to clear? Used by the action to decide WHICH
 * suppression row to remove (only ever the soft one) — never the legal opt-out.
 */
export function isSoftDefaultSuppression(reason: string): boolean {
  return SOFT_DEFAULT_REASONS.has(normReason(reason))
}
