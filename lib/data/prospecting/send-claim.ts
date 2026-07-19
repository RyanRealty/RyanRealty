/**
 * Prospecting send-claim writes (spec 07 §4.5) — the at-most-once trio.
 *
 * Thin wrappers over the row-locked Postgres RPCs
 * (20260718120400_prospect_send_claim_rpcs.sql). Imported directly by
 * app/actions/prospecting.ts (not re-exported through the read barrel — these are
 * the only mutating members of the prospecting DAL).
 *
 * Order in the send action: claim → Twilio → finalize; on Twilio failure, release.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { ProspectKind } from './types'

export type ClaimStatus =
  | 'not_found'
  | 'replay' // this exact idempotency key already completed — return the original success, no second text
  | 'already_sent' // a different send already completed — block (one-intro-ever)
  | 'claimed_elsewhere' // another tab/device is mid-send inside the 2-min window — abort before Twilio
  | 'claimed' // caller owns the send — proceed to Twilio, then finalize

/** Attempt to claim the send. See ClaimStatus for the outcomes. Throws on DB error (fail-closed: the action aborts). */
export async function claimProspectSend(
  kind: ProspectKind,
  id: string,
  idempotencyKey: string,
): Promise<ClaimStatus> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('prospect_send_claim', {
    p_kind: kind,
    p_id: id,
    p_idem: idempotencyKey,
  })
  if (error) throw new Error(`prospect_send_claim failed: ${error.message}`)
  return (data as ClaimStatus | null) ?? 'not_found'
}

/** Finalize a successful send: stamp status='sent', sent_at, sid, idempotency key, person id. */
export async function finalizeProspectSend(
  kind: ProspectKind,
  id: string,
  args: { idempotencyKey: string; sid: string | null; personId: number | null },
): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb.rpc('prospect_send_finalize', {
    p_kind: kind,
    p_id: id,
    p_idem: args.idempotencyKey,
    p_sid: args.sid,
    p_person_id: args.personId,
  })
  if (error) throw new Error(`prospect_send_finalize failed: ${error.message}`)
}

/**
 * Stamp the Twilio message sid the INSTANT the send returns, before finalize.
 * Closes the finalize-failure double-text hole (adversarial audit 2026-07-18):
 * if finalize then fails, the row still carries a sid, and prospect_send_claim
 * treats a sid-bearing row as already-sent — so a retry never re-texts the owner.
 * Best-effort: a stamp failure is logged but never throws (finalize is the durable
 * record; the claim's own sid guard is the safety net either way).
 */
export async function stampProspectSid(kind: ProspectKind, id: string, sid: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb.rpc('prospect_send_stamp_sid', { p_kind: kind, p_id: id, p_sid: sid })
  if (error) console.warn('[prospecting] prospect_send_stamp_sid failed:', error.message)
}

/** Release an in-flight claim after a Twilio failure so the row is sendable again. Never clears a finalized send. */
export async function releaseProspectSend(kind: ProspectKind, id: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb.rpc('prospect_send_release', { p_kind: kind, p_id: id })
  if (error) console.warn('[prospecting] prospect_send_release failed:', error.message)
}

/**
 * Link a prospect row to its built document by id (spec §4.2). Called by the
 * detection processors and the manual build action so the write lives in the DAL
 * (the DAL-boundary rule bans raw `.from()` outside lib/data). Best-effort: a
 * stamp failure never fails the caller (the surface falls back to slug resolve).
 */
export async function linkProspectCma(kind: ProspectKind, id: string, cmaId: string): Promise<void> {
  const sb = createServiceClient()
  const table = kind === 'expired' ? 'expired_listings' : 'fsbo_listings'
  const keyCol = kind === 'expired' ? 'listing_key' : 'fsbo_url'
  const { error } = await sb.from(table).update({ cma_id: cmaId }).eq(keyCol, id)
  if (error) console.warn('[prospecting] linkProspectCma failed:', error.message)
}
