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
import type { ProspectKind } from './types'

export type QueuedDripItem = {
  kind: ProspectKind
  id: string
  queuedAt: string
  streetAddress: string | null
  city: string | null
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

/** Oldest queued first-touch across Expired + FSBO (FIFO). */
export async function peekOldestQueuedFirstTouch(): Promise<QueuedDripItem | null> {
  const sb = createServiceClient()
  const selectExpired =
    'listing_key, outreach_email_queued_at, street_address, city, expired_at, status_change_timestamp'
  const selectFsbo = 'fsbo_url, outreach_email_queued_at, street_address, city, detected_at'

  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select(selectExpired)
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_queued_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb
      .from('fsbo_listings')
      .select(selectFsbo)
      .eq('outreach_email_status', 'queued')
      .not('outreach_email_queued_at', 'is', null)
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
      expiredAt: (row.detected_at as string | null) ?? null,
    })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  return candidates[0]
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
