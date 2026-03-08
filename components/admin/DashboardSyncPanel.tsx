import Link from 'next/link'
import type { SyncHistoryRow } from '@/app/actions/sync-history'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import CronSyncStatus from '@/app/admin/sync/CronSyncStatus'

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

type Props = {
  history: SyncHistoryRow[]
  cursor: SyncCursor | null
  counts: { activeCount: number; totalListings: number; historyCount: number; photosCount: number; videosCount: number; historyError?: string }
  breakdown: { total: number; byStatus: { status: string; count: number }[]; breakdownError?: string }
  historyTableStatus: { exists: boolean; error?: string }
  dataQuality: { totalListings: number; missingPrimaryPhoto: number; classifiedPhotos: number }
}

export default function DashboardSyncPanel(props: Props) {
  const { history, cursor, counts, breakdown, historyTableStatus, dataQuality } = props
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Listings (total)</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{counts.totalListings.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{counts.activeCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Photos</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{counts.photosCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Videos</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{counts.videosCount.toLocaleString()}</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-700">Current sync state</h3>
        <div className="mt-2">
          <CronSyncStatus cursor={cursor} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-700">Sync job history (last 10)</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No sync runs recorded yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-1.5 pr-3 text-left font-medium text-zinc-600">Completed</th>
                  <th className="py-1.5 pr-3 text-left font-medium text-zinc-600">Type</th>
                  <th className="py-1.5 pr-3 text-right font-medium text-zinc-600">Duration</th>
                  <th className="py-1.5 pr-3 text-right font-medium text-zinc-600">Listings</th>
                  <th className="py-1.5 pl-3 text-left font-medium text-zinc-600">Error</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((row) => (
                  <tr key={row.id} className={`border-b border-zinc-100 ${row.error ? 'bg-red-50/50' : ''}`}>
                    <td className="py-1.5 pr-3 text-zinc-900">{formatDateTime(row.completed_at)}</td>
                    <td className="py-1.5 pr-3 capitalize text-zinc-700">{row.run_type}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-zinc-700">{formatDuration(row.duration_seconds)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-zinc-700">{row.listings_upserted > 0 ? row.listings_upserted.toLocaleString() : '—'}</td>
                    <td className="py-1.5 pl-3 text-xs text-red-600 max-w-[180px] truncate" title={row.error ?? undefined}>{row.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2">
          <Link href="/admin/sync" className="text-sm font-medium text-emerald-700 hover:underline">Full sync page</Link>
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-700">Data quality</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Active listings missing primary photo</p>
            <p className={`mt-1 font-semibold ${dataQuality.missingPrimaryPhoto > 0 ? 'text-amber-700' : 'text-zinc-900'}`}>{dataQuality.missingPrimaryPhoto.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Photos classified</p>
            <p className="mt-1 font-semibold text-zinc-900">{dataQuality.classifiedPhotos.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">History table</p>
            <p className={`mt-1 text-sm font-medium ${historyTableStatus.exists ? 'text-emerald-700' : 'text-amber-700'}`}>{historyTableStatus.exists ? 'OK' : (historyTableStatus.error ?? 'Missing')}</p>
          </div>
        </div>
      </div>
      {!breakdown.breakdownError && breakdown.byStatus.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-700">By status</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {breakdown.byStatus.slice(0, 8).map(({ status, count }) => (
              <span key={status} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">{status}: <strong>{count.toLocaleString()}</strong></span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
