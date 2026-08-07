// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/sync — MLS pipeline status + operator controls. Superuser-gated by the
 * shared sync/layout.tsx.
 *
 * 11C: the page CHROME speaks the v2 admin language (ADMIN_UI.md). The three
 * panels below are mounted verbatim and migrate with their own family.
 *
 * MUST NOT BREAK:
 *  - the `runInProgress` expression is the cursor-freshness read the panels
 *    below key off (SyncPageAdvanced enable/disable, RefreshActivePendingButton).
 *    It is READ by the lead sentence and otherwise untouched.
 *  - `zeroTerminal` stays all-zero: SyncLiveStatusAndTerminal overwrites it from
 *    /api/admin/sync/live within 5s, and a non-zero seed would paint a figure
 *    nothing measured.
 *  - ci:sync-cursor / ci:delta-sync-core / ci:count-degraded-read guard the
 *    lanes these panels report on; nothing here computes a cursor or a count.
 *
 * CUT 2026-08-07 (§0): the old lead read "Delta sync, terminal history, full
 * sync, and the strict verify cron handle ongoing work." vercel.json registers
 * sync-delta, sync-history-terminal and sync-full — there is no scheduled
 * strict-verify cron. /api/cron/sync-verify-full-history exists as a route but
 * sits in scripts/cron-registered-baseline.json (the unregistered backlog), so
 * it runs only when someone curls it. The sentence claimed a fourth cron that
 * does not run.
 */
export const dynamic = 'force-dynamic'
import BackfillHealthPanel from './BackfillHealthPanel'
import SyncHeavyStatusSections from './SyncHeavyStatusSections'
import SyncLiveStatusAndTerminal from './SyncLiveStatusAndTerminal'
import { VerdictLine } from '@/components/admin/v2'
import { getSyncStatus } from '@/app/actions/sync-full-cron'
import { getTotalListingsRows } from '@/app/actions/listings'

export default async function SyncPage() {
  // Lightweight SSR data — both are fast cached queries
  const [syncStatus, totalListings] = await Promise.all([
    getSyncStatus(),
    getTotalListingsRows(),
  ])

  const runInProgress =
    !!syncStatus.cursor?.runStartedAt &&
    !!syncStatus.cursor?.updatedAt &&
    Date.now() - new Date(syncStatus.cursor.updatedAt).getTime() <= 120_000 &&
    (syncStatus.cursor.phase === 'history' || syncStatus.cursor.phase === 'listings')

  // Zero-value initial terminal — SyncLiveStatusAndTerminal polls /api/admin/sync/live
  // within 5 s and overwrites these with live numbers. Zeros are safe defaults.
  const zeroTerminal = {
    closedTotalInDb: 0,
    closedFinalizedCount: 0,
    closedNotFinalizedCount: 0,
    expiredTotalInDb: 0,
    expiredFinalizedCount: 0,
    expiredNotFinalizedCount: 0,
    withdrawnTotalInDb: 0,
    withdrawnFinalizedCount: 0,
    withdrawnNotFinalizedCount: 0,
    canceledTotalInDb: 0,
    canceledFinalizedCount: 0,
    canceledNotFinalizedCount: 0,
    terminalTotalInDb: 0,
    terminalFinalizedInDb: 0,
    terminalRemainingInDb: 0,
    terminalFinalizedPct: 0,
  }

  // Lead sentence — every clause reads a value already on this page. `paused`
  // and `cronEnabled` are cursor flags the operator controls below toggle;
  // `runInProgress` is the expression above, verbatim; the count is the same
  // getTotalListingsRows() figure the panel prints as "In database".
  const paused = syncStatus.cursor?.paused === true
  const cronOff = syncStatus.cursor?.cronEnabled === false
  const phase = syncStatus.cursor?.phase ?? null

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <VerdictLine tone={paused || cronOff ? 'attention' : 'ok'}>
        <b>
          {paused ? 'Full sync is paused. ' : null}
          {cronOff ? 'The weekly full-sync cron is switched off. ' : null}
          {!paused && !cronOff
            ? runInProgress
              ? `A sync run is moving through its ${phase} phase. `
              : 'No sync run has moved the cursor in the last two minutes. '
            : null}
        </b>
        {totalListings.toLocaleString('en-US')} listings in the database.
      </VerdictLine>

      {/* Live sync status + start/stop terminal history buttons */}
      <SyncLiveStatusAndTerminal
        initialCursor={syncStatus.cursor}
        initialTerminal={zeroTerminal}
      />

      {/* Spark vs DB comparison + advanced operator controls (SyncPageAdvanced) */}
      <SyncHeavyStatusSections
        totalListings={totalListings}
        syncStatus={syncStatus}
        runInProgress={runInProgress}
      />

      {/* Backfill health monitor */}
      <div style={{ marginTop: 24 }}>
        <BackfillHealthPanel />
      </div>
    </div>
  )
}
