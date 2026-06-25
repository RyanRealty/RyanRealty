/**
 * getContactEmailEngagement — the per-contact email-engagement summary the CRM
 * record card renders (Wave 5, the unified email_events store).
 *
 * Reads ONLY from email_events (the single source both the Resend webhook rail
 * and the Gmail open/click tracker rail now write to). Every number returned
 * traces to a real email_events row for this person — no placeholder, no
 * zero-under-false-copy (CLAUDE.md §0).
 *
 * DAL boundary (G1): the raw .from('email_events') read lives here, inside
 * lib/data/. The UI/component calls this; it never queries the table directly.
 *
 * OVERLAP NOTE FOR THE INTEGRATOR: the sibling email-reporting piece is expected
 * to export a getContactEmailEngagement of its own. If that lands, dedupe to one
 * implementation (keep the richer one, point the record card at it). This file
 * is the minimal record-card reader so the card is not blocked on that piece.
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { EmailEvent } from '@/lib/crm/email-events'

export type ContactEmailEngagement = {
  /** Distinct emails this contact was sent (counts 'sent' rows). */
  sent: number
  /** Total opens recorded (one row per email per person, idempotent). */
  opens: number
  /** Total clicks recorded. */
  clicks: number
  /** Bounce / complaint / unsubscribe — deliverability flags worth surfacing. */
  bounces: number
  complaints: number
  unsubscribes: number
  /** ISO timestamp of the most recent open, or null. */
  lastOpenAt: string | null
  /** ISO timestamp of the most recent click, or null. */
  lastClickAt: string | null
  /** Whether any engagement row exists at all (drives the empty state). */
  hasAny: boolean
}

const EMPTY: ContactEmailEngagement = {
  sent: 0,
  opens: 0,
  clicks: 0,
  bounces: 0,
  complaints: 0,
  unsubscribes: 0,
  lastOpenAt: null,
  lastClickAt: null,
  hasAny: false,
}

type EngagementRow = { event: string; occurred_at: string | null }

/**
 * Fold the raw event rows into the typed summary. Pure — exported for the unit
 * test so the aggregation is verified without touching the DB.
 */
export function summarizeEmailEngagement(rows: EngagementRow[]): ContactEmailEngagement {
  if (!rows || rows.length === 0) return EMPTY
  const out: ContactEmailEngagement = { ...EMPTY, hasAny: true }
  for (const r of rows) {
    const ev = r.event as EmailEvent
    const ts = r.occurred_at ?? null
    switch (ev) {
      case 'sent':
        out.sent++
        break
      case 'open':
        out.opens++
        if (ts && (!out.lastOpenAt || ts > out.lastOpenAt)) out.lastOpenAt = ts
        break
      case 'click':
        out.clicks++
        if (ts && (!out.lastClickAt || ts > out.lastClickAt)) out.lastClickAt = ts
        break
      case 'bounce':
        out.bounces++
        break
      case 'complaint':
        out.complaints++
        break
      case 'unsubscribe':
        out.unsubscribes++
        break
      default:
        break
    }
  }
  return out
}

/**
 * The contact's email engagement, read live from email_events. Returns the empty
 * summary (all zeros, hasAny=false) when the contact has no recorded email
 * events — never a fabricated metric.
 */
export async function getContactEmailEngagement(
  personId: number,
): Promise<ContactEmailEngagement> {
  if (!Number.isFinite(personId) || personId <= 0) return EMPTY
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('event,occurred_at')
    .eq('person_id', personId)
  if (error || !data) return EMPTY
  return summarizeEmailEngagement(data as EngagementRow[])
}
