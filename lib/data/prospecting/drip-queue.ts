/**
 * Approve → queue for the prospecting first-touch email drip.
 *
 * On CMA approve (prospecting path only), stamp outreach_email_queued_at and
 * status='queued'. The cron drain picks the oldest queued Expired OR FSBO row,
 * hard-skips on live relist, then sends via the existing email-intro path.
 *
 * Does not approve CMAs. Does not send owner email except through the drip
 * drain that calls the existing sendProspectingEmailIntro core.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { dripBusyCutoff } from './drip-schedule'
import type { ProspectKind } from './types'

export type QueuedDripItem = {
  kind: ProspectKind
  id: string
  queuedAt: string
  streetAddress: string | null
  city: string | null
  /** The ZIP, for the MLS relist check's city-blind match. */
  postalCode: string | null
  expiredAt: string | null
}

/** Stamp a prospect into the first-touch drip queue (idempotent if already queued/sent). */
export async function enqueueProspectFirstTouchEmail(
  kind: ProspectKind,
  id: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'

  const { data, error } = await sb
    .from(table)
    .select('outreach_email_sent_at, outreach_email_status, outreach_email_message_id, outreach_email_queued_at')
    .eq(keyCol, id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Prospect not found.' }

  const sentAt = data.outreach_email_sent_at as string | null
  const messageId = data.outreach_email_message_id as string | null
  const status = data.outreach_email_status as string | null
  const queuedAt = data.outreach_email_queued_at as string | null

  if (sentAt || messageId || status === 'sent') {
    return { ok: true, already: true }
  }
  if (status === 'queued' && queuedAt) {
    return { ok: true, already: true }
  }
  if (status === 'sending') {
    return { ok: true, already: true }
  }

  const { error: upErr } = await sb
    .from(table)
    .update({
      outreach_email_status: 'queued',
      outreach_email_queued_at: new Date().toISOString(),
    })
    .eq(keyCol, id)
    .is('outreach_email_sent_at', null)
  if (upErr) {
    // Pre-migration: column absent — approve still succeeded; drip waits on migrate.
    if (upErr.code === '42703' || /outreach_email_queued_at/i.test(upErr.message)) {
      return { ok: false, error: `drip queue not provisioned yet (${upErr.message})` }
    }
    return { ok: false, error: upErr.message }
  }
  return { ok: true, already: false }
}

/**
 * Resolve a prospecting row linked to this CMA (by cma_id, then slug match on
 * the built doc). Used by approveProspectDoc → queue. Returns null when the
 * approved slug is not a prospecting CMA.
 */
export async function findProspectForCmaSlug(
  slug: string,
): Promise<{ kind: ProspectKind; id: string } | null> {
  const sb = createServiceClient()
  const { data: cma, error } = await sb.from('cmas').select('id, slug').eq('slug', slug).maybeSingle()
  if (error || !cma) return null
  const cmaId = String(cma.id)

  const { data: expired } = await sb
    .from('expired_listings')
    .select('listing_key')
    .eq('cma_id', cmaId)
    .limit(1)
    .maybeSingle()
  if (expired?.listing_key) return { kind: 'expired', id: String(expired.listing_key) }

  const { data: fsbo } = await sb
    .from('fsbo_listings')
    .select('fsbo_url')
    .eq('cma_id', cmaId)
    .limit(1)
    .maybeSingle()
  if (fsbo?.fsbo_url) return { kind: 'fsbo', id: String(fsbo.fsbo_url) }

  return null
}

/**
 * Oldest queued first-touch across Expired + FSBO (FIFO) whose queue stamp has
 * come due. A row set aside after a relist check that could not answer for its
 * address carries a stamp in the future (setAsideQueuedFirstTouch) and waits.
 */
export async function peekOldestQueuedFirstTouch(now: Date = new Date()): Promise<QueuedDripItem | null> {
  const sb = createServiceClient()
  const due = now.toISOString()
  const selectExpired =
    'listing_key, outreach_email_queued_at, street_address, city, postal_code, expired_at, status_change_timestamp'
  const selectFsbo = 'fsbo_url, outreach_email_queued_at, street_address, city, postal_code, detected_at'

  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select(selectExpired)
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
      .lte('outreach_email_queued_at', due)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_queued_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb
      .from('fsbo_listings')
      .select(selectFsbo)
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
      .lte('outreach_email_queued_at', due)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_queued_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (expRes.error) throw new Error(`peek expired queue failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`peek fsbo queue failed: ${fsboRes.error.message}`)

  const candidates: QueuedDripItem[] = []
  if (expRes.data?.outreach_email_queued_at) {
    const row = expRes.data
    candidates.push({
      kind: 'expired',
      id: String(row.listing_key),
      queuedAt: String(row.outreach_email_queued_at),
      streetAddress: (row.street_address as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      postalCode: (row.postal_code as string | null) ?? null,
      expiredAt:
        ((row.expired_at as string | null) ?? null) ||
        ((row.status_change_timestamp as string | null) ?? null),
    })
  }
  if (fsboRes.data?.outreach_email_queued_at) {
    const row = fsboRes.data
    candidates.push({
      kind: 'fsbo',
      id: String(row.fsbo_url),
      queuedAt: String(row.outreach_email_queued_at),
      streetAddress: (row.street_address as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      postalCode: (row.postal_code as string | null) ?? null,
      expiredAt: (row.detected_at as string | null) ?? null,
    })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  return candidates[0]
}

/** A first-touch email claim that may still belong to a running function. */
export type InFlightFirstTouch = {
  kind: ProspectKind
  id: string
  claimAt: string
}

/**
 * The busy guard's read (one drain at a time). The freshest email claim across
 * Expired + FSBO still inside the busy window (DRIP_BUSY_WINDOW_MS), or null.
 *
 * The cron ticks every minute and a CMA send runs longer than that, so without
 * this a second drain starts while the first is mid-send. Any claimer counts:
 * a manual send from the prospect page holds the drip too, which keeps sends
 * one at a time. Throws on a read error so the drain fails closed and sends
 * nothing.
 */
export async function findInFlightFirstTouchSend(now: Date): Promise<InFlightFirstTouch | null> {
  const sb = createServiceClient()
  const cutoff = dripBusyCutoff(now).toISOString()
  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select('listing_key, outreach_email_claim_at')
      .eq('outreach_email_status', 'sending')
      .gt('outreach_email_claim_at', cutoff)
      .order('outreach_email_claim_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('fsbo_listings')
      .select('fsbo_url, outreach_email_claim_at')
      .eq('outreach_email_status', 'sending')
      .gt('outreach_email_claim_at', cutoff)
      .order('outreach_email_claim_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (expRes.error) throw new Error(`in-flight read (expired) failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`in-flight read (fsbo) failed: ${fsboRes.error.message}`)

  const hits: InFlightFirstTouch[] = []
  if (expRes.data?.outreach_email_claim_at) {
    hits.push({
      kind: 'expired',
      id: String(expRes.data.listing_key),
      claimAt: String(expRes.data.outreach_email_claim_at),
    })
  }
  if (fsboRes.data?.outreach_email_claim_at) {
    hits.push({
      kind: 'fsbo',
      id: String(fsboRes.data.fsbo_url),
      claimAt: String(fsboRes.data.outreach_email_claim_at),
    })
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => Date.parse(b.claimAt) - Date.parse(a.claimAt))
  return hits[0]
}

/** PostgREST / Postgres saying a column is not there (a migration not applied yet). */
function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || /outreach_email_verify_attempts/i.test(error.message ?? '')
}

/**
 * Set a queued row aside after its relist check could not answer for THIS
 * address (a 'row' failure: no key and no street number, more listings at the
 * number than a page, a listing our key may not read, a shared address with no
 * unit). Counts the attempt and moves the queue stamp to `retryAt`, so the rows
 * behind it drain now and this one comes back then. Only a row still queued
 * moves.
 *
 * The count lives in outreach_email_verify_attempts (migration
 * 20260930140000). Before that migration is applied the row is still set
 * aside, uncounted (`attempts: null`), so the drain never hard-skips on a count
 * it could not keep. Throws on any other read or write error: the drain then
 * fails closed and sends nothing.
 */
export async function setAsideQueuedFirstTouch(
  kind: ProspectKind,
  id: string,
  retryAt: Date,
): Promise<{ attempts: number | null }> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { data, error } = await sb.from(table).select('outreach_email_verify_attempts').eq(keyCol, id).maybeSingle()
  if (error && !isMissingColumn(error)) throw new Error(`set aside read (${kind}) failed: ${error.message}`)
  const attempts = error ? null : Number((data as { outreach_email_verify_attempts?: number | null } | null)?.outreach_email_verify_attempts ?? 0) + 1
  const patch: Record<string, unknown> = { outreach_email_queued_at: retryAt.toISOString() }
  if (attempts != null) patch.outreach_email_verify_attempts = attempts
  const { error: upErr } = await sb.from(table).update(patch).eq(keyCol, id).eq('outreach_email_status', 'queued')
  if (upErr) throw new Error(`set aside write (${kind}) failed: ${upErr.message}`)
  return { attempts }
}

/** Start the count again after a row leaves the queue on it (a broker may queue it again). Best effort. */
export async function clearQueuedFirstTouchVerifyAttempts(kind: ProspectKind, id: string): Promise<void> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { error } = await sb.from(table).update({ outreach_email_verify_attempts: 0 }).eq(keyCol, id)
  if (error && !isMissingColumn(error)) {
    console.error('[prospecting] clearQueuedFirstTouchVerifyAttempts failed:', error.message, { kind, id })
  }
}

/** Dequeue after a fail-closed live-status hard-skip (relisted / verify failed). */
export async function hardSkipQueuedFirstTouch(
  kind: ProspectKind,
  id: string,
  reason: string,
): Promise<void> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { error } = await sb
    .from(table)
    .update({
      outreach_email_status: null,
      outreach_email_queued_at: null,
      // leave claim columns alone — never sent
    })
    .eq(keyCol, id)
    .eq('outreach_email_status', 'queued')
  if (error) {
    console.error('[prospecting] hardSkipQueuedFirstTouch failed:', error.message, { kind, id, reason })
  } else {
    console.warn('[prospecting] drip hard-skip (live status):', { kind, id, reason })
  }
}

/**
 * Most recent drip send timestamp (rows that were queued then finalized).
 * Used for spacing — manual intros without queued_at do not throttle the drip.
 */
export async function getLastDripSentAt(): Promise<Date | null> {
  const sb = createServiceClient()
  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select('outreach_email_sent_at')
      .not('outreach_email_queued_at', 'is', null)
      .not('outreach_email_sent_at', 'is', null)
      .order('outreach_email_sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('fsbo_listings')
      .select('outreach_email_sent_at')
      .not('outreach_email_queued_at', 'is', null)
      .not('outreach_email_sent_at', 'is', null)
      .order('outreach_email_sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (expRes.error) throw new Error(`last drip sent (expired) failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`last drip sent (fsbo) failed: ${fsboRes.error.message}`)

  const stamps = [
    expRes.data?.outreach_email_sent_at as string | null | undefined,
    fsboRes.data?.outreach_email_sent_at as string | null | undefined,
  ]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s).getTime())
    .filter((n) => Number.isFinite(n))
  if (stamps.length === 0) return null
  return new Date(Math.max(...stamps))
}

/**
 * Everything currently sitting in the first-touch drip queue (FIFO order).
 *
 * `peekOldestQueuedFirstTouch` answers "what drains next"; this answers "what
 * is waiting, and how long is the runway" — the queue-depth read the admin
 * worklist needs so a staged batch is never invisible.
 */
export async function listQueuedFirstTouch(limit = 500): Promise<QueuedDripItem[]> {
  const sb = createServiceClient()
  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select('listing_key, outreach_email_queued_at, street_address, city, postal_code, expired_at, status_change_timestamp')
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_queued_at', { ascending: true })
      .limit(limit),
    sb
      .from('fsbo_listings')
      .select('fsbo_url, outreach_email_queued_at, street_address, city, postal_code, detected_at')
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_queued_at', { ascending: true })
      .limit(limit),
  ])
  if (expRes.error) throw new Error(`list expired queue failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`list fsbo queue failed: ${fsboRes.error.message}`)

  const items: QueuedDripItem[] = []
  for (const row of expRes.data ?? []) {
    if (!row.outreach_email_queued_at) continue
    items.push({
      kind: 'expired',
      id: String(row.listing_key),
      queuedAt: String(row.outreach_email_queued_at),
      streetAddress: (row.street_address as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      postalCode: (row.postal_code as string | null) ?? null,
      expiredAt:
        ((row.expired_at as string | null) ?? null) ||
        ((row.status_change_timestamp as string | null) ?? null),
    })
  }
  for (const row of fsboRes.data ?? []) {
    if (!row.outreach_email_queued_at) continue
    items.push({
      kind: 'fsbo',
      id: String(row.fsbo_url),
      queuedAt: String(row.outreach_email_queued_at),
      streetAddress: (row.street_address as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      postalCode: (row.postal_code as string | null) ?? null,
      expiredAt: (row.detected_at as string | null) ?? null,
    })
  }
  items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  return items.slice(0, limit)
}


/**
 * Hold = defer to the back of the FIFO queue (bump queued_at to now).
 * No new column — later drain order is enough for "not yet".
 */
export async function holdQueuedFirstTouch(
  kind: ProspectKind,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { error } = await sb
    .from(table)
    .update({ outreach_email_queued_at: new Date().toISOString() })
    .eq(keyCol, id)
    .eq('outreach_email_status', 'queued')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Remove from drip = clear queue stamp (same write as hard-skip, broker-initiated). */
export async function removeQueuedFirstTouch(
  kind: ProspectKind,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { error } = await sb
    .from(table)
    .update({
      outreach_email_status: null,
      outreach_email_queued_at: null,
    })
    .eq(keyCol, id)
    .eq('outreach_email_status', 'queued')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
