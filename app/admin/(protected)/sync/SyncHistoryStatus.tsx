'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { syncListingHistory } from '@/app/actions/sync-spark'
import type { SyncHistoryResult } from '@/app/actions/sync-spark'
import { Button } from "@/components/ui/button"

const BATCH_LIMIT = 50

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export type SyncHistoryStatusHandle = { startSync: () => void }

const SyncHistoryStatus = forwardRef<SyncHistoryStatusHandle>(function SyncHistoryStatus(_, ref) {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'stopped' | 'error'>('idle')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [listingsProcessed, setListingsProcessed] = useState(0)
  const [historyRowsUpserted, setHistoryRowsUpserted] = useState(0)
  const [totalListings, setTotalListings] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sparkHint, setSparkHint] = useState<string | null>(null)
  const [insertError, setInsertError] = useState<string | null>(null)
  const [listingsWithHistory, setListingsWithHistory] = useState(0)
  const abortedRef = useRef(false)
  const startRef = useRef(0)
  const handleStartRef = useRef<() => void>(() => {})

  useImperativeHandle(ref, () => ({
    startSync() {
      handleStartRef.current()
    },
  }), [])

  useEffect(() => {
    if (status !== 'running' || startTime == null) return
    const tick = () => setElapsedMs(Date.now() - startRef.current)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status, startTime])

  async function runBatch(offset: number): Promise<SyncHistoryResult> {
    return syncListingHistory({ limit: BATCH_LIMIT, offset, activeAndPendingOnly: true })
  }

  async function handleStart() {
    abortedRef.current = false
    startRef.current = Date.now()
    setStatus('running')
    setStartTime(startRef.current)
    setElapsedMs(0)
    setListingsProcessed(0)
    setHistoryRowsUpserted(0)
    setTotalListings(null)
    setMessage(null)
    setError(null)
    setSparkHint(null)
    setInsertError(null)
    let offset = 0
    let totalList = 0
    let totalProcessed = 0
    let totalRows = 0
    let totalWithHistory = 0

    while (true) {
      if (abortedRef.current) {
        setStatus('stopped')
        setMessage('History sync stopped by user.')
        break
      }
      setElapsedMs(Date.now() - startRef.current)
      const res = await runBatch(offset)
      if (res.totalListings != null) totalList = res.totalListings
      setTotalListings(totalList)
      totalProcessed += res.listingsProcessed ?? 0
      totalRows += res.historyRowsUpserted ?? 0
      totalWithHistory += res.listingsWithHistory ?? 0
      setListingsProcessed(totalProcessed)
      setHistoryRowsUpserted(totalRows)
      setListingsWithHistory(totalWithHistory)

      if (res.sparkHint) setSparkHint(res.sparkHint)
      if (res.insertError) setInsertError(res.insertError)

      if (!res.success) {
        setStatus('error')
        setError(res.error ?? res.message)
        setMessage(res.message)
        break
      }

      if (res.nextOffset == null) {
        setStatus('complete')
        setMessage(res.message ?? 'History sync complete.')
        break
      }
      offset = res.nextOffset
    }
  }
  handleStartRef.current = handleStart

  function handleStop() {
    abortedRef.current = true
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Listing history</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Backfill price/status history from Spark into Supabase so listing pages and reports (CMAs, market analytics) donâ€™t call the API. Run after listing sync.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleStart}
          disabled={status === 'running'}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'running' ? 'Syncing historyâ€¦' : 'Sync history'}
        </Button>
        {status === 'running' && (
          <Button
            type="button"
            onClick={handleStop}
            className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Stop
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
          <p className="mt-1 font-semibold capitalize text-foreground">{status}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Elapsed</p>
          <p className="mt-1 font-mono font-semibold text-foreground">
            {startTime != null ? formatElapsed(elapsedMs) : 'â€”'}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Listings processed</p>
          <p className="mt-1 font-mono font-semibold text-foreground">{listingsProcessed.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">History rows stored</p>
          <p className="mt-1 font-mono font-semibold text-foreground">{historyRowsUpserted.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Listings w/ history from Spark</p>
          <p className="mt-1 font-mono font-semibold text-foreground">{listingsWithHistory.toLocaleString()}</p>
        </div>
      </div>
      {totalListings != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Total listings in DB: {totalListings.toLocaleString()}
        </p>
      )}
      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {message}
        </p>
      )}
      {error && status === 'error' && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
      {sparkHint && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
          {sparkHint}
        </p>
      )}
      {insertError && (
        <p className="mt-2 text-sm text-destructive">
          <strong>Insert error:</strong> {insertError}
        </p>
      )}
    </div>
  )
})

export default SyncHistoryStatus
