/**
 * writeAudienceLedger -- persist one meta-audience-sync run summary
 * (CONTACT360 Phase 5.6).
 *
 * Primary home: meta_audience_log (the FLAGGED ledger table). When that table is
 * not yet applied, the insert fails with a relation-missing error; we detect it
 * and fall back to a console summary line rather than throwing (the run is dry
 * pre-table, so nothing is lost operationally). We do NOT force the summary into
 * crm_timeline 'system': crm_timeline.person_id is NOT NULL (a system-wide run
 * has no single person), so a sentinel-person row there would be a data lie.
 * meta_audience_log is the correct, queryable home.
 *
 * DAL boundary (G1): the raw .from() write lives here, inside lib/data/. Service
 * role. Never throws -- returns a flag the cron reports.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { AudienceRunSummary } from '@/lib/meta/audienceLedger'

export type WriteAudienceLedgerResult =
  | { ok: true; persisted: 'meta_audience_log' | 'console-fallback' }
  | { ok: false; error: string }

export async function writeAudienceLedger(
  summary: AudienceRunSummary,
): Promise<WriteAudienceLedgerResult> {
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('meta_audience_log').insert({
      dry_run: summary.dryRun,
      add_would_upload: summary.add.wouldUpload,
      add_excluded_suppressed: summary.add.excludedSuppressed,
      add_excluded_realtors: summary.add.excludedRealtors,
      add_skipped_unhashable: summary.add.skippedUnhashable,
      add_num_received: summary.add.numReceived ?? null,
      add_num_invalid: summary.add.numInvalid ?? null,
      remove_requested: summary.remove.requested,
      remove_would_remove: summary.remove.wouldRemove,
      remove_skipped_unhashable: summary.remove.skippedUnhashable,
      remove_num_removed: summary.remove.numRemoved ?? null,
      audience_id: summary.add.audienceId ?? summary.remove.audienceId ?? null,
      errors: summary.errors,
      message: summary.message,
    })
    if (error) {
      // 42P01 = undefined_table (meta_audience_log not yet applied) -> fall back
      // to a console summary so the ledger is never lost.
      if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
        console.log(`[meta-audience-log:fallback] ${summary.message}`)
        return { ok: true, persisted: 'console-fallback' }
      }
      return { ok: false, error: error.message }
    }
    return { ok: true, persisted: 'meta_audience_log' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
