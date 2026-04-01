export const dynamic = 'force-dynamic'
import { getSyncStatus, getDeltaSyncLog } from '@/app/actions/sync-full-cron'
import { getSyncHistory } from '@/app/actions/sync-history'
import { getAdminSyncCounts, getListingSyncStatusBreakdown } from '@/app/actions/listings'
import YearSyncMatrix from './YearSyncMatrix'
import YearSyncLanes from './YearSyncLanes'
import CronSyncStatus from './CronSyncStatus'
import SyncRunLog from './SyncRunLog'
import SyncHeavyStatusSections from './SyncHeavyStatusSections'
import SyncLiveStatusAndTerminal from './SyncLiveStatusAndTerminal'
import SyncTerminalYearlyBreakdown from './SyncTerminalYearlyBreakdown'

export default async function SyncPage() {
  const [syncStatus, deltaRows, fullRows, adminCounts, breakdown] = await Promise.all([
    getSyncStatus(),
    getDeltaSyncLog(20),
    getSyncHistory(20),
    getAdminSyncCounts(),
    getListingSyncStatusBreakdown(),
  ])
  const totalListings = breakdown.total > 0 ? breakdown.total : adminCounts.totalListings
  const initialTerminal = {
    closedTotalInDb: adminCounts.closedFinalizedCount + adminCounts.closedNotFinalizedCount,
    closedFinalizedCount: adminCounts.closedFinalizedCount,
    closedNotFinalizedCount: adminCounts.closedNotFinalizedCount,
    expiredTotalInDb: adminCounts.expiredFinalizedCount + adminCounts.expiredNotFinalizedCount,
    expiredFinalizedCount: adminCounts.expiredFinalizedCount,
    expiredNotFinalizedCount: adminCounts.expiredNotFinalizedCount,
    withdrawnTotalInDb: adminCounts.withdrawnFinalizedCount + adminCounts.withdrawnNotFinalizedCount,
    withdrawnFinalizedCount: adminCounts.withdrawnFinalizedCount,
    withdrawnNotFinalizedCount: adminCounts.withdrawnNotFinalizedCount,
    canceledTotalInDb: adminCounts.canceledFinalizedCount + adminCounts.canceledNotFinalizedCount,
    canceledFinalizedCount: adminCounts.canceledFinalizedCount,
    canceledNotFinalizedCount: adminCounts.canceledNotFinalizedCount,
    terminalTotalInDb:
      (adminCounts.closedFinalizedCount + adminCounts.closedNotFinalizedCount) +
      (adminCounts.expiredFinalizedCount + adminCounts.expiredNotFinalizedCount) +
      (adminCounts.withdrawnFinalizedCount + adminCounts.withdrawnNotFinalizedCount) +
      (adminCounts.canceledFinalizedCount + adminCounts.canceledNotFinalizedCount),
    terminalFinalizedInDb:
      adminCounts.closedFinalizedCount +
      adminCounts.expiredFinalizedCount +
      adminCounts.withdrawnFinalizedCount +
      adminCounts.canceledFinalizedCount,
    terminalRemainingInDb:
      adminCounts.closedNotFinalizedCount +
      adminCounts.expiredNotFinalizedCount +
      adminCounts.withdrawnNotFinalizedCount +
      adminCounts.canceledNotFinalizedCount,
    terminalFinalizedPct:
      (
        (
          adminCounts.closedFinalizedCount +
          adminCounts.expiredFinalizedCount +
          adminCounts.withdrawnFinalizedCount +
          adminCounts.canceledFinalizedCount
        ) /
        Math.max(
          1,
          (adminCounts.closedFinalizedCount + adminCounts.closedNotFinalizedCount) +
            (adminCounts.expiredFinalizedCount + adminCounts.expiredNotFinalizedCount) +
            (adminCounts.withdrawnFinalizedCount + adminCounts.withdrawnNotFinalizedCount) +
            (adminCounts.canceledFinalizedCount + adminCounts.canceledNotFinalizedCount)
        )
      ) * 100,
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Sync control center</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Track the two jobs that matter most: getting old years fully finalized and keeping current listings fresh as they change status.
          This page is organized around what is happening now, what is left, and what the next step is.
        </p>
      </section>
      <SyncLiveStatusAndTerminal initialCursor={syncStatus.cursor} initialTerminal={initialTerminal} />
      <SyncHeavyStatusSections totalListings={totalListings} syncStatus={syncStatus} runInProgress={!!syncStatus.cursor?.runStartedAt} />
      <div className="grid gap-6 xl:grid-cols-2">
        <YearSyncLanes />
        <CronSyncStatus cursor={syncStatus.cursor} />
      </div>
      <YearSyncMatrix />
      <SyncTerminalYearlyBreakdown />
      <SyncRunLog deltaRows={deltaRows} fullRows={fullRows} />
    </main>
  )
}
