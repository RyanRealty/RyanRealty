/**
 * insertEmailEvent — the raw email_events write, idempotent at the DB layer.
 *
 * DAL boundary (G1): the only place a raw .from('email_events') write lives is
 * here, inside lib/data/. The orchestration + pure helpers live in
 * lib/crm/email-events.ts and call into this function — so lib/crm never holds a
 * raw Supabase table call (which would trip the DAL-boundary gate).
 *
 * Idempotency: every row carries a UNIQUE dedupe_key. We use upsert with
 * ignoreDuplicates so a redelivered webhook / a double pixel fire collapses to a
 * single row (the ON CONFLICT dedupe_key DO NOTHING path). Service role — the
 * webhook + tracker callers have no user session.
 *
 * NON-BLOCKING by contract: never throws. A reporting-side write must never
 * break a send or a webhook 200; callers get a result flag instead.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type EmailEventInsertRow = {
  message_id: string | null
  recipient_email: string
  person_id: number | null
  broker: string | null
  send_type: string | null
  event: string
  email_key: string | null
  subject: string | null
  occurred_at: string
  meta: Record<string, unknown>
  dedupe_key: string
}

export type InsertEmailEventResult =
  | { ok: true; inserted: boolean }
  | { ok: false; error: string }

/**
 * Idempotent insert of one normalized email_events row. Returns
 * { inserted: true } when a new row landed, { inserted: false } when the
 * dedupe_key already existed (the ON CONFLICT DO NOTHING path). Never throws.
 */
export async function insertEmailEvent(
  row: EmailEventInsertRow,
): Promise<InsertEmailEventResult> {
  try {
    const sb = createServiceClient()
    // upsert with ignoreDuplicates = INSERT ... ON CONFLICT (dedupe_key) DO
    // NOTHING. With { count: 'exact' } we learn whether a row actually landed.
    const { count, error } = await sb
      .from('email_events')
      .upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true, count: 'exact' })
    if (error) return { ok: false, error: error.message }
    return { ok: true, inserted: (count ?? 0) > 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
