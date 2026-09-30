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
 * Rows lost that way before the fix shipped (2026-06-20) never came back: on
 * 2026-09-30, 7 of 260 sampled Active/Pending rows still missed a Spark status
 * change dated 2026-03-20..05-27 (lib/sync/closingsReconcile.ts
 * reconcileListingStatus repairs them).
 *
 * Spark delta is fetched `_orderby=+ModificationTimestamp` (ASCENDING) with a
 * strict `ModificationTimestamp Gt <cursor>` filter. Two refinements
 * (2026-09-30), both cheap because every upsert is idempotent:
 *   - A clean drain re-reads the last DELTA_CURSOR_OVERLAP_MS before the run
 *     started. The cursor is our clock, the stamps are Spark's: a change Spark
 *     stamps just before our run starts but serves only after our fetch (a
 *     replica or a commit landing late) would otherwise sit behind the cursor
 *     forever. A 15-minute tick re-reads about five records (p50 window size
 *     over 48h measured 2026-09-30).
 *   - A truncated run resumes one second before its newest row, not at it:
 *     `Gt newest` skips the rest of a tie group the page boundary split (29
 *     listings shared one stamp in the 2026-09-30 sample, the 06:30Z expiry
 *     batch).
 * The cursor never moves behind the one the run read from, and a truncated run
 * always moves it forward.
 */
export interface DeltaCursorInput {
  /** any chunk failed to persist this run */
  upsertFailed: boolean
  /** hit the MAX_PAGES cap with more pages still available */
  truncated: boolean
  /** ISO captured BEFORE fetching, so rows modified mid-run are re-picked next tick */
  runStartedAt: string
  /** newest ModificationTimestamp actually processed this run, or null if none */
  maxProcessedTs: string | null
  /** the cursor this run read from (its `since`); null on a first run */
  previousCursor?: string | null
  /** clean-drain re-read window; defaults to DELTA_CURSOR_OVERLAP_MS */
  overlapMs?: number
}

/** How far behind its own start a clean run leaves the cursor. */
export const DELTA_CURSOR_OVERLAP_MS = 5 * 60 * 1000

/** Step back from the newest row of a truncated run, so a split tie group is re-read. */
const TIE_STEP_BACK_MS = 1000

/**
 * Returns the ISO timestamp to write to the cursor, or `null` to leave the
 * cursor UNCHANGED (retry the same window next tick — upserts are idempotent).
 */
export function computeNextDeltaCursor(i: DeltaCursorInput): string | null {
  // A persist failure means some rows in this window did not land. Do not move
  // the cursor at all — re-fetch the whole window next tick.
  if (i.upsertFailed) return null
  const previous = i.previousCursor ? Date.parse(i.previousCursor) : Number.NaN
  const pastPrevious = (t: number) => Number.isFinite(t) && (!Number.isFinite(previous) || t > previous)

  if (i.truncated) {
    // Overflow: resume at the newest row we actually processed (less a second
    // for its tie group), so the remaining pages are picked up next tick
    // instead of being skipped forever.
    if (!i.maxProcessedTs) return null
    const newest = Date.parse(i.maxProcessedTs)
    if (pastPrevious(newest - TIE_STEP_BACK_MS)) return new Date(newest - TIE_STEP_BACK_MS).toISOString()
    // One second held more rows than a run reads: move to the newest row itself.
    return pastPrevious(newest) ? new Date(newest).toISOString() : null
  }

  // Clean full drain: advance to the run start, less the overlap.
  const target = Date.parse(i.runStartedAt) - (i.overlapMs ?? DELTA_CURSOR_OVERLAP_MS)
  return pastPrevious(target) ? new Date(target).toISOString() : null
}
