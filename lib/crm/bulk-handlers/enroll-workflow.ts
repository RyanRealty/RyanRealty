/**
 * Bulk handler: crm:enroll-workflow — enroll a chunk of contacts in one sequence.
 *
 * Delegates per-id to manualEnrollPerson (lib/crm/enroll.ts 107), which already:
 *   - fail-closes on hard-stop (an unreadable compliance table does NOT enroll)
 *   - refuses an inactive / missing sequence
 *   - never double-enrolls a still-live sequence (running/paused/awaiting)
 *   - writes the enrollment row + a crm_timeline 'system' row
 *
 * So compliance + dedup are handled by the SAME code the single-record path uses —
 * no second enrollment codepath that could skip the hard-stop check. This handler
 * only tallies enrolled vs skipped and rolls the skip reason into the breakdown.
 *
 * enrolled_by is stamped 'bulk' so the audit trail distinguishes a bulk enroll
 * from an auto-rule or a broker hand-pick.
 *
 * Scope is applied at id-resolution (worker); manualEnrollPerson has no broker
 * gate of its own (the broker deliberately chose), matching the single-record UI.
 *
 * Every id is accounted for (enrolled -> processed, otherwise -> skipped) so the
 * worker offset drains the full selection.
 */

import 'server-only'
import { manualEnrollPerson } from '@/lib/crm/enroll'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

/** Map a manualEnrollPerson skip reason to a stable breakdown counter key. */
export function enrollSkipReasonKey(reason: string): string {
  const r = reason.toLowerCase()
  if (r.includes('hard-stop')) return 'skipped_hard_stop'
  if (r.includes('already in')) return 'skipped_already_enrolled'
  if (r.includes('not active')) return 'skipped_sequence_inactive'
  if (r.includes('not found')) return 'skipped_sequence_missing'
  if (r.includes('invalid input')) return 'skipped_invalid'
  return 'skipped_other'
}

export const enrollWorkflowHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const sequenceId = Number(params.sequenceId)
  if (!Number.isFinite(sequenceId) || sequenceId <= 0) {
    result.skipped = ids.length
    bump('invalid_sequence', ids.length)
    return result
  }

  for (const id of ids) {
    let outcome
    try {
      outcome = await manualEnrollPerson(id, sequenceId, 'bulk')
    } catch (e) {
      // A per-person enroll failure is counted, never aborts the chunk.
      result.skipped++
      bump('enroll_error')
      void e
      continue
    }
    if (outcome.enrolled) {
      result.processed++
      bump('enrolled')
    } else {
      result.skipped++
      bump(enrollSkipReasonKey(outcome.reason))
    }
  }

  return result
}
