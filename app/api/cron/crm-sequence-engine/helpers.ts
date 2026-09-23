import 'server-only'

/**
 * crm-sequence-engine helpers — pure/total utilities split out of route.ts
 * (file-size budget, 2026-07-02). SMS quiet hours come from lib/crm/quiet-hours
 * (Oregon 8pm). Do not reintroduce a local 9pm copy.
 */

import {
  attributeSiteLinks,
  isPlaceholderLeadName,
  primaryValue,
  renderCrmMerge,
  type MergeContext,
  type MergePersonLike,
} from '@/lib/crm/merge'
import { classifyLeadQuality, hasSuspectTag } from '@/lib/crm/lead-quality'
import {
  hourInTimeZone,
  inSmsQuietHours as canonicalInSmsQuietHours,
  nextSmsWindow,
} from '@/lib/crm/quiet-hours'

/**
 * An archived email/SMS template imports into crm_templates with its
 * subject AND body replaced by the literal placeholder "archived" (CRM's marker
 * for a disabled template). Delivering one sends a contact an email/text that
 * literally reads "archived". This guards the send path: a resolved template
 * whose subject or body is just that placeholder is never sent. Pure + total.
 */
export function isArchivedPlaceholder(subject: string, body: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase()
  return norm(body) === 'archived' || norm(subject) === 'archived'
}

export function laHour(): number {
  return hourInTimeZone(new Date())
}

/** Oregon 8am–8pm Pacific. Do not fork a 9pm copy here (deep audit C1). */
export function inSmsQuietHours(date?: Date): boolean {
  return canonicalInSmsQuietHours(date)
}

/** Next 8:05am Pacific — after the Oregon SMS window opens. */
export function nextSendWindow(): Date {
  return nextSmsWindow()
}

export type Step = {
  channel?: string
  delayDays?: number
  delayMinutes?: number
  templateKey?: string
  subject?: string
  body?: string
  taskName?: string
  taskType?: string
  addTags?: string[]
  removeTags?: string[]
  /** When true, this step is a broker-confirmed "recommended next step" — the
   *  engine parks the enrollment (awaiting_broker_next) instead of auto-sending. */
  confirm?: boolean
  /** For sms steps: the email to send instead when texting is unavailable
   *  (A2P not live and no iMessage relay) — "optional email or text". */
  fallbackEmailSubject?: string
  fallbackEmailBody?: string
  /** v2 action channels — change_stage / add_note / reassign / run_automation */
  value?: string
  /** v2 condition node marker — discriminated by type === 'condition' */
  type?: string
}

// ── FUNNEL-3: a suppressed SMS step (2026-09-23) ─────────────────────────────
//
// An SMS step used to FINISH the whole enrollment when texting was suppressed
// for the contact. Every site form that does not tick the consent box writes an
// sms suppression (lib/crm/enroll.ts, fail-closed A2P/TCPA, untouched here), so
// 78 of 81 Buyer Master enrollments in the 30 days to 2026-09-23T02:49Z ended
// 'suppressed' at step 1 after one email and never reached the broker-confirmed
// task. Now a person
// whose only block is the sms channel skips the text and moves on; a suspect
// never advances; anything wider (all-channel, a compliance tag, a failed
// check) still halts. Steps are not reordered.

/**
 * Env switch that lets a suppressed SMS step send the step's own
 * fallbackEmailBody instead of simply skipping. OFF unless set to 'on': the
 * Buyer Master fallback copy tells every recipient their listing alerts are
 * live, which is false for a contact-form buyer, and that copy is Matt's call.
 */
export const SUPPRESSED_SMS_FALLBACK_EMAIL_FLAG = 'CRM_SEQ_SUPPRESSED_SMS_FALLBACK_EMAIL'

export function suppressedSmsFallbackEmailEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return String(env[SUPPRESSED_SMS_FALLBACK_EMAIL_FLAG] ?? '').trim().toLowerCase() === 'on'
}

export type SuppressedSmsStepDecision = 'halt' | 'skip' | 'fallback-email'

/**
 * What to do with an SMS step when isSuppressed(person, 'sms') said no.
 * `reasons` is isSuppressed's list: `<channel>:<reason>` for suppression rows,
 * `tag:<tag>` for compliance tags, `*-check-failed: …` for a read error.
 */
export function decideSuppressedSmsStep(input: {
  reasons: readonly string[]
  suspect: boolean
  hasFallbackEmail: boolean
  fallbackEmailEnabled: boolean
}): SuppressedSmsStepDecision {
  if (input.suspect) return 'halt'
  if (input.reasons.length === 0) return 'halt'
  // Only a row on the sms channel itself (no-sms-consent, a STOP reply) is a
  // text-only block. 'all:' rows, compliance tags and check failures halt.
  if (!input.reasons.every((r) => r.startsWith('sms:'))) return 'halt'
  if (input.fallbackEmailEnabled && input.hasFallbackEmail) return 'fallback-email'
  return 'skip'
}

/**
 * The engine's belt on the intake screen: the quality:suspect tag, or the same
 * classifier run on the stored name and address (catches rows created before
 * the screen existed). Used only to refuse an advance, never to send.
 */
export function looksSuspect(person: {
  tags?: unknown
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  emails?: unknown
}): boolean {
  if (hasSuspectTag(person.tags)) return true
  const typed =
    [person.first_name, person.last_name].filter((s) => typeof s === 'string' && s.trim()).join(' ').trim() ||
    (isPlaceholderLeadName(person.name) ? '' : String(person.name ?? '').trim())
  return classifyLeadQuality({ name: typed, email: primaryValue(person.emails) }).suspect
}

export function renderMerge(
  text: string,
  person: MergePersonLike & {
    id?: number | null
    assigned_broker?: string | null
    fub_legacy_id?: number | null
  },
  ctx?: MergeContext,
): string {
  // Every site link in an automated send carries the assigned broker (routing)
  // AND the recipient's identity — so a click identifies them, cookies the
  // browser to the contact, and backfills their anonymous sessions.
  //
  // BOTH ids are passed on purpose. `_fuid` is the retired vendor CRM's id and
  // only 18,188 of 23,078 contacts have one; `_pid` is the native crm_people id
  // and every contact has one. Passing only _fuid left 4,890 people — everyone
  // created since the CRM cutover, and the only segment still growing —
  // permanently unidentifiable no matter how many links they clicked.
  return attributeSiteLinks(
    renderCrmMerge(text, person, ctx),
    person.assigned_broker ?? 'matt',
    person.fub_legacy_id ?? null,
    person.id ?? null,
  )
}
