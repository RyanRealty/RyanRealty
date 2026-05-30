'use client'

import { useState, useRef, useEffect } from 'react'
import { syncSparkListings, syncListingHistory, syncPhotosOnly } from '@/app/actions/sync-spark'
import type { SyncSparkResult, SyncHistoryResult, SyncPhotosResult } from '@/app/actions/sync-spark'
import { recordSyncRun, refreshListingsBreakdown } from '@/app/actions/sync-history'
import { updateSyncCursorAfterListingsComplete, updateSyncCursorToIdle } from '@/app/actions/sync-full-cron'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"

const LISTING_CHUNK_PAGES = 20
const LISTING_PAGE_SIZE = 100
const HISTORY_BATCH_LIMIT = 50

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function SyncAllButtons() {
  const router = useRouter()
  const [listingsState, setListingsState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [historyState, setHistoryState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [listingsElapsed, setListingsElapsed] = useState(0)
  const [historyElapsed, setHistoryElapsed] = useState(0)
  const [listingsStart, setListingsStart] = useState<number | null>(null)
  const [historyStart, setHistoryStart] = useState<number | null>(null)
  const [listingsUpserted, setListingsUpserted] = useState(0)
  const [listingsPagesDone, setListingsPagesDone] = useState(0)
  const [listingsPagesTotal, setListingsPagesTotal] = useState<number | null>(null)
  const [historyRows, setHistoryRows] = useState(0)
  const [historyListingsProcessed, setHistoryListingsProcessed] = useState(0)
  const [historyTotalListings, setHistoryTotalListings] = useState<number | null>(null)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [photosState, setPhotosState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [photosElapsed, setPhotosElapsed] = useState(0)
  const [photosStart, setPhotosStart] = useState<number | null>(null)
  const [photosUpdated, setPhotosUpdated] = useState(0)
  const [photosPagesDone, setPhotosPagesDone] = useState(0)
  const [photosPagesTotal, setPhotosPagesTotal] = useState<number | null>(null)
  const [photosError, setPhotosError] = useState<string | null>(null)
  const photosAbortRef = useRef(false)
  const listingsAbortRef = useRef(false)
  const historyAbortRef = useRef(false)
  const listingsStartRef = useRef(0)
  const historyStartRef = useRef(0)
  const photosStartRef = useRef(0)

  useEffect(() => {
    if (listingsState !== 'running' || listingsStart == null) return
    const tick = () => setListingsElapsed(Date.now() - listingsStart)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [listingsState, listingsStart])

  useEffect(() => {
    if (historyState !== 'running' || historyStart == null) return
    const tick = () => setHistoryElapsed(Date.now() - historyStart)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [historyState, historyStart])

  useEffect(() => {
    if (photosState !== 'running' || photosStart == null) return
    const tick = () => setPhotosElapsed(Date.now() - photosStart)
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [photosState, photosStart])

  async function runAllPhotos() {
    photosAbortRef.current = false
    const startedAt = Date.now()
    photosStartRef.current = startedAt
    setPhotosState('running')
    setPhotosStart(startedAt)
    setPhotosElapsed(0)
    setPhotosUpdated(0)
    setPhotosPagesDone(0)
    setPhotosPagesTotal(null)
    setPhotosError(null)

    let nextPage = 1
    let totalPages: number | null = null
    let totalUpdated = 0

    try {
      while (true) {
        if (photosAbortRef.current) {
          setPhotosState('done')
          break
        }
        const res: SyncPhotosResult = await syncPhotosOnly({
          startPage: nextPage,
          maxPages: LISTING_CHUNK_PAGES,
          pageSize: LISTING_PAGE_SIZE,
        })
        if (totalPages == null && res.totalPagesFromSpark != null) totalPages = res.totalPagesFromSpark
        setPhotosPagesTotal(totalPages)
        totalUpdated += res.totalUpdated ?? 0
        setPhotosUpdated(totalUpdated)
        setPhotosPagesDone((n) => n + (res.pagesProcessed ?? 0))

        if (!res.success) {
          setPhotosState('error')
          setPhotosError(res.error ?? res.message)
          break
        }
        nextPage = res.nextPage ?? nextPage + LISTING_CHUNK_PAGES
        if (totalPages != null && nextPage > totalPages) {
          setPhotosState('done')
          await recordSyncRun({ runType: 'photos', startedAt, completedAt: Date.now(), photosUpdated: totalUpdated })
          router.refresh()
          break
        }
      }
    } catch (e) {
      setPhotosState('error')
      setPhotosError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runAllListings() {
    listingsAbortRef.current = false
    const startedAt = Date.now()
    listingsStartRef.current = startedAt
    setListingsState('running')
    setListingsStart(startedAt)
    setListingsElapsed(0)
    setListingsUpserted(0)
    setListingsPagesDone(0)
    setListingsPagesTotal(null)
    setListingsError(null)

    let nextPage = 1
    let totalPages: number | null = null
    let totalUpserted = 0

    try {
      while (true) {
        if (listingsAbortRef.current) {
          setListingsState('done')
          break
        }
        const res: SyncSparkResult = await syncSparkListings({
          startPage: nextPage,
          maxPages: LISTING_CHUNK_PAGES,
          pageSize: LISTING_PAGE_SIZE,
          insertOnly: false,
        })
        if (totalPages == null && res.totalPagesFromSpark != null) totalPages = res.totalPagesFromSpark
        setListingsPagesTotal(totalPages)
        totalUpserted += res.totalUpserted ?? 0
        setListingsPagesDone((n) => n + (res.pagesProcessed ?? 0))

        if (!res.success) {
          setListingsState('error')
          setListingsError(res.error ?? res.message)
          break
        }
        nextPage = res.nextPage ?? nextPage + LISTING_CHUNK_PAGES
        if (totalPages != null && nextPage > totalPages) {
          setListingsState('done')
          await recordSyncRun({ runType: 'listings', startedAt, completedAt: Date.now(), listingsUpserted: totalUpserted })
          await updateSyncCursorAfterListingsComplete(totalPages)
          await refreshListingsBreakdown()
          router.refresh()
          break
        }
      }
    } catch (e) {
      setListingsState('error')
      setListingsError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runAllHistory() {
    historyAbortRef.current = false
    const startedAt = Date.now()
    historyStartRef.current = startedAt
    setHistoryState('running')
    setHistoryStart(startedAt)
    setHistoryElapsed(0)
    setHistoryRows(0)
    setHistoryListingsProcessed(0)
    setHistoryTotalListings(null)
    setHistoryError(null)

    let offset = 0
    let totalProcessed = 0
    let totalRows = 0
    let totalList = 0

    try {
      while (true) {
        if (historyAbortRef.current) {
          setHistoryState('done')
          break
        }
        const res: SyncHistoryResult = await syncListingHistory({
          limit: HISTORY_BATCH_LIMIT,
          offset,
          activeAndPendingOnly: true,
        })
        if (res.totalListings != null) totalList = res.totalListings
        setHistoryTotalListings(totalList)
        totalProcessed += res.listingsProcessed ?? 0
        totalRows += res.historyRowsUpserted ?? 0
        setHistoryListingsProcessed(totalProcessed)
        setHistoryRows(totalRows)

        if (!res.success) {
          setHistoryState('error')
          setHistoryError(res.error ?? res.message)
          break
        }
        if (res.nextOffset == null) {
          setHistoryState('done')
          await recordSyncRun({ runType: 'history', startedAt, completedAt: Date.now(), historyRowsUpserted: totalRows })
          await updateSyncCursorToIdle()
          router.refresh()
          break
        }
        offset = res.nextOffset
      }
    } catch (e) {
      setHistoryState('error')
      setHistoryError(e instanceof Error ? e.message : String(e))
    }
  }

  const listingsRunning = listingsState === 'running'
  const historyRunning = historyState === 'running'
  const photosRunning = photosState === 'running'

  return (
    <div className="rounded-lg border-2 border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Sync</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sync all listings from Spark, or all listing history. Safe to run multiple times.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => runAllListings()}
            disabled={listingsRunning || historyRunning || photosRunning}
            className="rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground hover:bg-success/75 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {listingsRunning ? 'Syncing listings…' : 'Sync all listings'}
          </Button>
          {listingsRunning && (
            <Button
              type="button"
              onClick={() => { listingsAbortRef.current = true }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Stop
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => runAllHistory()}
            disabled={listingsRunning || historyRunning || photosRunning}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {historyRunning ? 'Syncing history…' : 'Sync all history'}
          </Button>
          {historyRunning && (
            <Button
              type="button"
              onClick={() => { historyAbortRef.current = true }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Stop
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => runAllPhotos()}
            disabled={listingsRunning || historyRunning || photosRunning}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {photosRunning ? 'Syncing photos…' : 'Sync photos only'}
          </Button>
          {photosRunning && (
            <Button
              type="button"
              onClick={() => { photosAbortRef.current = true }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Stop
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Listings sync</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {listingsState === 'idle' && '—'}
            {listingsRunning && `${listingsPagesDone} pages · ${listingsUpserted.toLocaleString()} upserted`}
            {(listingsState === 'done' || listingsState === 'error') && (
              <>{(listingsStart != null ? formatElapsed(listingsElapsed) : '')} · {listingsUpserted.toLocaleString()} upserted</>
            )}
          </p>
          {listingsPagesTotal != null && listingsRunning && (
            <p className="mt-0.5 text-xs text-muted-foreground">Page {listingsPagesDone} of {listingsPagesTotal.toLocaleString()}</p>
          )}
          {listingsError && <p className="mt-1 text-sm text-destructive">{listingsError}</p>}
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">History sync</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {historyState === 'idle' && '—'}
            {historyRunning && `${historyListingsProcessed.toLocaleString()} listings · ${historyRows.toLocaleString()} rows`}
            {(historyState === 'done' || historyState === 'error') && (
              <>{(historyStart != null ? formatElapsed(historyElapsed) : '')} · {historyRows.toLocaleString()} rows</>
            )}
          </p>
          {historyTotalListings != null && historyRunning && (
            <p className="mt-0.5 text-xs text-muted-foreground">{historyListingsProcessed.toLocaleString()} of {historyTotalListings.toLocaleString()} listings</p>
          )}
          {historyError && <p className="mt-1 text-sm text-destructive">{historyError}</p>}
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Photos sync</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {photosState === 'idle' && '—'}
            {photosRunning && `${photosPagesDone} pages · ${photosUpdated.toLocaleString()} updated`}
            {(photosState === 'done' || photosState === 'error') && (
              <>{(photosStart != null ? formatElapsed(photosElapsed) : '')} · {photosUpdated.toLocaleString()} updated</>
            )}
          </p>
          {photosPagesTotal != null && photosRunning && (
            <p className="mt-0.5 text-xs text-muted-foreground">Page {photosPagesDone} of {photosPagesTotal.toLocaleString()}</p>
          )}
          {photosError && <p className="mt-1 text-sm text-destructive">{photosError}</p>}
        </div>
      </div>
    </div>
  )
}
