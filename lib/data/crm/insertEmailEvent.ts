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

/**
 * Delete one email_events row by its unique dedupe_key. Used to ROLL BACK a
 * claim-before-send row when the wire send fails, so a genuine send failure
 * leaves no false `sent` marker and a later worker run can re-attempt the send.
 * Service role; never throws (a failed rollback only blocks a retry, it never
 * double-sends).
 */
export async function deleteEmailEventByDedupeKey(
  dedupeKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('email_events').delete().eq('dedupe_key', dedupeKey)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Stamp the provider's message id onto a claim row after the wire send returns.
 *
 * The cohort claims its `sent` row BEFORE the send (that is what makes a double
 * send impossible), so at insert time there is no Resend id yet. Without this
 * follow-up the id is never written, and every delivered / bounce / complaint
 * webhook — which Resend keys on the message id — lands as a row that cannot be
 * traced back to the campaign it belongs to. The batch report then reads zero
 * deliveries and shows "—" for every rate.
 *
 * Best-effort by contract: a failure here costs reporting fidelity, never the
 * send, and never throws.
 */
export async function stampEmailEventMessageId(
  dedupeKey: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('email_events')
      .update({ message_id: messageId })
      .eq('dedupe_key', dedupeKey)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export type SentEmailEventLookup = {
  email_key: string | null
  send_type: string | null
  person_id: number | null
  broker: string | null
  recipient_email: string | null
  subject: string | null
}

/**
 * The `sent` row for a provider message id, if one exists. Used by
 * recordEmailEvent so a Resend delivered/bounce webhook (which does not know
 * our email_key) still joins to the campaign that claimed the send.
 *
 * Never throws — a lookup miss is null, same as "no sent row yet."
 */
export async function getSentEventByMessageId(
  messageId: string,
): Promise<SentEmailEventLookup | null> {
  const mid = messageId.trim()
  if (!mid) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('email_events')
      .select('email_key,send_type,person_id,broker,recipient_email,subject')
      .eq('message_id', mid)
      .eq('event', 'sent')
      .limit(1)
    if (error) return null
    const row = (data ?? [])[0] as SentEmailEventLookup | undefined
    return row ?? null
  } catch {
    return null
  }
}
