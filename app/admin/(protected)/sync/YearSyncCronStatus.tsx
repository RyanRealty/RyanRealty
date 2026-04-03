'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Cursor = {
  currentYear: number | null
  phase: string
  nextListingPage: number
  nextHistoryOffset: number
  totalListings: number | null
  updatedAt: string
}

type LogEntry = {
  id: string
  year: number
  status: 'completed' | 'failed' | 'skipped'
  listings_upserted: number
  history_inserted: number
  listings_finalized: number
  completed_at: string
  error: string | null
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function YearSyncCronStatus() {
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/sync/year-sync-log', { cache: 'no-store' })
      const data = (await res.json()) as { ok: boolean; cursor?: Cursor | null; log?: LogEntry[]; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to load')
        return
      }
      setError(null)
      setCursor(data.cursor ?? null)
      setLog(data.log ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isRunning = cursor && cursor.phase !== 'idle' && cursor.phase !== 'pick_next'

  useEffect(() => {
    void load()
    const interval = setInterval(load, isRunning ? 5000 : 15000)
    return () => clearInterval(interval)
  }, [isRunning])

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Year sync status</CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest run results by year. This is your quick confirmation that history rows are being added and listings are being finalized.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {cursor && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              {isRunning ? (
                <>Syncing year {cursor.currentYear ?? '…'} — {cursor.phase}</>
              ) : (
                <>Idle</>
              )}
            </p>
            {isRunning && cursor.totalListings != null && (
              <p className="mt-1 text-sm text-muted-foreground">
                History: {cursor.nextHistoryOffset} / {cursor.totalListings} processed
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Last updated: {formatTime(cursor.updatedAt)}</p>
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Recent completions</p>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No years completed yet. The cron will run when triggered.</p>
          ) : (
            <div className="space-y-2">
              {log.slice(0, 15).map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-foreground">{entry.year}</span>
                  <Badge
                    variant={entry.status === 'completed' ? 'default' : entry.status === 'failed' ? 'destructive' : 'secondary'}
                  >
                    {entry.status}
                  </Badge>
                  {entry.status === 'completed' && (
                    <>
                      <span className="text-muted-foreground">
                        {entry.history_inserted.toLocaleString()} history rows
                      </span>
                      <span className="text-muted-foreground">
                        {entry.listings_finalized.toLocaleString()} finalized
                      </span>
                    </>
                  )}
                  {entry.error && (
                    <span className="text-destructive">{entry.error}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatTime(entry.completed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
