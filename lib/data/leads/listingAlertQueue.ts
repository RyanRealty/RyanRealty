import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DAL for public.listing_alert_queue — preview-mode holds for listing alerts
 * (migration 20260729235500_listing_alerts_typed_events.sql; Flexmls's
 * "Preview Mode" / "Listings to Approve" model from the search-optimization
 * plan §1.5).
 *
 * When listing_alerts.preview_mode is true, the alert engine
 * (app/actions/saved-search-alerts.ts runListingAlerts) writes one row per
 * (alert, listing, event) here instead of sending. A CRM admin approves or
 * rejects; approval releases the held events through the SAME send path
 * (compliance gates re-run at release time). Service-role only — RLS is
 * enabled with no policies.
 */

const TABLE = 'listing_alert_queue'

export type AlertQueueStatus = 'pending' | 'approved' | 'rejected' | 'sent'

export type ListingAlertQueueRow = {
  id: string
  alert_id: string
  listing_key: string
  event_type: string
  /** { event: ListingEvent, card: ListingAlertListing } — everything needed to
   *  rebuild the email card without re-querying listings. */
  event_payload: Record<string, unknown> | null
  status: AlertQueueStatus
  created_at: string | null
  decided_at: string | null
  decided_by: string | null
}

const ROW_COLS = 'id, alert_id, listing_key, event_type, event_payload, status, created_at, decided_at, decided_by'

export type AlertQueueInsert = {
  alertId: string
  listingKey: string
  eventType: string
  eventPayload: Record<string, unknown>
}

/**
 * Queue held events for one preview-mode alert. Idempotent across engine
 * runs: the partial unique index uq_listing_alert_queue_pending makes a
 * duplicate (alert, listing, event) pending row a no-op instead of a stack.
 */
export async function enqueueAlertQueueItems(
  items: AlertQueueInsert[],
): Promise<{ ok: boolean; queued: number; error?: string }> {
  if (items.length === 0) return { ok: true, queued: 0 }
  const supabase = createServiceClient()
  const rows = items.map((i) => ({
    alert_id: i.alertId,
    listing_key: i.listingKey,
    event_type: i.eventType,
    event_payload: i.eventPayload,
    status: 'pending' as const,
  }))
  // uq_listing_alert_queue_pending is a PARTIAL unique index (WHERE
  // status='pending') so an alert can legitimately re-queue a listing after an
  // earlier item was sent or rejected. Postgres cannot infer a partial arbiter
  // from a bare ON CONFLICT column list, so the upsert form raised 42P10 on
  // EVERY preview-mode write: nothing queued, nothing sent, and the alert
  // jammed at the head of the due queue forever (adversarial audit 2026-07-30).
  // Select-then-insert keeps the partial-index semantics. The cron is the only
  // writer, and a racing duplicate still trips the index, which we treat as the
  // benign "already queued" case.
  const alertIds = [...new Set(rows.map((r) => r.alert_id))]
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select('alert_id, listing_key, event_type')
    .in('alert_id', alertIds)
    .eq('status', 'pending')
  if (readError) {
    console.error('[enqueueAlertQueueItems] pending read', readError.message)
    return { ok: false, queued: 0, error: 'persist_failed' }
  }
  const pending = new Set(
    (existing ?? []).map((r) => `${r.alert_id}|${r.listing_key}|${r.event_type}`),
  )
  const fresh = rows.filter((r) => !pending.has(`${r.alert_id}|${r.listing_key}|${r.event_type}`))
  if (fresh.length === 0) return { ok: true, queued: 0 }

  const { data, error } = await supabase.from(TABLE).insert(fresh).select('id')
  if (error) {
    // 23505 = the partial index caught a concurrent duplicate. Already queued.
    if (error.code === '23505') return { ok: true, queued: 0 }
    console.error('[enqueueAlertQueueItems]', error.message)
    return { ok: false, queued: 0, error: 'persist_failed' }
  }
  return { ok: true, queued: data?.length ?? fresh.length }
}

/** Load queue rows by id, restricted to one status (default pending). */
export async function getAlertQueueItemsByIds(
  ids: string[],
  status: AlertQueueStatus = 'pending',
): Promise<ListingAlertQueueRow[]> {
  const clean = [...new Set(ids.map((s) => (s ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return []
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .in('id', clean)
    .eq('status', status)
  if (error) {
    console.error('[getAlertQueueItemsByIds]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertQueueRow[]
}

/** Every pending queue row, oldest first (the admin "Listings to approve"
 *  surface groups these by alert_id client-side). Capped — the approval UI is
 *  a working queue, not an archive browser. */
export async function listPendingAlertQueue(limit = 500): Promise<ListingAlertQueueRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(Math.min(1000, Math.max(1, limit)))
  if (error) {
    console.error('[listPendingAlertQueue]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertQueueRow[]
}

/** Pending queue rows for one alert (admin hub detail). */
export async function getPendingAlertQueueForAlert(alertId: string): Promise<ListingAlertQueueRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROW_COLS)
    .eq('alert_id', alertId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[getPendingAlertQueueForAlert]', error.message)
    return []
  }
  return (data ?? []) as ListingAlertQueueRow[]
}

/**
 * Stamp a decision on queue rows. Only rows still in `fromStatus` move — a
 * concurrent decision (or a re-click) cannot flip an already-decided row.
 * Returns the ids actually transitioned.
 */
export async function markAlertQueueDecision(
  ids: string[],
  decision: Extract<AlertQueueStatus, 'approved' | 'rejected' | 'sent'>,
  decidedBy: string | null,
  fromStatus: AlertQueueStatus = 'pending',
): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  const clean = [...new Set(ids.map((s) => (s ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return { ok: true, ids: [] }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: decidedBy })
    .in('id', clean)
    .eq('status', fromStatus)
    .select('id')
  if (error) {
    console.error('[markAlertQueueDecision]', error.message)
    return { ok: false, ids: [], error: 'persist_failed' }
  }
  return { ok: true, ids: ((data ?? []) as Array<{ id: string }>).map((r) => r.id) }
}

