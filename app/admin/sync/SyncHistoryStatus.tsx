'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { syncListingHistory } from '../../actions/sync-spark'
import type { SyncHistoryResult } from '../../actions/sync-spark'

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
    return syncListingHistory({ limit: BATCH_LIMIT, offset })
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">Listing history</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Backfill price/status history from Spark into Supabase so listing pages and reports (CMAs, market analytics) don’t call the API. Run after listing sync.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={status === 'running'}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'running' ? 'Syncing history…' : 'Sync history'}
        </button>
        {status === 'running' && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Stop
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</p>
          <p className="mt-1 font-semibold capitalize text-zinc-900">{status}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Elapsed</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">
            {startTime != null ? formatElapsed(elapsedMs) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Listings processed</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{listingsProcessed.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">History rows stored</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{historyRowsUpserted.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Listings w/ history from Spark</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{listingsWithHistory.toLocaleString()}</p>
        </div>
      </div>
      {totalListings != null && (
        <p className="mt-3 text-xs text-zinc-500">
          Total listings in DB: {totalListings.toLocaleString()}
        </p>
      )}
      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-600' : 'text-zinc-600'}`}>
          {message}
        </p>
      )}
      {error && status === 'error' && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      {sparkHint && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {sparkHint}
        </p>
      )}
      {insertError && (
        <p className="mt-2 text-sm text-red-600">
          <strong>Insert error:</strong> {insertError}
        </p>
      )}
    </div>
  )
})

export default SyncHistoryStatus
