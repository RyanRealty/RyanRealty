'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type LaneStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

type YearLane = {
  id: 'current_year' | 'historical_backfill'
  label: string
  description: string
  targetYear: number | null
  phase: string | null
  status: LaneStatus
  processedListings: number
  totalListings: number
  listingsUpserted: number
  historyInserted: number
  listingsFinalized: number
  updatedAt: string | null
  lastError: string | null
}

type YearLogEntry = {
  id: string
  year: number
  status: 'completed' | 'failed' | 'skipped'
  listings_upserted: number
  history_inserted: number
  listings_finalized: number
  completed_at: string
  error: string | null
}

type YearLanesPayload = {
  ok: boolean
  lanes: YearLane[]
  log: YearLogEntry[]
  error?: string
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  try {
    const deltaMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.floor(deltaMs / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  } catch {
    return '—'
  }
}

function laneTone(status: LaneStatus): string {
  switch (status) {
    case 'running':
      return 'border-primary/40 bg-primary/5'
    case 'completed':
      return 'border-success/40 bg-success/10'
    case 'failed':
      return 'border-destructive/40 bg-destructive/10'
    case 'cancelled':
      return 'border-warning/40 bg-warning/10'
    default:
      return 'border-border bg-card'
  }
}

function progressPercent(processed: number, total: number): number {
  if (!Number.isFinite(processed) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)))
}

export default function YearSyncLanes() {
  const [payload, setPayload] = useState<YearLanesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/admin/sync/year-lanes', { cache: 'no-store' })
        const data = (await res.json()) as YearLanesPayload
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load sync lanes.')
        }
        if (!cancelled) {
          setPayload(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
    const id = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const lanes = payload?.lanes ?? []
  const log = payload?.log ?? []

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Year sync lanes</CardTitle>
        <p className="text-sm text-muted-foreground">
          One lane keeps the current year fresh. The other lane chews through the older-year backlog.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {lanes.map((lane) => {
            const pct = progressPercent(lane.processedListings, lane.totalListings)
            return (
              <div
                key={lane.id}
                className={cn('rounded-lg border p-4', laneTone(lane.status))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{lane.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lane.id === 'current_year'
                        ? 'Dedicated current-year catch-up. Finishes 2026 listings first, then 2026 history/finalization.'
                        : 'Older-year backlog lane. Works through past years without blocking the current-year lane.'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      lane.status === 'running'
                        ? 'default'
                        : lane.status === 'failed'
                          ? 'destructive'
                          : lane.status === 'completed'
                            ? 'secondary'
                            : 'outline'
                    }
                  >
                    {lane.status}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Target year</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {lane.targetYear ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phase</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {lane.phase ?? 'Idle'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Listings upserted</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {lane.listingsUpserted.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">History rows</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {lane.historyInserted.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Listings finalized</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {lane.listingsFinalized.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last updated</p>
                    <p className="mt-0.5 font-mono font-medium text-foreground">
                      {formatRelative(lane.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>
                      {lane.processedListings.toLocaleString()} / {lane.totalListings.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {lane.lastError && (
                  <p className="mt-3 text-sm text-destructive">{lane.lastError}</p>
                )}
              </div>
            )
          })}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Recent year completions</p>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed year runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {log.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-foreground">{entry.year}</span>
                  <Badge
                    variant={
                      entry.status === 'completed'
                        ? 'secondary'
                        : entry.status === 'failed'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {entry.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {entry.history_inserted.toLocaleString()} history rows
                  </span>
                  <span className="text-muted-foreground">
                    {entry.listings_finalized.toLocaleString()} finalized
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTime(entry.completed_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
