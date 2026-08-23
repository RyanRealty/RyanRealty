/**
 * Who gets an automatic signing reminder.
 * Live Forms Create-envelope checkbox (ROLE_LIST.md 2026-08-23) is on by default.
 * Interval matches DigiSign/T3.7: 48 hours after send or the last reminder.
 * Pure. No I/O.
 */
import { isSignableRole, isValidEmail } from './signing'

export const ENVELOPE_REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000
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
}

/** Recipients whose turn has started and who have waited 48h since last contact. */
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
    const last = Date.parse(c.lastRemindedAt ?? c.sentAt ?? '')
    if (!Number.isFinite(last)) continue
    if (nowMs - last < ENVELOPE_REMINDER_INTERVAL_MS) continue
    due.push(c)
    if (due.length >= ENVELOPE_REMINDER_BATCH) break
  }
  return due
}
