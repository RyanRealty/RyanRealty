import 'server-only'

/**
 * crm-sequence-engine helpers — pure/total utilities split out of route.ts
 * (file-size budget, 2026-07-02). No behavior change: identical bodies moved
 * verbatim from the route.
 */

import { attributeSiteLinks, renderCrmMerge, type MergeContext, type MergePersonLike } from '@/lib/crm/merge'

/**
 * A FollowUpBoss-archived email/SMS template imports into crm_templates with its
 * subject AND body replaced by the literal placeholder "archived" (FUB's marker
 * for a disabled template). Delivering one sends a contact an email/text that
 * literally reads "archived". This guards the send path: a resolved template
 * whose subject or body is just that placeholder is never sent. Pure + total.
 */
export function isArchivedPlaceholder(subject: string, body: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase()
  return norm(body) === 'archived' || norm(subject) === 'archived'
}

export function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export function laHour(): number {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()))
}

export function inSmsQuietHours(): boolean {
  const h = laHour()
  return h < 8 || h >= 21
}

export function nextSendWindow(): Date {
  // next 07:05 LA time
  const now = new Date()
  const la = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const target = new Date(la)
  target.setHours(7, 5, 0, 0)
  if (la.getHours() >= 7) target.setDate(target.getDate() + 1)
  return new Date(now.getTime() + (target.getTime() - la.getTime()))
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

export function renderMerge(
  text: string,
  person: MergePersonLike & { assigned_broker?: string | null; fub_legacy_id?: number | null },
  ctx?: MergeContext,
): string {
  // Every site link in an automated send carries the assigned broker (routing)
  // AND the recipient's FUB id (?_fuid=) — so a click identifies them, cookies
  // the browser to the contact, and backfills their anonymous sessions.
  return attributeSiteLinks(renderCrmMerge(text, person, ctx), person.assigned_broker ?? 'matt', person.fub_legacy_id ?? null)
}
