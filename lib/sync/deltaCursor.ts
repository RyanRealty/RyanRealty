/**
 * deltaCursor — decide how far to advance the MLS delta-sync cursor
 * (`sync_state.last_delta_sync_at`) after a run.
 *
 * Audit p0.1 fix. The old code set the cursor to `now()` unconditionally at the
 * end of every run. That silently lost data in two cases:
 *   1. Overflow — a run is capped at MAX_PAGES; if more pages remained, jumping
 *      the cursor to now() skipped every un-fetched change permanently.
 *   2. Failed upserts — chunks that errored were logged and skipped, but the
 *      cursor still advanced, so those rows were never re-fetched.
 *
 * Spark delta is fetched `ModificationTimestamp Ge cursor`, ascending, page by
 * page from the last timestamp read (fetchDeltaWindow), so the newest row we
 * processed is a safe resume point: everything not yet seen has a modification
 * time >= maxProcessedTs, and Ge re-reads the rest of its second.
 *
 * A clean drain resumes DELTA_CURSOR_OVERLAP_MS before the run started. Spark
 * stamps a change to the whole second (2026-10-01: '2026-10-01T19:06:52Z',
 * three listings that second), and the run's start is our clock, not Spark's:
 * a change stamped just before our start time can land after our read of that
 * second, and Gt the start time then skipped it for good.
 */

/**
 * How far before the run's start a clean drain resumes. Basis: changes on
 * 2026-10-01 ran about one a minute (202 in the three hours before 22:07Z), so
 * the overlap re-reads about one listing a run; it covers the whole-second
 * stamp and clock skew between our servers and Spark's with room. Re-reading a
 * listing already applied writes nothing new.
 */
export const DELTA_CURSOR_OVERLAP_MS = 60_000
export interface DeltaCursorInput {
  /** any chunk failed to persist this run */
  upsertFailed: boolean
  /** hit the MAX_PAGES cap with more pages still available */
  truncated: boolean
  /** ISO captured BEFORE fetching, so rows modified mid-run are re-picked next tick */
  runStartedAt: string
  /** newest ModificationTimestamp actually processed this run, or null if none */
  maxProcessedTs: string | null
}

/**
 * Returns the ISO timestamp to write to the cursor, or `null` to leave the
 * cursor UNCHANGED (retry the same window next tick — upserts are idempotent).
 */
export function computeNextDeltaCursor(i: DeltaCursorInput): string | null {
  // A persist failure means some rows in this window did not land. Do not move
  // the cursor at all — re-fetch the whole window next tick.
  if (i.upsertFailed) return null
  // Overflow: advance only to the newest row we actually processed, so the
  // remaining pages are picked up next tick instead of being skipped forever.
  if (i.truncated) return i.maxProcessedTs
  // Clean full drain: resume a little before the run started (see above).
  return new Date(Date.parse(i.runStartedAt) - DELTA_CURSOR_OVERLAP_MS).toISOString()
}
