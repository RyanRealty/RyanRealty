/**
 * Stuck first-touch email sends: the reads and the two fenced writes the drip
 * uses to settle a claim whose function died mid-send.
 *
 * A claim is 'sending' + outreach_email_claim_at. When the function holding it
 * dies before stamping a message id (2026-09-29 22:54 UTC: a 60 s timeout), the
 * row sits in 'sending' for good: the drain only picks 'queued' rows and the
 * hard-skip only clears 'queued' rows. lib/data/prospecting/drip-recover.ts
 * decides whether that email left; these functions carry out the decision.
 *
 * FENCED WRITES. Both writes repeat the stuck state in their WHERE clause:
 * still 'sending', the SAME claim_at the recovery examined, still no message id
 * and no sent_at. The recovery spends seconds on Gmail between reading the row
 * and writing it, and in that time a manual send can re-claim the row (the claim
 * RPC reopens a 'sending' row after two minutes) or another drain can settle it.
 * An unfenced write would then release a claim that a live send owns, and the
 * next drain would send the same owner a second email. A write that matches no
 * row returns false: someone else moved the row, and the recovery leaves it.
 */

import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { dripStaleCutoff } from './drip-schedule'
import type { ProspectKind } from './types'

/**
 * Stale claims read per table per run. The recovery examines only a few of them
 * each run (MAX_STUCK_SENDS_PER_RUN in drip-recover.ts, rotating), so this only
 * has to be large enough that every stuck row is in the rotation.
 */
export const STUCK_SEND_CANDIDATE_LIMIT = 50

export type StaleFirstTouchSend = {
  kind: ProspectKind
  id: string
  /** outreach_email_claim_at exactly as Postgres returned it: the fence both writes compare against. */
  claimAt: string
  /** outreach_email_queued_at as returned: a drip member goes back to 'queued' on release. */
  queuedAt: string | null
  contactEmail: string | null
  streetAddress: string | null
}

function tableFor(kind: ProspectKind): { table: 'expired_listings' | 'fsbo_listings'; keyCol: 'listing_key' | 'fsbo_url' } {
  return kind === 'expired'
    ? { table: 'expired_listings', keyCol: 'listing_key' }
    : { table: 'fsbo_listings', keyCol: 'fsbo_url' }
}

/**
 * Claims older than the stale threshold (DRIP_STUCK_SEND_STALE_MS) that never
 * stamped a message id or a sent time, oldest first, across Expired + FSBO.
 * A row that carries a message id already fired its email: the claim RPC treats
 * it as sent, so it is not a stuck send. Throws on a read error.
 */
export async function listStaleFirstTouchSends(
  now: Date,
  limit: number = STUCK_SEND_CANDIDATE_LIMIT,
): Promise<StaleFirstTouchSend[]> {
  const sb = createServiceClient()
  const cutoff = dripStaleCutoff(now).toISOString()
  const [expRes, fsboRes] = await Promise.all([
    sb
      .from('expired_listings')
      .select('listing_key, outreach_email_claim_at, outreach_email_queued_at, contact_email, street_address')
      .eq('outreach_email_status', 'sending')
      .lt('outreach_email_claim_at', cutoff)
      .is('outreach_email_message_id', null)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_claim_at', { ascending: true })
      .limit(limit),
    sb
      .from('fsbo_listings')
      .select('fsbo_url, outreach_email_claim_at, outreach_email_queued_at, contact_email, street_address')
      .eq('outreach_email_status', 'sending')
      .lt('outreach_email_claim_at', cutoff)
      .is('outreach_email_message_id', null)
      .is('outreach_email_sent_at', null)
      .order('outreach_email_claim_at', { ascending: true })
      .limit(limit),
  ])
  if (expRes.error) throw new Error(`stuck sends read (expired) failed: ${expRes.error.message}`)
  if (fsboRes.error) throw new Error(`stuck sends read (fsbo) failed: ${fsboRes.error.message}`)

  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
  const rows: StaleFirstTouchSend[] = []
  for (const r of expRes.data ?? []) {
    const claimAt = str(r.outreach_email_claim_at)
    if (!claimAt) continue
    rows.push({
      kind: 'expired',
      id: String(r.listing_key),
      claimAt,
      queuedAt: str(r.outreach_email_queued_at),
      contactEmail: str(r.contact_email),
      streetAddress: str(r.street_address),
    })
  }
  for (const r of fsboRes.data ?? []) {
    const claimAt = str(r.outreach_email_claim_at)
    if (!claimAt) continue
    rows.push({
      kind: 'fsbo',
      id: String(r.fsbo_url),
      claimAt,
      queuedAt: str(r.outreach_email_queued_at),
      contactEmail: str(r.contact_email),
      streetAddress: str(r.street_address),
    })
  }
  rows.sort((a, b) => Date.parse(a.claimAt) - Date.parse(b.claimAt))
  return rows.slice(0, limit)
}

/** One email_events row that could be the trace of a stuck send. */
export type StuckSendEmailEvent = {
  id: number
  event: string
  emailKey: string | null
  messageId: string | null
  recipientEmail: string
  personId: number | null
  occurredAt: string
}

/** Rows read per query. A cold owner does not collect hundreds of events in minutes. */
const EVENT_READ_LIMIT = 200

/**
 * Every email_events row at or after `sinceIso` that could belong to the stuck
 * send: rows to any of `recipients`, and rows whose email_key starts with
 * `cma:<cmaBaseSlug>` (the rail keys a CMA send `cma:<slug>`, and a later
 * version of the document is `<base>--vN`). The prefix read is a prefilter; the
 * caller matches keys exactly. Throws on a read error, because a recovery that
 * cannot read this cannot prove anything.
 */
export async function listEmailEventsSince(args: {
  recipients: string[]
  cmaBaseSlug: string | null
  sinceIso: string
}): Promise<StuckSendEmailEvent[]> {
  const sb = createServiceClient()
  const recipients = [...new Set(args.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))]
  const [byRecipient, byKey] = await Promise.all([
    recipients.length > 0
      ? sb
          .from('email_events')
          .select('id, event, email_key, message_id, recipient_email, person_id, occurred_at')
          .in('recipient_email', recipients)
          .gte('occurred_at', args.sinceIso)
          .order('occurred_at', { ascending: true })
          .limit(EVENT_READ_LIMIT)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    args.cmaBaseSlug
      ? sb
          .from('email_events')
          .select('id, event, email_key, message_id, recipient_email, person_id, occurred_at')
          .like('email_key', `cma:${args.cmaBaseSlug}%`)
          .gte('occurred_at', args.sinceIso)
          .order('occurred_at', { ascending: true })
          .limit(EVENT_READ_LIMIT)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ])
  if (byRecipient.error) throw new Error(`email_events read (recipient) failed: ${byRecipient.error.message}`)
  if (byKey.error) throw new Error(`email_events read (cma key) failed: ${byKey.error.message}`)

  const seen = new Set<number>()
  const out: StuckSendEmailEvent[] = []
  for (const r of [...(byRecipient.data ?? []), ...(byKey.data ?? [])] as Record<string, unknown>[]) {
    const id = Number(r.id)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      event: String(r.event ?? ''),
      emailKey: typeof r.email_key === 'string' ? r.email_key : null,
      messageId: typeof r.message_id === 'string' ? r.message_id : null,
      recipientEmail: String(r.recipient_email ?? '').trim().toLowerCase(),
      personId: r.person_id == null ? null : Number(r.person_id),
      occurredAt: String(r.occurred_at ?? ''),
    })
  }
  out.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  return out
}

/**
 * The email left: mark the claim sent with the message id that proves it and
 * the time it actually went (not the recovery's time, so the drip's spacing and
 * the "emailed" stamp brokers read stay true). Fenced; see the file header.
 * Returns false when the row moved under the recovery.
 */
export async function finalizeRecoveredFirstTouchSend(args: {
  kind: ProspectKind
  id: string
  claimAt: string
  messageId: string | null
  sentAt: string
  personId: number | null
}): Promise<boolean> {
  const sb = createServiceClient()
  const { table, keyCol } = tableFor(args.kind)
  const patch: Record<string, unknown> = {
    outreach_email_status: 'sent',
    outreach_email_sent_at: args.sentAt,
    outreach_email_message_id: args.messageId,
  }
  if (args.personId != null && Number.isFinite(args.personId) && args.personId > 0) {
    patch.outreach_crm_person_id = args.personId
  }
  const { data, error } = await sb
    .from(table)
    .update(patch)
    .eq(keyCol, args.id)
    .eq('outreach_email_status', 'sending')
    .eq('outreach_email_claim_at', args.claimAt)
    .is('outreach_email_message_id', null)
    .is('outreach_email_sent_at', null)
    .select(keyCol)
  if (error) throw new Error(`finalize recovered send failed: ${error.message}`)
  return (data ?? []).length > 0
}

/**
 * The email provably did not leave: undo the claim so the row is sendable
 * again. The same state change as prospect_email_send_release (back to 'queued'
 * when the row is a drip member, else null; claim_at cleared; never a row with a
 * sent time or a message id), plus the fence, which that RPC cannot take.
 * Returns false when the row moved under the recovery.
 */
export async function releaseStuckFirstTouchSend(args: {
  kind: ProspectKind
  id: string
  claimAt: string
  queuedAt: string | null
}): Promise<boolean> {
  const sb = createServiceClient()
  const { table, keyCol } = tableFor(args.kind)
  let q = sb
    .from(table)
    .update({
      outreach_email_status: args.queuedAt ? 'queued' : null,
      outreach_email_claim_at: null,
    })
    .eq(keyCol, args.id)
    .eq('outreach_email_status', 'sending')
    .eq('outreach_email_claim_at', args.claimAt)
    .is('outreach_email_message_id', null)
    .is('outreach_email_sent_at', null)
  q = args.queuedAt ? q.eq('outreach_email_queued_at', args.queuedAt) : q.is('outreach_email_queued_at', null)
  const { data, error } = await q.select(keyCol)
  if (error) throw new Error(`release stuck send failed: ${error.message}`)
  return (data ?? []).length > 0
}
