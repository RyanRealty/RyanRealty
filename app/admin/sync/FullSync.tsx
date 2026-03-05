'use client'

import { useState, useRef, useEffect } from 'react'
import { syncSparkListings, syncListingHistory } from '../../actions/sync-spark'
import type { SyncSparkResult, SyncHistoryResult } from '../../actions/sync-spark'
import { recordSyncRun, refreshListingsBreakdown } from '../../actions/sync-history'
import { updateSyncCursorAfterListingsComplete, updateSyncCursorToIdle } from '../../actions/sync-full-cron'
import { useRouter } from 'next/navigation'

const CHUNK_PAGES = 20
const PAGE_SIZE = 100
const HISTORY_BATCH_LIMIT = 50

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

type Phase = 'idle' | 'listings' | 'history' | 'complete' | 'stopped' | 'error'

export default function FullSync() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [insertOnlyMode, setInsertOnlyMode] = useState(false)

  const [listingsFetched, setListingsFetched] = useState(0)
  const [listingsUpserted, setListingsUpserted] = useState(0)
  const [listingsPagesTotal, setListingsPagesTotal] = useState<number | null>(null)
  const [listingsPagesDone, setListingsPagesDone] = useState(0)

  const [historyListingsProcessed, setHistoryListingsProcessed] = useState(0)
  const [historyRowsUpserted, setHistoryRowsUpserted] = useState(0)
  const [historyTotalListings, setHistoryTotalListings] = useState<number | null>(null)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortedRef = useRef(false)

  useEffect(() => {
    if (phase !== 'listings' && phase !== 'history' || startTime == null) return
    const tick = () => setElapsedMs(Date.now() - startTime)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, startTime])

  async function runFullSync() {
    abortedRef.current = false
    const fullSyncStartedAt = Date.now()
    setPhase('listings')
    setStartTime(fullSyncStartedAt)
    setElapsedMs(0)
    setListingsFetched(0)
    setListingsUpserted(0)
    setListingsPagesTotal(null)
    setListingsPagesDone(0)
    setHistoryListingsProcessed(0)
    setHistoryRowsUpserted(0)
    setHistoryTotalListings(null)
    setMessage(null)
    setError(null)

    let nextPage = 1
    let totalPages: number | null = null
    let totalListingsUpserted = 0

    while (true) {
      if (abortedRef.current) {
        setPhase('stopped')
        setMessage('Full sync stopped by user.')
        return
      }

      const res: SyncSparkResult = await syncSparkListings({
        startPage: nextPage,
        maxPages: CHUNK_PAGES,
        pageSize: PAGE_SIZE,
        insertOnly: insertOnlyMode,
      })

      if (totalPages == null && res.totalPagesFromSpark != null) totalPages = res.totalPagesFromSpark
      if (totalPages != null) setListingsPagesTotal(totalPages)

      totalListingsUpserted += res.totalUpserted ?? 0
      setListingsFetched((n) => n + (res.totalFetched ?? 0))
      setListingsUpserted(totalListingsUpserted)
      setListingsPagesDone((n) => n + (res.pagesProcessed ?? 0))

      if (!res.success) {
        setPhase('error')
        setError(res.error ?? res.message)
        setMessage(res.message ?? 'Listing sync failed.')
        return
      }

      nextPage = res.nextPage ?? nextPage + CHUNK_PAGES
      const listingsDone = totalPages != null && nextPage > totalPages
      if (listingsDone) break
    }

    if (totalPages != null) await updateSyncCursorAfterListingsComplete(totalPages)
    setMessage('Listings complete. Syncing listing history…')
    setPhase('history')

    let offset = 0
    let totalProcessed = 0
    let totalRows = 0
    let totalList = 0

    while (true) {
      if (abortedRef.current) {
        setPhase('stopped')
        setMessage('Full sync stopped by user.')
        return
      }

      const res: SyncHistoryResult = await syncListingHistory({
        limit: HISTORY_BATCH_LIMIT,
        offset,
      })

      if (res.totalListings != null) totalList = res.totalListings
      setHistoryTotalListings(totalList)
      totalProcessed += res.listingsProcessed ?? 0
      totalRows += res.historyRowsUpserted ?? 0
      setHistoryListingsProcessed(totalProcessed)
      setHistoryRowsUpserted(totalRows)

      if (!res.success) {
        setPhase('error')
        setError(res.error ?? res.message)
        setMessage(res.message ?? 'History sync failed.')
        return
      }

      if (res.nextOffset == null) {
        setPhase('complete')
        setMessage(`Full sync complete. ${totalListingsUpserted.toLocaleString()} listings, ${totalRows.toLocaleString()} history rows.`)
        setHistoryListingsProcessed(totalProcessed)
        setHistoryRowsUpserted(totalRows)
        await recordSyncRun({
          runType: 'full',
          startedAt: fullSyncStartedAt,
          completedAt: Date.now(),
          listingsUpserted: totalListingsUpserted,
          historyRowsUpserted: totalRows,
          photosUpdated: 0,
        })
        await updateSyncCursorToIdle()
        await refreshListingsBreakdown()
        router.refresh()
        return
      }
      offset = res.nextOffset
    }
  }

  function handleStop() {
    abortedRef.current = true
  }

  const isRunning = phase === 'listings' || phase === 'history'

  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Full sync (listings + history)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        One button: syncs all listings from Spark, then syncs listing history for every listing. Start it before bed and everything will be synced by morning.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={insertOnlyMode}
            onChange={(e) => setInsertOnlyMode(e.target.checked)}
            disabled={isRunning}
            className="rounded border-zinc-300"
          />
          <span className="text-sm text-zinc-700">New only (faster — skip updating existing listing rows)</span>
        </label>
        <button
          type="button"
          onClick={() => runFullSync()}
          disabled={isRunning}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (phase === 'listings' ? 'Syncing listings…' : 'Syncing history…') : 'Start full sync'}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Stop
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Phase</p>
          <p className="mt-1 font-semibold capitalize text-zinc-900">
            {phase === 'listings' && 'Listings'}
            {phase === 'history' && 'History'}
            {phase === 'complete' && 'Complete'}
            {phase === 'stopped' && 'Stopped'}
            {phase === 'error' && 'Error'}
            {phase === 'idle' && '—'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Elapsed</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">
            {startTime != null ? formatElapsed(elapsedMs) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Listings upserted</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{listingsUpserted.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">History rows</p>
          <p className="mt-1 font-mono font-semibold text-zinc-900">{historyRowsUpserted.toLocaleString()}</p>
        </div>
      </div>

      {(phase === 'listings' && listingsPagesTotal != null) && (
        <p className="mt-3 text-xs text-zinc-500">
          Listings: page {listingsPagesDone} of {listingsPagesTotal.toLocaleString()}
        </p>
      )}
      {(phase === 'history' && historyTotalListings != null) && (
        <p className="mt-3 text-xs text-zinc-500">
          History: {historyListingsProcessed.toLocaleString()} of {historyTotalListings.toLocaleString()} listings
        </p>
      )}

      {message && (
        <p className={`mt-4 text-sm ${phase === 'error' ? 'text-red-600' : 'text-zinc-600'}`}>
          {message}
        </p>
      )}
      {error && phase === 'error' && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
