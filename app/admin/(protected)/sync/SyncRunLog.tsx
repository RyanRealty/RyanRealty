import type { DeltaCheckpointRow } from '@/app/actions/sync-full-cron'
import type { SyncHistoryRow } from '@/app/actions/sync-history'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function deltaSummary(row: DeltaCheckpointRow): string {
  const meta = row.metadata ?? {}
  const created = (meta.listingsCreated ?? []).length
  const updated = (meta.listingsUpdated ?? []).length
  const closed = (meta.listingsClosed ?? []).length
  const parts: string[] = []
  if (created > 0) parts.push(`${created} created`)
  if (updated > 0) parts.push(`${updated} updated`)
  if (closed > 0) parts.push(`${closed} closed`)
  if (parts.length === 0 && (row.total_count ?? 0) > 0) parts.push(`${row.total_count} listings`)
  if (parts.length === 0) return '0 listings'
  return parts.join(', ')
}

type LogEntry =
  | { type: 'delta'; at: string; summary: string }
  | { type: 'full'; at: string; summary: string }

type Props = {
  deltaRows: DeltaCheckpointRow[]
  fullRows: SyncHistoryRow[]
  /** Max entries to show (combined). */
  limit?: number
}

export default function SyncRunLog({ deltaRows, fullRows, limit = 60 }: Props) {
  const entries: LogEntry[] = []

  for (const row of deltaRows) {
    entries.push({ type: 'delta', at: row.completed_at, summary: deltaSummary(row) })
  }
  for (const row of fullRows) {
    const parts: string[] = []
    if ((row.listings_upserted ?? 0) > 0) parts.push(`${(row.listings_upserted ?? 0).toLocaleString()} listings`)
    if ((row.history_rows_upserted ?? 0) > 0) parts.push(`${(row.history_rows_upserted ?? 0).toLocaleString()} history`)
    entries.push({ type: 'full', at: row.completed_at, summary: parts.length ? parts.join(', ') : '—' })
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const show = entries.slice(0, limit)

  if (show.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Sync run log</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No sync runs yet. Delta (2-min) runs appear when Inngest is active; full runs appear when Smart Sync or cron completes.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Sync run log</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {fullRows.length === 0 ? 'Delta (2‑min Inngest) runs only.' : 'When each sync ran and what was updated. Delta = 2‑min Inngest; Full = Smart Sync / cron.'}
      </p>
      <div className="mt-4 overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">When</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {show.map((entry, i) => (
              <TableRow key={`${entry.type}-${entry.at}-${i}`}>
                <TableCell className="text-foreground whitespace-nowrap">{formatDateTime(entry.at)}</TableCell>
                <TableCell>
                  <span className={entry.type === 'delta' ? 'text-success font-medium' : 'text-muted-foreground'}>
                    {entry.type === 'delta' ? 'Delta' : 'Full'}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
