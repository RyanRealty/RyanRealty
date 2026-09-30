/**
 * market-report-subscription-control — what a change to a market-report
 * subscription writes, decided in ONE pure place (Matt's decisions 2026-09-29).
 *
 * Four doors change a subscription: the contact's no-login preferences page
 * (via 'email-link'), the RFC 8058 one-click endpoint ('one-click'), the admin
 * card on the CRM record ('admin'), and the signed-in /account page
 * ('self-serve'). They must agree on what "pause", "resume" and "stop" mean,
 * so each asks this module for the patch and the timeline line, then the DAL
 * applies both together (lib/data/crm/marketReportSubscription.ts).
 *
 * The states:
 *   on       is_active, not stopped
 *   paused   not active, no stop stamp        (Pause; also a new row a broker
 *                                              has not turned on yet)
 *   stopped  not active, stop stamp set       (Stop these reports / one-click)
 * Resume from paused turns it back on. Resume from stopped turns it on and
 * clears the stop (Matt: "Resuming after a report stop re-activates the
 * report").
 *
 * ONE COMPLIANCE RULE LIVES HERE. When the CONTACT stopped her own reports
 * (one-click, email link, self-serve), a broker turning them back on is
 * sending commercial email to someone who opted out. So an admin resume of a
 * contact-stopped subscription is refused unless the broker records the
 * contact's new consent (a note of at least MIN_CONSENT_NOTE characters), which
 * is appended to consent_note with the date and the admin.
 *
 * Pure: no I/O, `now` is injected.
 */

import type { ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import type { ReportSubscriptionPatch, ReportSubscriptionRecord } from '@/lib/data/crm/marketReportSubscription'

export type ReportSubscriptionState = 'on' | 'paused' | 'stopped'

export function reportSubscriptionState(
  rec: Pick<ReportSubscriptionRecord, 'isActive' | 'stoppedAt'>,
): ReportSubscriptionState {
  if (rec.isActive) return 'on'
  return rec.stoppedAt ? 'stopped' : 'paused'
}

export type ReportChangeVia = 'email-link' | 'one-click' | 'admin' | 'self-serve'

export type ReportChangeActor = {
  via: ReportChangeVia
  /** The admin's email, for an admin change. */
  adminEmail?: string | null
  /** An admin's record of the contact's renewed consent (see the file comment). */
  consentNote?: string | null
}

export type ReportChange =
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'stop' }
  | { kind: 'frequency'; frequency: ReportFrequency }
  | { kind: 'areas'; areas: string[]; labels: string[] }
  | { kind: 'approve' }

/** Why a change was refused, as a code a caller can branch on (the error is the words). */
export type ReportChangeRefusal = 'consent-required' | 'no-areas' | 'last-area' | 'not-admin'

export type PlannedReportChange =
  | { ok: true; noop: true; message: string }
  | { ok: true; noop: false; patch: ReportSubscriptionPatch; title: string; message: string }
  | { ok: false; error: string; code: ReportChangeRefusal }

/** Minimum length of an admin's consent note when restarting a contact's own stop. */
export const MIN_CONSENT_NOTE = 10

/**
 * The stops the CONTACT made herself: the one-click unsubscribe, her report's
 * email link, her account page. Restarting one needs her new consent on
 * record. One list, read by every door that can turn a report back on (this
 * planner, the send-now action, the hub, the bulk handler, the contact merge).
 */
export const CONTACT_STOP_VIAS = ['one-click', 'email-link', 'self-serve'] as const

const CONTACT_STOPS: ReadonlySet<string> = new Set(CONTACT_STOP_VIAS)

/** True when `stoppedVia` names a stop the contact made herself. */
export function isContactStopVia(stoppedVia: string | null | undefined): boolean {
  return typeof stoppedVia === 'string' && CONTACT_STOPS.has(stoppedVia)
}

/** True when the report is off because the contact stopped it herself. */
export function isContactStopped(rec: Pick<ReportSubscriptionRecord, 'isActive' | 'stoppedVia'>): boolean {
  return !rec.isActive && isContactStopVia(rec.stoppedVia)
}

/** "from the report's email link" / "by the one-click unsubscribe" / "by matt@…". */
export function describeVia(actor: ReportChangeActor): string {
  switch (actor.via) {
    case 'email-link':
      return "from the report's email link"
    case 'one-click':
      return "by the one-click unsubscribe in the report's email"
    case 'self-serve':
      return 'from the account page'
    case 'admin':
      return actor.adminEmail ? `by ${actor.adminEmail}` : 'by an admin'
  }
}

function sameAreas(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function dateOnly(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Plan one change. Returns the patch to write and the timeline title, a no-op
 * when the subscription is already in that state, or a refusal with a reason
 * a person can act on.
 */
export function planReportChange(
  rec: ReportSubscriptionRecord,
  change: ReportChange,
  actor: ReportChangeActor,
  now: Date = new Date(),
): PlannedReportChange {
  const state = reportSubscriptionState(rec)
  const via = describeVia(actor)
  const nowIso = now.toISOString()

  switch (change.kind) {
    case 'pause': {
      if (state !== 'on') return { ok: true, noop: true, message: state === 'stopped' ? 'These reports are stopped.' : 'These reports are already paused.' }
      return {
        ok: true,
        noop: false,
        patch: { is_active: false },
        title: `Market report paused ${via}`,
        message: 'Your market report is paused.',
      }
    }
    case 'resume': {
      if (state === 'on') return { ok: true, noop: true, message: 'Your market report is already on.' }
      if (rec.areas.length === 0) {
        return { ok: false, code: 'no-areas', error: 'Pick at least one area before turning the report back on.' }
      }
      const patch: ReportSubscriptionPatch = { is_active: true }
      if (state === 'stopped') {
        patch.stopped_at = null
        patch.stopped_via = null
        if (actor.via === 'admin' && isContactStopVia(rec.stoppedVia)) {
          const note = (actor.consentNote ?? '').trim()
          if (note.length < MIN_CONSENT_NOTE) {
            return {
              ok: false,
              code: 'consent-required',
              error:
                'This contact stopped these reports themselves. Record how they asked to restart them (a short consent note) before turning them back on.',
            }
          }
          const line = `${dateOnly(now)} restarted ${via}: ${note}`
          patch.consent_note = [rec.consentNote, line].filter(Boolean).join('\n').slice(-2000)
          patch.requested_at = nowIso
        }
      }
      return {
        ok: true,
        noop: false,
        patch,
        title: state === 'stopped' ? `Market report restarted ${via}` : `Market report resumed ${via}`,
        message: 'Your market report is on.',
      }
    }
    case 'stop': {
      if (state === 'stopped') return { ok: true, noop: true, message: 'These reports are already stopped.' }
      return {
        ok: true,
        noop: false,
        patch: { is_active: false, stopped_at: nowIso, stopped_via: actor.via },
        title: `Market report stopped ${via}`,
        message: 'Your market report is stopped. Other email from Ryan Realty is not affected.',
      }
    }
    case 'frequency': {
      if (change.frequency === rec.frequency) return { ok: true, noop: true, message: `Your report already comes ${change.frequency}.` }
      return {
        ok: true,
        noop: false,
        patch: { frequency: change.frequency },
        title: `Market report set to ${change.frequency} ${via}`,
        message: `Your report will come ${change.frequency}.`,
      }
    }
    case 'areas': {
      if (change.areas.length === 0) {
        return { ok: false, code: 'last-area', error: 'Keep at least one area. To stop the report instead, use Stop these reports.' }
      }
      if (sameAreas(change.areas, rec.areas)) return { ok: true, noop: true, message: 'Those areas are already on your report.' }
      return {
        ok: true,
        noop: false,
        patch: { areas: change.areas },
        title: `Market report areas set to ${change.labels.join(', ')} ${via}`,
        message: 'Your report areas are updated.',
      }
    }
    case 'approve': {
      if (actor.via !== 'admin' || !actor.adminEmail) {
        return { ok: false, code: 'not-admin', error: 'Only a broker can approve the first send.' }
      }
      if (rec.firstSendApprovedAt) return { ok: true, noop: true, message: 'The first send is already approved.' }
      return {
        ok: true,
        noop: false,
        patch: { first_send_approved_at: nowIso, first_send_approved_by: actor.adminEmail },
        title: `First market report approved ${via}`,
        message: 'First send approved.',
      }
    }
  }
}

/** The record as a planned patch leaves it. Pure. */
export function withReportPatch(
  rec: ReportSubscriptionRecord,
  patch: ReportSubscriptionPatch,
): ReportSubscriptionRecord {
  const next = { ...rec }
  if (patch.areas !== undefined) next.areas = patch.areas
  if (patch.frequency !== undefined) next.frequency = patch.frequency
  if (patch.is_active !== undefined) next.isActive = patch.is_active
  if (patch.last_sent_at !== undefined) next.lastSentAt = patch.last_sent_at
  if (patch.first_send_approved_at !== undefined) next.firstSendApprovedAt = patch.first_send_approved_at
  if (patch.first_send_approved_by !== undefined) next.firstSendApprovedBy = patch.first_send_approved_by
  if (patch.source !== undefined) next.source = patch.source
  if (patch.requested_at !== undefined) next.requestedAt = patch.requested_at
  if (patch.consent_note !== undefined) next.consentNote = patch.consent_note
  if (patch.stopped_at !== undefined) next.stoppedAt = patch.stopped_at
  if (patch.stopped_via !== undefined) next.stoppedVia = patch.stopped_via
  return next
}

export type PlannedReportChanges =
  | { ok: true; noop: true }
  | {
      ok: true
      noop: false
      /** One patch for every change that is not already so: a single write. */
      patch: ReportSubscriptionPatch
      /** One timeline title per applied change, in order. */
      titles: string[]
      /** The changes that are not no-ops, in order. */
      applied: ReportChange[]
      /** The record as the write leaves it. */
      after: ReportSubscriptionRecord
    }
  | { ok: false; error: string; code: ReportChangeRefusal; change: ReportChange }

/**
 * Plan several changes as ONE write. Each is planned against the record as
 * the earlier ones leave it, and a refusal of any one refuses the whole set
 * before anything is written: "these areas, and turn it on" never saves the
 * areas and then fails the turn-on.
 */
export function planReportChanges(
  rec: ReportSubscriptionRecord,
  changes: readonly ReportChange[],
  actor: ReportChangeActor,
  now: Date = new Date(),
): PlannedReportChanges {
  let after = rec
  const patch: ReportSubscriptionPatch = {}
  const titles: string[] = []
  const applied: ReportChange[] = []
  for (const change of changes) {
    const plan = planReportChange(after, change, actor, now)
    if (!plan.ok) return { ok: false, error: plan.error, code: plan.code, change }
    if (plan.noop) continue
    Object.assign(patch, plan.patch)
    titles.push(plan.title)
    applied.push(change)
    after = withReportPatch(after, plan.patch)
  }
  if (applied.length === 0) return { ok: true, noop: true }
  return { ok: true, noop: false, patch, titles, applied, after }
}
