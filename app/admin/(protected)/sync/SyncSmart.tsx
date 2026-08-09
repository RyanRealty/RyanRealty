'use client'

/**
 * SyncSmart — primary Smart Sync control on /admin/sync.
 *
 * 11F residual: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — sync control logic,
 * API calls, status polling, error strings, compact mode, and all props stay.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { getSyncStatus, runOneSyncChunk, setSyncPaused, setSyncAbortRequested } from '@/app/actions/sync-full-cron'
import type { SyncStatus, RunOneChunkResult } from '@/app/actions/sync-full-cron'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'

const POLL_INTERVAL_MS = 2500
const CHUNK_LOOP_DELAY_MS = 200
// These must stay in sync with LISTING_PAGES_PER_RUN and HISTORY_BATCH_LIMIT in app/actions/sync-full-cron.ts
const LISTING_PAGES_PER_RUN = 5
const HISTORY_BATCH_LIMIT = 30

const panelStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
  color: 'var(--a-text)',
  fontSize: 'var(--a-text-sm)',
}
const panelCompactStyle: CSSProperties = {
  ...panelStyle,
  background: 'var(--a-inset)',
}
const titleStyle: CSSProperties = {
  fontSize: 'var(--a-text-lg)',
  fontWeight: 500,
  color: 'var(--a-text)',
}
const quietBodyStyle: CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
}
const quietMetaStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
}
const warnPanelStyle: CSSProperties = {
  border: '1px solid var(--a-warn)',
  borderRadius: 'var(--a-r-md)',
  background: 'var(--a-warn-wash)',
  color: 'var(--a-text)',
  fontSize: 'var(--a-text-sm)',
}
const dangerPanelStyle: CSSProperties = {
  border: '1px solid var(--a-danger)',
  borderRadius: 'var(--a-r-md)',
  background: 'var(--a-danger-wash)',
  color: 'var(--a-danger)',
  fontSize: 'var(--a-text-sm)',
}
const okPanelStyle: CSSProperties = {
  border: '1px solid var(--a-ok)',
  borderRadius: 'var(--a-r-md)',
  background: 'var(--a-ok-wash)',
  color: 'var(--a-ok)',
  fontSize: 'var(--a-text-sm)',
}
const codeStyle: CSSProperties = {
  borderRadius: 'var(--a-r-sm)',
  background: 'var(--a-warn-wash)',
  padding: '0 4px',
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-xs)',
}
const spinnerStyle: CSSProperties = {
  borderColor: 'var(--a-ok)',
  borderTopColor: 'transparent',
}
const dangerTextStyle: CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-danger)',
}

function formatElapsed(isoStart: string, nowMs: number): string {
  const start = new Date(isoStart).getTime()
  const s = Math.floor((nowMs - start) / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '<1s'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

type Props = {
  initialStatus: SyncStatus | null
  /** When false, Smart Sync is disabled (no SPARK_API_KEY). Site still works using Supabase data. */
  sparkConfigured?: boolean
  /** When true, omit heading and intro text (for embedding in step-by-step sync page). */
  compact?: boolean
}

export default function SyncSmart({ initialStatus, sparkConfigured = true, compact = false }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<SyncStatus | null>(initialStatus)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controlPending, setControlPending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState<number | null>(null)
  const [etaLabel, setEtaLabel] = useState<string | null>(null)
  useEffect(() => {
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    setMounted(true)
  }, [])

  const refresh = useCallback(async () => {
    const next = await getSyncStatus()
    setStatus(next)
    return next
  }, [])

  const runInProgress = !!status?.cursor?.runStartedAt
  const paused = !!status?.cursor?.paused && !runInProgress
  const syncInProgress = runInProgress || syncing
  const stopRequestedRef = useRef(false)
  const avgChunkMsRef = useRef<number | null>(null)
  const chunkCountRef = useRef(0)
  const totalHistoryListingsRef = useRef<number | null>(null)

  function updateEta(nextStatus: SyncStatus | null, lastResult?: RunOneChunkResult) {
    const avgMs = avgChunkMsRef.current
    if (!nextStatus?.cursor || avgMs == null) {
      setEtaLabel(null)
      return
    }
    const cursor = nextStatus.cursor
    let remainingChunks: number | null = null

    if (cursor.phase === 'listings') {
      const totalPages = cursor.totalListingPages
      if (totalPages && totalPages > 0) {
        const currentPage = cursor.nextListingPage ?? 1
        const pagesDone = Math.max(0, Math.min(totalPages, currentPage - 1))
        const remainingPages = Math.max(0, totalPages - pagesDone)
        remainingChunks = Math.ceil(remainingPages / LISTING_PAGES_PER_RUN)
      }
    } else if (cursor.phase === 'refresh_active_pending') {
      const totalPages = cursor.totalListingPages
      if (totalPages && totalPages > 0) {
        const currentPage = cursor.nextListingPage ?? 1
        const remainingPages = Math.max(0, totalPages - currentPage + 1)
        remainingChunks = remainingPages
      }
    } else if (cursor.phase === 'history') {
      if (lastResult?.totalListings != null && lastResult.totalListings > 0) {
        totalHistoryListingsRef.current = lastResult.totalListings
      }
      const totalListings = totalHistoryListingsRef.current
      if (totalListings && totalListings > 0) {
        const processed = cursor.nextHistoryOffset ?? 0
        const remainingListings = Math.max(0, totalListings - processed)
        remainingChunks = Math.ceil(remainingListings / HISTORY_BATCH_LIMIT)
      }
    }

    if (!remainingChunks || !Number.isFinite(remainingChunks)) {
      setEtaLabel(null)
      return
    }
    const totalMs = remainingChunks * avgMs
    const seconds = Math.round(totalMs / 1000)
    setEtaLabel(formatEta(seconds))
  }

  // Poll status so elapsed time and run counts update while sync is running
  useEffect(() => {
    if (!syncInProgress || paused) return
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [syncInProgress, paused, refresh])

  async function handleSmartSync() {
    setSyncing(true)
    setError(null)
    stopRequestedRef.current = false
    avgChunkMsRef.current = null
    chunkCountRef.current = 0
    totalHistoryListingsRef.current = null
    setEtaLabel(null)
    try {
      while (true) {
        const chunkStart = performance.now()
        const result = await runOneSyncChunk()
        const chunkMs = performance.now() - chunkStart
        chunkCountRef.current += 1
        avgChunkMsRef.current =
          avgChunkMsRef.current == null
            ? chunkMs
            : (avgChunkMsRef.current * (chunkCountRef.current - 1) + chunkMs) / chunkCountRef.current

        const next = await refresh()
        updateEta(next, result)
        if (!result.ok) {
          setError(result.error ?? result.message)
          break
        }
        if (result.done) {
          if (result.paused) {
            setError(null)
          }
          break
        }
        if (stopRequestedRef.current) break
        await new Promise((r) => setTimeout(r, CHUNK_LOOP_DELAY_MS))
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      await refresh()
      router.refresh()
    } finally {
      setSyncing(false)
      avgChunkMsRef.current = null
      chunkCountRef.current = 0
      totalHistoryListingsRef.current = null
      setEtaLabel(null)
    }
  }

  async function handlePause() {
    setControlPending(true)
    setError(null)
    try {
      const res = await setSyncPaused(true)
      if (!res.ok) setError(res.error ?? 'Failed to pause')
      await refresh()
      router.refresh()
    } finally {
      setControlPending(false)
    }
  }

  async function handleStop() {
    stopRequestedRef.current = true
    setControlPending(true)
    setError(null)
    try {
      const res = await setSyncAbortRequested()
      if (!res.ok) {
        setError(res.error ?? 'Failed to stop')
      } else {
        await runOneSyncChunk()
      }
      await refresh()
      router.refresh()
    } finally {
      setControlPending(false)
    }
  }

  async function handleResume() {
    setControlPending(true)
    setError(null)
    try {
      const res = await setSyncPaused(false)
      if (!res.ok) setError(res.error ?? 'Failed to resume')
      await refresh()
      router.refresh()
    } finally {
      setControlPending(false)
    }
  }

  const disabled = syncing || runInProgress || !sparkConfigured

  return (
    <div className={compact ? 'p-4' : 'p-6'} style={compact ? panelCompactStyle : panelStyle}>
      {!compact && (
        <>
          <h2 style={titleStyle}>Sync</h2>
          <p className="mt-1" style={quietBodyStyle}>
            Run a full sync to keep listing data updated. You can pause or stop any running sync.
          </p>
        </>
      )}

      {!sparkConfigured && (
        <div className="mt-4 px-4 py-3" style={warnPanelStyle}>
          <strong>Spark API key not set.</strong> Add <code style={codeStyle}>SPARK_API_KEY</code> to <code style={codeStyle}>.env.local</code> (and Vercel) to run sync. You can still browse and review the site using existing data in the database.
        </div>
      )}

      {/* Last error from previous run (stored on cursor when Spark/sync fails) */}
      {status?.cursor?.error && (
        <div className="mt-4 px-4 py-3" style={dangerPanelStyle}>
          <p style={{ fontWeight: 500 }}>Last error</p>
          <p className="mt-1">{status.cursor.error}</p>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-xs)' }}>
            Sync stopped. Fix the issue and run Smart Sync again to resume.
          </p>
        </div>
      )}

      {(runInProgress || syncing) && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3" style={okPanelStyle}>
            <span className="flex items-center gap-2" style={{ fontWeight: 600 }}>
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2"
                style={spinnerStyle}
                aria-hidden
              />
              {status?.cursor?.phase === 'refresh_active_pending'
                ? 'Refresh active & pending in progress'
                : 'Sync in progress'}
            </span>
            <span suppressHydrationWarning>
              Elapsed: {mounted && nowMs != null && status?.cursor?.runStartedAt ? formatElapsed(status.cursor.runStartedAt, nowMs) : syncing ? '…' : '—'}
            </span>
            <span title={status?.cursor?.phase === 'refresh_active_pending' ? 'Listings refreshed so far (active & pending only).' : 'Listings upserted in this run (Listings phase only).'}>
              {status?.cursor?.phase === 'refresh_active_pending' ? 'Listings refreshed: ' : 'Listings this run: '}
              {status?.cursor?.runListingsUpserted?.toLocaleString() ?? '…'}
            </span>
            {status?.cursor?.phase === 'refresh_active_pending' ? (
              <span style={{ fontSize: 'var(--a-text-xs)' }}>History not used for this run</span>
            ) : (
              <span title="History rows inserted in this run.">
                History this run: {status?.cursor?.runHistoryRows?.toLocaleString() ?? '…'}
              </span>
            )}
            <span style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500 }}>
              Phase: {status?.cursor?.phase === 'listings' ? 'Listings' : status?.cursor?.phase === 'history' ? 'History' : status?.cursor?.phase === 'refresh_active_pending' ? 'Refresh active & pending' : '…'}
            </span>
            <span style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500 }}>
              Est. time remaining: {etaLabel ?? 'Calculating…'}
            </span>
          </div>
          <p style={quietMetaStyle}>
            Progress updates after each chunk. <strong>Pause</strong> stops after the current chunk; <strong>Stop</strong> exits immediately.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="quiet"
              onClick={handlePause}
              disabled={controlPending}
            >
              {controlPending ? '…' : 'Pause'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleStop}
              disabled={controlPending}
            >
              {controlPending ? '…' : 'Stop'}
            </Button>
          </div>
        </div>
      )}

      {paused && (
        <div className="mt-4 flex flex-wrap items-center gap-3 px-4 py-3" style={warnPanelStyle}>
          <span style={{ fontWeight: 500, color: 'var(--a-warn)' }}>Sync paused</span>
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
            Cron and Smart Sync will not run until you resume.
          </span>
          <Button
            type="button"
            variant="quiet"
            onClick={handleResume}
            disabled={controlPending}
          >
            {controlPending ? '…' : 'Resume'}
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleSmartSync}
          disabled={disabled}
          title={!sparkConfigured ? 'Add SPARK_API_KEY to run sync' : undefined}
        >
          {syncing
            ? 'Running…'
            : runInProgress
              ? status?.cursor?.phase === 'refresh_active_pending'
                ? 'Refreshing active & pending…'
                : 'Sync in progress…'
              : !sparkConfigured
                ? 'Smart Sync (key required)'
                : 'Smart Sync'}
        </Button>
        {status?.cursor?.phase !== 'idle' && status?.cursor?.phase !== 'refresh_active_pending' && !runInProgress && !paused && (
          <span style={quietMetaStyle}>
            Next run will resume from {status?.cursor?.phase === 'listings' ? `listings page ${status?.cursor?.nextListingPage}` : 'history'}.
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3" style={dangerTextStyle}>{error}</p>
      )}
      {compact && (
        <span className="mt-2 block" style={quietMetaStyle}>
          Pause/Stop apply to both Smart Sync and Refresh active.
        </span>
      )}
    </div>
  )
}
