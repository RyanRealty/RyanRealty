/**
 * lib/meta/audienceLedger.ts -- PURE summary of a Meta audience sync run
 * (CONTACT360 Phase 5.6). No I/O, no env -- just shapes the cron's add-result +
 * remove-result into a single ledger row body the cron persists (to
 * meta_audience_log if the FLAGGED table exists, else a crm_timeline 'system'
 * row). Pure so the ledger shape is unit-testable independent of the cron.
 */

import type { SyncCrmAudienceResult } from '@/lib/meta/audienceUpload'
import type { RemoveFromCrmAudienceResult } from '@/lib/meta/audienceRemove'

/**
 * Meta's minimum matched-audience size (CONTACT360 Phase 5.2 "<1k-match
 * monitor"). A Custom Audience below this many matched users is created but
 * stays too small to be targetable -- Meta silently won't serve ads against it.
 * The sync watches for this so a shrinking consent-gated population (e.g. after
 * a suppression spike) surfaces in the ledger + logs BEFORE a live push wastes a
 * sync on an unusable audience. This is a MONITOR (it surfaces), not a blocker.
 */
export const META_MIN_AUDIENCE_SIZE = 1000

export type AudienceRunSummary = {
  /** True when BOTH the add and remove paths stayed dry (no Meta mutation). */
  dryRun: boolean
  /**
   * The matchable population this run represents: Meta's accepted count
   * (numReceived) on a live push, else the would-upload count on a dry run.
   */
  matchCount: number
  /** True when matchCount is under Meta's targetable floor (not serveable). */
  belowMinimumMatch: boolean
  /** The add (upload) leg. */
  add: {
    dryRun: boolean
    dryRunReason?: string
    wouldUpload: number
    excludedSuppressed: number
    excludedRealtors: number
    skippedUnhashable: number
    /** Only set on the live path. */
    numReceived?: number
    numInvalid?: number
    audienceId?: string
  }
  /** The remove (drain) leg. */
  remove: {
    dryRun: boolean
    dryRunReason?: string
    requested: number
    wouldRemove: number
    skippedUnhashable: number
    /** Only set on the live path. */
    numRemoved?: number
    audienceId?: string
  }
  /** Flattened non-fatal errors from both legs (empty when none). */
  errors: string[]
  /** A one-line human summary for the ledger / log line. */
  message: string
}

/**
 * Summarize one audience-sync run into a single ledger body. Combines the add
 * and remove results, flattens their errors, and derives the headline message.
 * The run is "dry" only when BOTH legs stayed dry.
 */
export function summarizeAudienceRun(
  add: SyncCrmAudienceResult,
  remove: RemoveFromCrmAudienceResult,
): AudienceRunSummary {
  const errors = [...(add.errors ?? []), ...(remove.errors ?? [])]
  const dryRun = add.dryRun && remove.dryRun

  // <1k-match monitor: gauge the targetable population. Live runs know Meta's
  // accepted count (numReceived); dry runs use would-upload as the proxy (if we
  // can't even SEND 1k records we definitely can't MATCH 1k).
  const matchCount = add.dryRun ? add.wouldUpload : (add.numReceived ?? add.wouldUpload)
  const belowMinimumMatch = matchCount < META_MIN_AUDIENCE_SIZE

  const addPart = add.dryRun
    ? `add: DRY would-upload ${add.wouldUpload} (excluded ${add.excludedSuppressed})`
    : `add: LIVE received ${add.numReceived ?? 0} invalid ${add.numInvalid ?? 0}`
  const removePart = remove.dryRun
    ? `remove: DRY would-remove ${remove.wouldRemove} of ${remove.requested}`
    : `remove: LIVE removed ${remove.numRemoved ?? 0} of ${remove.requested}`
  const errPart = errors.length ? ` | ${errors.length} error(s)` : ''
  const floorPart = belowMinimumMatch
    ? ` | WARNING ${matchCount} < ${META_MIN_AUDIENCE_SIZE} match floor (audience not targetable)`
    : ''
  const message = `Meta audience sync (${dryRun ? 'DRY' : 'LIVE'}) -- ${addPart}; ${removePart}${errPart}${floorPart}`

  return {
    dryRun,
    matchCount,
    belowMinimumMatch,
    add: {
      dryRun: add.dryRun,
      dryRunReason: add.dryRunReason,
      wouldUpload: add.wouldUpload,
      excludedSuppressed: add.excludedSuppressed,
      excludedRealtors: add.excludedRealtors,
      skippedUnhashable: add.skippedUnhashable,
      numReceived: add.numReceived,
      numInvalid: add.numInvalid,
      audienceId: add.audienceId,
    },
    remove: {
      dryRun: remove.dryRun,
      dryRunReason: remove.dryRunReason,
      requested: remove.requested,
      wouldRemove: remove.wouldRemove,
      skippedUnhashable: remove.skippedUnhashable,
      numRemoved: remove.numRemoved,
      audienceId: remove.audienceId,
    },
    errors,
    message,
  }
}
