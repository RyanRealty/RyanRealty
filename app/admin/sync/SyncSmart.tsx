'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSyncStatus, runSmartSync, setSyncPaused, setSyncAbortRequested, setCronEnabled } from '../../actions/sync-full-cron'
import type { SyncStatus } from '../../actions/sync-full-cron'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL_MS = 3000

function formatElapsed(isoStart: string): string {
  const start = new Date(isoStart).getTime()
  const s = Math.floor((Date.now() - start) / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

type Props = {
  initialStatus: SyncStatus | null
  /** When false, Smart Sync is disabled (no SPARK_API_KEY). Site still works using Supabase data. */
  sparkConfigured?: boolean
}

export default function SyncSmart({ initialStatus, sparkConfigured = true }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<SyncStatus | null>(initialStatus)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controlPending, setControlPending] = useState(false)
  const [mounted, setMounted] = useState(false)
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

  useEffect(() => {
    const inProgress = runInProgress || syncing || paused
    if (!inProgress) return
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runInProgress, syncing, paused, refresh])

  async function handleSmartSync() {
    setSyncing(true)
    setError(null)
    try {
      const result = await runSmartSync()
      if (!result.ok) {
        setError(result.error ?? result.message)
      }
      await refresh()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      await refresh()
      router.refresh()
    } finally {
      setSyncing(false)
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
    setControlPending(true)
    setError(null)
    try {
      const res = await setSyncAbortRequested()
      if (!res.ok) setError(res.error ?? 'Failed to stop')
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

  async function handleCronToggle() {
    const next = !status?.cursor?.cronEnabled
    setControlPending(true)
    setError(null)
    try {
      const res = await setCronEnabled(next)
      if (!res.ok) setError(res.error ?? `Failed to ${next ? 'enable' : 'disable'} cron`)
      await refresh()
      router.refresh()
    } finally {
      setControlPending(false)
    }
  }

  const disabled = syncing || runInProgress || !sparkConfigured
  const cronOn = !!status?.cursor?.cronEnabled

  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Sync</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Run one master sync with Smart Sync below, then enable the scheduled cron when ready. You can pause or stop any running sync.
      </p>

      {!sparkConfigured && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Spark API key not set.</strong> Add <code className="rounded bg-amber-100 px-1">SPARK_API_KEY</code> to <code className="rounded bg-amber-100 px-1">.env.local</code> (and Vercel) to run sync. You can still browse and review the site using existing data in the database.
        </div>
      )}

      {/* Cron master switch: off by default so you run one full sync first, then enable */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="text-sm font-medium text-zinc-700">
          Scheduled cron: {cronOn ? 'On' : 'Off'}
        </span>
        <button
          type="button"
          onClick={handleCronToggle}
          disabled={controlPending}
          className={cronOn
            ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50'
            : 'rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50'
          }
        >
          {controlPending ? '…' : cronOn ? 'Disable cron' : 'Enable cron'}
        </button>
        <span className="text-xs text-zinc-500">
          {cronOn ? 'Vercel cron will run sync on schedule.' : 'Cron is off. Run Smart Sync to do one full sync, then enable cron.'}
        </span>
      </div>

      {runInProgress && status?.cursor && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="font-medium text-emerald-800">Sync in progress</span>
            <span className="text-sm text-emerald-700" suppressHydrationWarning>
              Elapsed: {mounted && status.cursor.runStartedAt ? formatElapsed(status.cursor.runStartedAt) : '—'}
            </span>
            <span className="text-sm text-emerald-700" title="Listings upserted in this run (only increases during Listings phase). 0 can mean this run started in History phase, or listings chunks had no new/updated rows.">
              Listings: {status.cursor.runListingsUpserted.toLocaleString()}
            </span>
            <span className="text-sm text-emerald-700" title="History rows inserted in this run. 0 can mean batches processed so far had no new history (e.g. listings already had history).">
              History rows: {status.cursor.runHistoryRows.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600">
              Phase: {status.cursor.phase === 'listings' ? 'Listings' : 'History'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            &quot;Listings&quot; and &quot;History rows&quot; are counts for <strong>this run only</strong>. Listings stops increasing once phase is History. 0 can mean: run started in History phase (no listings chunks this run), or chunks had no new/updated rows (e.g. already in DB or no history yet).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePause}
              disabled={controlPending}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {controlPending ? '…' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={controlPending}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              {controlPending ? '…' : 'Stop'}
            </button>
            <span className="text-xs text-zinc-500">
              Pause stops after the current chunk; stop exits immediately on the next check.
            </span>
          </div>
        </div>
      )}

      {paused && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="font-medium text-amber-800">Sync paused</span>
          <span className="text-sm text-amber-700">Cron and Smart Sync will not run until you resume.</span>
          <button
            type="button"
            onClick={handleResume}
            disabled={controlPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {controlPending ? '…' : 'Resume'}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSmartSync}
          disabled={disabled}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          title={!sparkConfigured ? 'Add SPARK_API_KEY to run sync' : undefined}
        >
          {syncing ? 'Starting…' : runInProgress ? 'Sync in progress…' : !sparkConfigured ? 'Smart Sync (key required)' : 'Smart Sync'}
        </button>
        {status?.cursor?.phase !== 'idle' && !runInProgress && !paused && (
          <span className="text-xs text-zinc-500">
            Next run will resume from {status?.cursor?.phase === 'listings' ? `listings page ${status?.cursor?.nextListingPage}` : 'history'}.
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
