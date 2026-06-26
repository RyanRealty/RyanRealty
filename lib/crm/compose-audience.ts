/**
 * compose-audience — the PURE mapping layer for the compose-to-cohort surface
 * (Wave 5). Turns the compose UI's audience choice into the ONE BulkActionSelection
 * shape the Wave-3 bulk path already understands, and shapes the preflight count
 * into the copy the pre-send preview renders.
 *
 * There is exactly ONE send path: app/actions/crm-bulk.ts bulkEmailCohortAction +
 * bulkPreflightCount, resolved through lib/crm/audience.ts. This module never
 * sends — it only maps a UI choice onto the selection that path consumes, so the
 * preview the broker sees and the cohort the worker mails can never diverge.
 *
 * Two audience kinds the cohort path can honestly resolve against crm_people:
 *   - 'view'  → a saved smart list ({ mode: 'view', viewId })  [canonical]
 *   - 'stage' → a single pipeline stage ({ mode: 'matching', filters: { stage } })
 *
 * Newsletter SEGMENTS are deliberately NOT a cohort audience here: they live in
 * the newsletter_subscribers store, not as crm_people rows/tags, so resolving one
 * through the people compiler would return a misleading 0. The newsletter rail has
 * its own send path (app/actions/newsletter.ts). Mixing them would be a second
 * send path and a §0 accuracy hazard. See integrationNotes.
 *
 * Everything here is pure (no I/O) so it is unit-tested directly.
 */

import type { BulkActionSelection } from '@/lib/crm/bulk-helpers'
import { checkTemplateVoice } from '@/lib/crm/templateVoiceCheck'

/** The audience the compose surface targets. Discriminated by `kind`. */
export type ComposeAudience =
  | { kind: 'view'; viewId: number }
  | { kind: 'stage'; stage: string }

/**
 * Map a compose audience choice onto the canonical BulkActionSelection the Wave-3
 * bulk path consumes. Throws on an unusable choice so a no-op cohort is never
 * dispatched (the action + preflight both surface the message verbatim). PURE.
 *
 *   { kind: 'view',  viewId } → { mode: 'view',     viewId }
 *   { kind: 'stage', stage  } → { mode: 'matching', filters: { stage } }
 */
export function audienceToSelection(audience: ComposeAudience): BulkActionSelection {
  if (audience.kind === 'view') {
    const viewId = Number(audience.viewId)
    if (!Number.isFinite(viewId) || viewId <= 0) {
      throw new Error('Pick a smart list to send to')
    }
    return { mode: 'view', viewId }
  }
  if (audience.kind === 'stage') {
    const stage = String(audience.stage ?? '').trim()
    if (!stage) throw new Error('Pick a stage to send to')
    return { mode: 'matching', filters: { stage } }
  }
  throw new Error('Pick an audience to send to')
}

/**
 * Parse a raw audience payload (from the client) into a typed ComposeAudience, or
 * return an error string. PURE — no I/O. Used by the server action before it maps
 * to a selection, so a malformed payload fails fast with a readable message.
 */
export function parseComposeAudience(
  raw: { kind?: unknown; viewId?: unknown; stage?: unknown } | null | undefined,
): { ok: true; audience: ComposeAudience } | { ok: false; error: string } {
  const kind = typeof raw?.kind === 'string' ? raw.kind : ''
  if (kind === 'view') {
    const viewId = Number(raw?.viewId)
    if (!Number.isFinite(viewId) || viewId <= 0) {
      return { ok: false, error: 'Pick a smart list to send to' }
    }
    return { ok: true, audience: { kind: 'view', viewId } }
  }
  if (kind === 'stage') {
    const stage = typeof raw?.stage === 'string' ? raw.stage.trim() : ''
    if (!stage) return { ok: false, error: 'Pick a stage to send to' }
    return { ok: true, audience: { kind: 'stage', stage } }
  }
  return { ok: false, error: 'Pick an audience to send to' }
}

// ── Content validation (brand-voice hard-fail gate) ──────────────────────────

export type ComposeContentInput = {
  templateId?: string
  subject?: string
  body?: string
}

export type ComposeValidationResult = { ok: true } | { ok: false; error: string }

/**
 * Validate the chosen content. A saved templateId is trusted (it already passed
 * the gate when it was saved). Inline subject + body run through the SAME
 * brand-voice hard-fail gate the template CRUD uses (checkTemplateVoice), so a
 * cohort blast can never carry banned punctuation/wording the gate would block on
 * a saved template. PURE. Used both client-side (fast feedback) and server-side
 * (the authoritative check on send).
 */
export function validateComposeContent(input: ComposeContentInput): ComposeValidationResult {
  const templateId = (input.templateId ?? '').trim()
  if (templateId) return { ok: true }

  const subject = (input.subject ?? '').trim()
  const body = (input.body ?? '').trim()
  if (!subject || !body) {
    return { ok: false, error: 'Pick a template, or write a subject and body' }
  }
  const voice = checkTemplateVoice({ subject, body })
  if (!voice.ok) return { ok: false, error: voice.error }
  return { ok: true }
}

// ── Preview shaping ──────────────────────────────────────────────────────────

/** The raw counts the Wave-3 bulkPreflightCount returns for a send kind. */
export type PreflightCounts = { total: number; suppressedEstimate: number }

/** The shaped preview the compose UI renders: who gets mailed vs skipped. */
export type ComposePreview = {
  /** Everyone the audience resolves to under the caller's scope. */
  total: number
  /** Estimated contacts that carry an email-suppressing tag (will be skipped). */
  willSkip: number
  /** total − willSkip, floored at 0 — the estimated mailable count. */
  willSend: number
  /** A one-line summary for the preview banner. No em-dash / semicolon. */
  summary: string
}

/**
 * Shape preflight counts into the pre-send preview. willSend is total minus the
 * suppression estimate, never negative. The summary is plain-language and
 * brand-voice safe (period-separated, no em-dash, no semicolon). PURE.
 *
 * This is an ESTIMATE by construction (the worker re-checks isSuppressed per
 * contact at send time and fails closed), so the copy says "about" — which §0
 * permits for a genuine estimate, never as a stand-in for a number we could pull
 * exactly. The exact mailable count is only knowable after the suppression
 * chokepoint runs per recipient.
 */
export function shapeComposePreview(counts: PreflightCounts): ComposePreview {
  const total = Math.max(0, Math.trunc(Number(counts.total) || 0))
  const willSkip = Math.min(total, Math.max(0, Math.trunc(Number(counts.suppressedEstimate) || 0)))
  const willSend = Math.max(0, total - willSkip)

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
  const recip = `${total.toLocaleString('en-US')} ${plural(total, 'contact', 'contacts')}`

  let summary: string
  if (total === 0) {
    summary = 'No contacts match this audience. Pick a different smart list or stage.'
  } else if (willSkip === 0) {
    summary = `${recip} match. All can be emailed.`
  } else {
    summary =
      `${recip} match. About ${willSkip.toLocaleString('en-US')} will be skipped ` +
      `(unsubscribed, bounced, or compliance hold). About ` +
      `${willSend.toLocaleString('en-US')} will be emailed.`
  }
  return { total, willSkip, willSend, summary }
}

// ── Scheduling-time validation ───────────────────────────────────────────────

/** Minimum lead time so a "schedule" with a near-now timestamp isn't really a "now". */
export const MIN_SCHEDULE_LEAD_MS = 60_000

/**
 * Validate + normalize a scheduled-send time. PURE (takes `now` for testability).
 * Returns the ISO string to store, or an error. Rejects an unparseable or
 * past/too-soon time so the scheduled-sends cron never has a stale row it should
 * have fired synchronously.
 */
export function normalizeScheduledAt(
  raw: string,
  now: number,
): { ok: true; iso: string } | { ok: false; error: string } {
  const t = Date.parse(raw ?? '')
  if (!Number.isFinite(t)) return { ok: false, error: 'Pick a valid send time' }
  if (t < now + MIN_SCHEDULE_LEAD_MS) {
    return { ok: false, error: 'Pick a send time at least a minute from now, or send it now' }
  }
  return { ok: true, iso: new Date(t).toISOString() }
}
