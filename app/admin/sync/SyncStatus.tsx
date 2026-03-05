'use client'

import { useState, useRef, useEffect } from 'react'
import type { syncSparkListings } from '../../actions/sync-spark'
import type { SyncSparkResult } from '../../actions/sync-spark'

const CHUNK_PAGES = 20
const PAGE_SIZE = 100

type SyncAction = typeof syncSparkListings

type SyncStatusProps = {
  syncAction: SyncAction
  /** Called when listing sync completes. Use to start history sync. */
  onListingSyncComplete?: () => void
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function SyncStatus({ syncAction, onListingSyncComplete }: SyncStatusProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'stopped' | 'error'>('idle')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [totalFetched, setTotalFetched] = useState(0)
  const [totalUpserted, setTotalUpserted] = useState(0)
  const [totalPagesFromSpark, setTotalPagesFromSpark] = useState<number | null>(null)
  const [pagesProcessed, setPagesProcessed] = useState(0)
  const [currentPageStart, setCurrentPageStart] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [insertOnlyMode, setInsertOnlyMode] = useState(false)
  const [autoStartHistorySync, setAutoStartHistorySync] = useState(true)
  const abortedRef = useRef(false)
  const didEmitCompleteRef = useRef(false)

  useEffect(() => {
    if (status !== 'running' || startTime == null) return
    const tick = () => setElapsedMs(Date.now() - startTime)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status, startTime])

  async function runChunk(startPage: number): Promise<SyncSparkResult> {
    return syncAction({
      startPage,
      maxPages: CHUNK_PAGES,
      pageSize: PAGE_SIZE,
      insertOnly: insertOnlyMode,
    })
  }

  async function handleStart() {
    abortedRef.current = false
    didEmitCompleteRef.current = false
    setStatus('running')
    setStartTime(Date.now())
    setElapsedMs(0)
    setTotalFetched(0)
    setTotalUpserted(0)
    setTotalPagesFromSpark(null)
    setPagesProcessed(0)
    setCurrentPageStart(1)
    setMessage(null)
    setError(null)

    let nextPage = 1
    let totalPages: number | null = null

    while (true) {
      if (abortedRef.current) {
        setStatus('stopped')
        setMessage('Sync stopped by user.')
        break
      }

      const res = await runChunk(nextPage)
      if (totalPages == null && res.totalPagesFromSpark != null) totalPages = res.totalPagesFromSpark
      if (totalPages != null) setTotalPagesFromSpark(totalPages)

      setTotalFetched((n) => n + (res.totalFetched ?? 0))
      setTotalUpserted((n) => n + (res.totalUpserted ?? 0))
      setPagesProcessed((n) => n + (res.pagesProcessed ?? 0))
      setCurrentPageStart(nextPage)

      if (!res.success) {
        setStatus('error')
        setError(res.error ?? res.message)
        setMessage(res.message)
        break
      }

      nextPage = res.nextPage ?? nextPage + CHUNK_PAGES
      const done = totalPages != null && nextPage > totalPages
      if (done) {
        setStatus('complete')
        setMessage(res.message ?? 'Sync complete.')
        if (autoStartHistorySync && onListingSyncComplete && !didEmitCompleteRef.current) {
          didEmitCompleteRef.current = true
          onListingSyncComplete()
        }
        break
      }
    }
  }

  function handleStop() {
    abortedRef.current = true
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={insertOnlyMode}
            onChange={(e) => setInsertOnlyMode(e.target.checked)}
            disabled={status === 'running'}
            className="rounded border-zinc-300"
          />
          <span className="text-sm text-zinc-700">New only (faster — skip updating existing rows)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoStartHistorySync}
            onChange={(e) => setAutoStartHistorySync(e.target.checked)}
            disabled={status === 'running'}
            className="rounded border-zinc-300"
          />
          <span className="text-sm text-zinc-700">Start history sync when listing sync completes</span>
        </label>
        <button
          type="button"
          onClick={handleStart}
          disabled={status === 'running'}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'running' ? 'Syncing…' : 'Start sync'}
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
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Records retrieved</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{totalFetched.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Records inserted</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{totalUpserted.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pages</p>
        <p className="mt-1 font-mono text-zinc-900">
          {totalPagesFromSpark != null
            ? `Pages ${currentPageStart}–${Math.min(currentPageStart + CHUNK_PAGES - 1, totalPagesFromSpark)} of ${totalPagesFromSpark.toLocaleString()}`
            : status === 'running'
              ? `Starting… (page ${currentPageStart})`
              : '—'}
        </p>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-600' : 'text-zinc-600'}`}>
          {message}
        </p>
      )}
      {error && status === 'error' && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
