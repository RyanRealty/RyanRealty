import Link from 'next/link'
import {
  getAdminSyncCounts,
  getListingHistoryTableStatus,
  getListingsBreakdown,
} from '../../actions/listings'
import { getSyncHistory } from '../../actions/sync-history'
import { cityEntityKey } from '../../../lib/slug'
import { getSyncStatus } from '../../actions/sync-full-cron'
import { getSparkListingsCountForSync } from '../../../lib/spark'
import SyncSmart from './SyncSmart'
import SyncHistoryTable from './SyncHistoryTable'

/** Always fetch fresh data so numbers and sync status are up to date. */
export const dynamic = 'force-dynamic'

function formatDate(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    const day = Math.floor(h / 24)
    if (day > 0) return `${day} day${day !== 1 ? 's' : ''} ago`
    if (h > 0) return `${h} hour${h !== 1 ? 's' : ''} ago`
    if (m > 0) return `${m} min ago`
    return 'Just now'
  } catch {
    return iso
  }
}

export default async function SyncPage() {
  const [counts, historyTable, breakdown, sparkSyncCount, syncHistoryRows, syncStatus] = await Promise.all([
    getAdminSyncCounts(),
    getListingHistoryTableStatus(),
    getListingsBreakdown(),
    getSparkListingsCountForSync(),
    getSyncHistory(50),
    getSyncStatus(),
  ])
  const { activeCount, totalListings, historyCount, photosCount, videosCount, historyError } = counts
  const breakdownError = breakdown.breakdownError
  const lastSync = syncStatus?.lastSync ?? null

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Sync from Spark</h1>
      <p className="mt-2 text-zinc-600">
        See what data you have, run a smart sync (resume or full), and review the sync log — all in one place.
      </p>

      {/* Where things are at: last sync + current status */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Where things are at</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">Last sync</p>
            <p className="mt-0.5 font-medium text-zinc-900">
              {lastSync ? (
                <>
                  {formatDateTime(lastSync.completedAt)}
                  <span className="ml-1.5 text-sm font-normal text-zinc-600">({relativeTime(lastSync.completedAt)})</span>
                </>
              ) : (
                '—'
              )}
            </p>
            {lastSync && (
              <p className="mt-0.5 text-xs text-zinc-600">
                {lastSync.runType} · {lastSync.durationSeconds}s · {lastSync.listingsUpserted > 0 ? `${lastSync.listingsUpserted.toLocaleString()} listings` : ''}
                {lastSync.listingsUpserted > 0 && lastSync.historyRowsUpserted > 0 ? ' · ' : ''}
                {lastSync.historyRowsUpserted > 0 ? `${lastSync.historyRowsUpserted.toLocaleString()} history` : ''}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-zinc-500">Sync status</p>
            <p className="mt-0.5 font-medium text-zinc-900">
              {syncStatus?.cursor?.runStartedAt ? 'Running' : syncStatus?.cursor?.paused ? 'Paused' : syncStatus?.cursor?.phase === 'idle' ? 'Idle' : `Resumable (${syncStatus?.cursor?.phase})`}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Cron</p>
            <p className="mt-0.5 font-medium text-zinc-900">
              {syncStatus?.cursor?.cronEnabled ? 'On' : 'Off'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Spark (source)</p>
            <p className="mt-0.5 font-medium text-zinc-900">
              {sparkSyncCount != null && !sparkSyncCount.error
                ? `${sparkSyncCount.totalListings.toLocaleString()} listings`
                : sparkSyncCount?.error ?? (sparkSyncCount == null ? 'Not configured (no API key)' : '—')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Listing history table</p>
            <p className="mt-0.5 font-medium text-zinc-900">
              {historyTable.exists ? '✓ Exists' : (historyTable.error ?? 'Missing')}
            </p>
          </div>
        </div>
      </div>

      {/* One smart sync button + live "sync in progress" (handled inside SyncSmart) */}
      <div className="mt-6">
        <SyncSmart initialStatus={syncStatus} sparkConfigured={sparkSyncCount != null && !sparkSyncCount.error} />
      </div>

      {/* Data summary: counts + breakdown by status and city */}
      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Data summary</h2>
        <p className="mt-1 text-sm text-zinc-600">
          What’s in your database right now. Refresh the page after a sync to see updated numbers.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-zinc-500">Listings</p>
            <p className="text-xl font-semibold text-zinc-900">{totalListings.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Active</p>
            <p className="text-xl font-semibold text-zinc-900">{activeCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Photos</p>
            <p className="text-xl font-semibold text-zinc-900">{photosCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Videos</p>
            <p className="text-xl font-semibold text-zinc-900">{videosCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">History rows</p>
            <p className="text-xl font-semibold text-zinc-900">{historyCount.toLocaleString()}</p>
          </div>
        </div>
        {historyError && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Listing history:</strong> {historyError}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">By status (Spark StandardStatus)</p>
          <table className="mt-2 min-w-[200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left font-medium text-zinc-700">Status</th>
                <th className="text-right font-medium text-zinc-700">Count</th>
              </tr>
            </thead>
            <tbody>
              {(breakdown.byStatus ?? []).map(({ status, count }) => (
                <tr key={`status-${status}`} className="border-b border-zinc-100">
                  <td className="py-1.5 text-zinc-900">{status}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-700">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 overflow-x-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">By city (Active / Pending / Closed)</p>
          <table className="mt-2 min-w-[400px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left font-medium text-zinc-700">City</th>
                <th className="text-right font-medium text-zinc-700">Total</th>
                <th className="text-right font-medium text-zinc-700">Active</th>
                <th className="text-right font-medium text-zinc-700">Pending</th>
                <th className="text-right font-medium text-zinc-700">Closed</th>
                <th className="text-right font-medium text-zinc-700">Other</th>
              </tr>
            </thead>
            <tbody>
              {(breakdown.byCity ?? []).map(({ city, total, active, pending, closed, other }, index) => (
                <tr key={`city-${index}-${city}`} className="border-b border-zinc-100">
                  <td className="py-1.5">
                    {city === '(no city)' ? (
                      <span className="text-zinc-900">{city}</span>
                    ) : (
                      <Link href={`/search/${cityEntityKey(city)}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                        {city}
                      </Link>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-zinc-700">{total.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{active.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{pending.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{closed.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{other.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {breakdownError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {breakdownError}
          </p>
        )}
      </div>

      {/* Detailed sync log */}
      <div className="mt-8">
        <SyncHistoryTable rows={syncHistoryRows} />
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        <Link href="/admin/spark-status" className="underline hover:no-underline">Spark connection</Link>
        {' · '}
        <Link href="/admin/banners" className="underline hover:no-underline">Banner images</Link>
        {' · '}
        <Link href="/admin/reports" className="underline hover:no-underline">Market report</Link>
      </p>
    </main>
  )
}
