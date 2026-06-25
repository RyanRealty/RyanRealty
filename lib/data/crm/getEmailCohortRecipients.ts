/**
 * getEmailCohortRecipients — batch-load the person fields the bulk email-cohort
 * handler needs to render + send one templated email per recipient, in ONE query
 * over a chunk of ids (never N+1 per id).
 *
 * DAL boundary (G1): the raw crm_people .from() read lives here. The handler
 * (lib/crm/bulk-handlers/email-cohort.ts) consumes the returned rows and owns the
 * send + suppression + record loop.
 *
 * Returns rows keyed in NO particular order; the handler maps them back to the
 * input id list so a missing/deleted person is skipped (counted no-email by the
 * handler when no address resolves). Deleted rows are excluded — a soft-deleted
 * contact is never mailed.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** The crm_people projection the email-cohort send + merge needs. */
export type EmailCohortRecipient = {
  id: number
  fub_legacy_id: number | null
  /** Primary/first email address, resolved from the emails JSONB. '' when none. */
  email: string
  assigned_broker: string | null
  name: string | null
  first_name: string | null
  custom: Record<string, unknown>
}

/** First non-empty string out of a crm_people JSONB contact array (emails). */
export function firstEmail(raw: unknown): string {
  if (!Array.isArray(raw)) return ''
  // Prefer an isPrimary-flagged entry, else the first usable one.
  const sorted = [...raw].sort(
    (a, b) =>
      Number(!!(b as { isPrimary?: number | boolean })?.isPrimary) -
      Number(!!(a as { isPrimary?: number | boolean })?.isPrimary),
  )
  for (const item of sorted) {
    if (typeof item === 'string' && item.trim()) return item.trim()
    if (item && typeof item === 'object') {
      const v = (item as { value?: unknown }).value
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return ''
}

/**
 * Load the recipients for a chunk of ids. Excludes soft-deleted rows. Fails SOFT
 * (empty array) on an unreadable table so the chunk reports every id skipped
 * rather than crashing the worker mid-job.
 */
export async function getEmailCohortRecipients(ids: number[]): Promise<EmailCohortRecipient[]> {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0)
  if (clean.length === 0) return []
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,emails,assigned_broker,name,first_name,custom,deleted')
    .in('id', clean)
  if (error || !data) {
    if (error) console.error('[getEmailCohortRecipients]', error.message)
    return []
  }
  return (data as Array<Record<string, unknown>>)
    .filter((r) => r.deleted !== true)
    .map((r) => ({
      id: Number(r.id),
      fub_legacy_id: r.fub_legacy_id == null ? null : Number(r.fub_legacy_id),
      email: firstEmail(r.emails),
      assigned_broker: (r.assigned_broker as string | null) ?? null,
      name: (r.name as string | null) ?? null,
      first_name: (r.first_name as string | null) ?? null,
      custom: (r.custom ?? {}) as Record<string, unknown>,
    }))
}

/** A template's send-relevant fields (subject + body), or null when not found. */
export type EmailCohortTemplate = {
  id: number
  subject: string | null
  body: string
  channel: string
}

/**
 * Load one crm_templates row by id for a bulk send. Fails SOFT (null) on an
 * unreadable row; the enqueue action validates the template exists up front, so a
 * null here at run time means the template was deleted mid-job.
 */
export async function getCrmTemplateForSend(templateId: number): Promise<EmailCohortTemplate | null> {
  if (!Number.isInteger(templateId) || templateId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_templates')
    .select('id,subject,body,channel')
    .eq('id', templateId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getCrmTemplateForSend]', error.message)
    return null
  }
  return {
    id: Number(data.id),
    subject: (data.subject as string | null) ?? null,
    body: (data.body as string) ?? '',
    channel: (data.channel as string) ?? 'email',
  }
}
