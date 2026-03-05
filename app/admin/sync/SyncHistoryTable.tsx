import type { SyncHistoryRow } from '../../actions/sync-history'

/** Format ISO date for display. Use UTC and fixed format to avoid server/client hydration mismatch. */
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const min = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  } catch {
    return iso
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ${s}s`
}

type Props = { rows: SyncHistoryRow[] }

export default function SyncHistoryTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Sync history</h2>
        <p className="mt-2 text-sm text-zinc-500">No sync runs recorded yet. Runs are recorded when you complete a listings, history, photos, or full sync.</p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Sync history</h2>
      <p className="mt-1 text-sm text-zinc-500">Date, duration, and counts for each completed sync run.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="py-2 pr-4 text-left font-medium text-zinc-600">Date</th>
              <th className="py-2 pr-4 text-left font-medium text-zinc-600">Type</th>
              <th className="py-2 pr-4 text-right font-medium text-zinc-600">Time</th>
              <th className="py-2 pr-4 text-right font-medium text-zinc-600">Listings</th>
              <th className="py-2 pr-4 text-right font-medium text-zinc-600">History</th>
              <th className="py-2 pr-4 text-right font-medium text-zinc-600">Photos</th>
              <th className="py-2 pl-4 text-left font-medium text-zinc-600">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100">
                <td className="py-2 pr-4 text-zinc-900 whitespace-nowrap">{formatDateTime(row.completed_at)}</td>
                <td className="py-2 pr-4 text-zinc-700 capitalize">{row.run_type}</td>
                <td className="py-2 pr-4 text-right font-mono text-zinc-700">{formatDuration(row.duration_seconds)}</td>
                <td className="py-2 pr-4 text-right font-mono text-zinc-700">{row.listings_upserted > 0 ? row.listings_upserted.toLocaleString() : '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-zinc-700">{row.history_rows_upserted > 0 ? row.history_rows_upserted.toLocaleString() : '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-zinc-700">{row.photos_updated > 0 ? row.photos_updated.toLocaleString() : '—'}</td>
                <td className="py-2 pl-4 text-red-600 text-xs max-w-[200px] truncate" title={row.error ?? undefined}>{row.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
