/**
 * Who gets an automatic signing reminder.
 * Live Forms Create-envelope checkbox (ROLE_LIST.md 2026-08-23) is on by default.
 * Pure. No I/O.
 *
 * Two clocks, because "waiting on you" and "never heard from us" are different
 * problems. A signer who opened the documents and stopped is thinking about it,
 * and 48 hours is the DigiSign/T3.7 cadence for nudging them. A signer who has
 * never opened them may simply never have received the mail — that happened on
 * three of nine invites on the 2840 NE Sedalia Loop walk, where the send was
 * accepted and the message never landed — and waiting two days to try again
 * leaves a live file stalled on silence. Unopened gets a second link in half an
 * hour, capped so nobody is buried.
 */
import { isSignableRole, isValidEmail } from './signing'

export const ENVELOPE_REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000
/**
 * Never opened: assume the mail may not have arrived and send another link —
 * then back off. The first retry is fast because a lost invite should not cost
 * a live file a day. After that, silence is more likely a person who has not
 * got to it than a message that vanished, and an hourly drip is what a real
 * signer would call harassment. Watched happen on 022B: the half-hour rule
 * re-sent at 07:00, 08:01 and 09:01 before the cap stopped it.
 */
export const ENVELOPE_INVITE_UNSEEN_BACKOFF_MS = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 8 * 60 * 60 * 1000]
/** Total signing links one recipient may be emailed before we stop and flag. */
export const ENVELOPE_MAX_LINK_EMAILS = 4
export const ENVELOPE_REMINDER_BATCH = 40

export type EnvelopeReminderCandidate = {
  recipientId: string
  envelopeId: string
  envelopeName: string
  envelopeStatus: string
  remindersEnabled: boolean
  cycleId: string
  createdBy: string | null
  propertyAddress: string
  email: string
  name: string
  role: string
  actionRequired?: string | null
  completedAt: string | null
  declinedAt: string | null
  sentAt: string | null
  lastRemindedAt: string | null
  authTokenHash: string | null
  viewedAt: string | null
  /** Signing links already emailed to this recipient — invites and reminders. */
  linkEmailsSent?: number
}

/** True once we have emailed this recipient as many links as we are willing to. */
export function linkEmailBudgetSpent(candidate: { linkEmailsSent?: number }): boolean {
  return (candidate.linkEmailsSent ?? 0) >= ENVELOPE_MAX_LINK_EMAILS
}

/** How long to wait before sending this recipient another link. */
export function reminderWaitMs(candidate: { viewedAt: string | null; linkEmailsSent?: number }): number {
  if (candidate.viewedAt) return ENVELOPE_REMINDER_INTERVAL_MS
  // One email out (the invite itself) still means the first retry is the fast one.
  const sent = Math.max(0, candidate.linkEmailsSent ?? 0)
  const step = Math.min(Math.max(0, sent - 1), ENVELOPE_INVITE_UNSEEN_BACKOFF_MS.length - 1)
  return ENVELOPE_INVITE_UNSEEN_BACKOFF_MS[step]!
}

/** Recipients whose turn has started and who are due another link. */
export function pickEnvelopeReminders(
  candidates: readonly EnvelopeReminderCandidate[],
  nowMs: number,
): EnvelopeReminderCandidate[] {
  const due: EnvelopeReminderCandidate[] = []
  for (const c of candidates) {
    if (!c.remindersEnabled) continue
    if (
      c.envelopeStatus !== 'sent' &&
      c.envelopeStatus !== 'partially_signed'
    ) {
      continue
    }
    if (c.completedAt || c.declinedAt) continue
    if (!isSignableRole(c.role, c.actionRequired)) continue
    if (!isValidEmail(c.email)) continue
    // Ordered routing: later groups have no token until their turn.
    if (!c.authTokenHash && !c.viewedAt) continue
    if (linkEmailBudgetSpent(c)) continue
    const last = Date.parse(c.lastRemindedAt ?? c.sentAt ?? '')
    if (!Number.isFinite(last)) continue
    if (nowMs - last < reminderWaitMs(c)) continue
    due.push(c)
    if (due.length >= ENVELOPE_REMINDER_BATCH) break
  }
  return due
}
