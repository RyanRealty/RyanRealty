export const dynamic = 'force-dynamic'
import BackfillHealthPanel from './BackfillHealthPanel'
import SyncHeavyStatusSections from './SyncHeavyStatusSections'
import SyncLiveStatusAndTerminal from './SyncLiveStatusAndTerminal'
import { ConsoleSection } from '@/components/console/ConsoleSection'
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ConsoleSection title="Sync status" bodyClassName="mb-2">
        <p className="text-sm text-muted-foreground">
          Delta sync, terminal history, full sync, and the strict verify cron handle ongoing work.
          Use the controls below to manually trigger, pause, or monitor a sync.
        </p>
      </ConsoleSection>

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
      <div className="mt-6">
        <BackfillHealthPanel />
      </div>
    </main>
  )
}
