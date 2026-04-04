'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type YearRow = {
  year: number
  sparkListings: number | null
  supabaseListings: number | null
  finalizedListings: number | null
  lastSyncedAt: string | null
  lastError: string | null
  runStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  runPhase: string | null
  runStartedAt: string | null
  runUpdatedAt: string | null
  processedListings: number
  totalListings: number
  listingsUpserted: number
  historyInserted: number
  listingsFinalized: number
}

type MatrixResponse = {
  ok: boolean
  rows?: YearRow[]
  error?: string
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatNullableNumber(value: number | null) {
  if (typeof value !== 'number') return 'Not cached yet'
  return value.toLocaleString()
}

export default function YearSyncMatrix() {
  const [rows, setRows] = useState<YearRow[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasBootstrapped, setHasBootstrapped] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [recentFailure, setRecentFailure] = useState<{ year: number; message: string } | null>(null)

  const load = useCallback(
    async (options?: { clearError?: boolean; bootstrap?: boolean; bust?: boolean }): Promise<YearRow[]> => {
      if (options?.clearError ?? true) setError(null)
      if (options?.bootstrap) setBootstrapping(true)
      try {
        const url = new URL('/api/admin/sync/year-matrix', window.location.origin)
        if (options?.bootstrap) url.searchParams.set('bootstrap', '1')
        if (options?.bust) url.searchParams.set('_', String(Date.now()))
        const response = await fetch(url.toString(), { cache: 'no-store' })
        const data = (await response.json()) as MatrixResponse
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to load yearly sync matrix.')
        }
        const incoming = (data.rows ?? []).sort((a, b) => b.year - a.year)
        setRows((prevRows) => {
          const prevByYear = new Map(prevRows.map((row) => [row.year, row]))
          return incoming.map((nextRow) => {
            const prev = prevByYear.get(nextRow.year)
            if (!prev) return nextRow
            return {
              ...nextRow,
              sparkListings: nextRow.sparkListings ?? prev.sparkListings,
              supabaseListings: nextRow.supabaseListings ?? prev.supabaseListings,
              finalizedListings: nextRow.finalizedListings ?? prev.finalizedListings,
            }
          })
        })
        return incoming
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return []
      } finally {
        setInitialLoading(false)
        setBootstrapping(false)
      }
    },
    []
  )

  useEffect(() => {
    void load({ clearError: true })
  }, [load])

  const runningRow = rows.find((r) => r.runStatus === 'running')
  const syncInProgress = runningRow != null

  useEffect(() => {
    const interval = syncInProgress ? 5000 : 15000
    const poll = setInterval(() => void load({ clearError: false, bust: true }), interval)
    return () => clearInterval(poll)
  }, [load, syncInProgress])

  useEffect(() => {
    if (hasBootstrapped || initialLoading || rows.length === 0) return
    const syncRunning = rows.some((r) => r.runStatus === 'running')
    if (syncRunning) return
    const anyMissing = rows.some(
      (r) => typeof r.sparkListings !== 'number' || typeof r.supabaseListings !== 'number'
    )
    if (anyMissing) {
      setHasBootstrapped(true)
      void load({ clearError: false, bootstrap: true })
    }
  }, [hasBootstrapped, initialLoading, rows, load])

  const hasRows = rows.length > 0

  async function stopSync(year: number) {
    if (!year) return
    try {
      const response = await fetch('/api/admin/sync/sync-year/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      })
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Failed to stop sync.')
      } else {
        await load({ clearError: false, bust: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    if (!runningRow) return
    let cancelled = false
    const poll = async () => {
      const newRows = await load({ clearError: false, bust: true })
      if (cancelled) return
      const row = newRows.find((r) => r.year === runningRow.year)
      const status = row?.runStatus ?? 'idle'
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        if (status !== 'completed' && row?.lastError) {
          setRecentFailure({ year: runningRow.year, message: row.lastError })
          setTimeout(() => setRecentFailure(null), 8000)
        }
      }
    }
    void poll()
    const timer = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [runningRow, load])

  return (
    <section className="mt-6">
      <div
        className={cn(
          'mb-4 rounded-lg border-2 px-4 py-3',
          syncInProgress
            ? 'border-primary/50 bg-primary/5'
            : recentFailure
              ? 'border-destructive/50 bg-destructive/5'
              : 'border-border bg-card'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">
              {syncInProgress ? (
                <>Sync in progress — {runningRow?.year ?? '…'}</>
              ) : recentFailure ? (
                <>Sync failed — {recentFailure.year}</>
              ) : (
                <>No sync running</>
              )}
            </p>
            {syncInProgress ? (
              <>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {runningRow?.runPhase ?? 'Running'}
                </p>
                {(() => {
                  const total = Number(runningRow?.totalListings ?? 0)
                  const proc = Number(runningRow?.processedListings ?? 0)
                  const pct = total > 0 ? Math.round((proc / total) * 100) : 0
                  return total > 0 ? (
                    <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null
                })()}
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {(() => {
                    const total = Number(runningRow?.totalListings ?? 0)
                    const proc = Number(runningRow?.processedListings ?? 0)
                    const upserted = runningRow?.listingsUpserted ?? 0
                    const history = runningRow?.historyInserted ?? 0
                    const finalized = runningRow?.listingsFinalized ?? 0
                    const isHistoryPhase = runningRow?.runPhase?.toLowerCase().includes('history')
                    return (
                      <>
                        {isHistoryPhase && total > 0 && (
                          <span>
                            <span className="text-muted-foreground">History fetched for </span>
                            <span className="font-semibold text-foreground">{formatNumber(proc)}</span>
                            <span className="text-muted-foreground"> of {formatNumber(total)} listings</span>
                          </span>
                        )}
                        {!isHistoryPhase && total > 0 && (
                          <span>
                            <span className="font-semibold text-foreground">{formatNumber(proc)}</span>
                            <span className="text-muted-foreground">/{formatNumber(total)} listings downloaded</span>
                          </span>
                        )}
                        {upserted > 0 && (
                          <span>
                            <span className="font-semibold text-foreground">{formatNumber(upserted)}</span>
                            <span className="text-muted-foreground"> upserted</span>
                          </span>
                        )}
                        {history > 0 && (
                          <span>
                            <span className="font-semibold text-foreground">{formatNumber(history)}</span>
                            <span className="text-muted-foreground"> history rows</span>
                          </span>
                        )}
                        {finalized > 0 && (
                          <span>
                            <span className="font-semibold text-foreground">{formatNumber(finalized)}</span>
                            <span className="text-muted-foreground"> finalized</span>
                          </span>
                        )}
                        {total === 0 && upserted === 0 && history === 0 && finalized === 0 && (
                          <span className="text-muted-foreground">Starting…</span>
                        )}
                      </>
                    )
                  })()}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Runs in background. Safe to leave this page.
                </p>
              </>
            ) : recentFailure ? (
              <>
                <p className="mt-1 text-sm text-destructive">{recentFailure.message}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                This section tracks the historical backfill lane. It starts from the newest year and works down through older years while the fresh sync lane keeps current listings updated.
              </p>
            )}
          </div>
          {syncInProgress && runningRow?.year && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void stopSync(runningRow.year)}
            >
              Stop sync
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      )}

      {(initialLoading || bootstrapping) && (
        <p className="text-sm text-muted-foreground">
          {bootstrapping ? 'Loading counts for all years...' : 'Loading yearly data...'}
        </p>
      )}

      {!initialLoading && !hasRows && (
        <p className="text-sm text-muted-foreground">No years found yet.</p>
      )}

      {!initialLoading && !bootstrapping && hasRows && (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            History finalized means terminal listing history fetch completed successfully (including pagination) and finalization checks passed for that listing.
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            A separate strict flag tracks Spark-verified full history. Finalized listings without that strict flag can be re-verified later without blocking current progress.
          </p>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Spark listings</TableHead>
              <TableHead>Supabase listings</TableHead>
              <TableHead>History finalized listings</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const listingsComparable = typeof row.sparkListings === 'number' && typeof row.supabaseListings === 'number'
              const listingsMatch = listingsComparable && row.sparkListings === row.supabaseListings
              return (
              <TableRow key={row.year}>
                <TableCell>{row.year}</TableCell>
                <TableCell className={cn(listingsMatch && 'text-success')}>{formatNullableNumber(row.sparkListings)}</TableCell>
                <TableCell className={cn(listingsComparable && (listingsMatch ? 'text-success' : 'text-destructive'))}>{formatNullableNumber(row.supabaseListings)}</TableCell>
                <TableCell>{formatNullableNumber(row.finalizedListings)}</TableCell>
                <TableCell>
                  {row.runStatus === 'running' && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium">{row.runPhase ?? 'Running'}</p>
                      <p>
                        {row.runPhase?.toLowerCase().includes('history')
                          ? `History fetched for ${formatNumber(row.processedListings)} of ${formatNumber(row.totalListings)} listings`
                          : `${formatNumber(row.processedListings)}/${formatNumber(row.totalListings)} listings downloaded`}
                        {row.historyInserted > 0 && ` · ${formatNumber(row.historyInserted)} history rows`}
                        {row.listingsUpserted > 0 && ` · ${formatNumber(row.listingsUpserted)} upserted`}
                      </p>
                    </div>
                  )}
                  {row.runStatus === 'completed' && (
                    <span className="text-xs text-success">Completed</span>
                  )}
                  {(row.runStatus === 'failed' || row.runStatus === 'cancelled') && (
                    <span className="text-xs text-destructive">{row.lastError ?? row.runStatus}</span>
                  )}
                  {(row.runStatus === 'idle' || !row.runStatus) && (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
          </Table>
        </>
      )}
    </section>
  )
}

