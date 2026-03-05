'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { runOneFullSyncChunk } from '../../actions/sync-full-cron'
import type { SyncCursor } from '../../actions/sync-full-cron'

type Props = { cursor: SyncCursor | null }

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}

export default function CronSyncStatus({ cursor }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  async function handleRunNow() {
    setRunning(true)
    setLastResult(null)
    try {
      const result = await runOneFullSyncChunk()
      setLastResult(result.ok ? result.message : (result.error ?? result.message))
      router.refresh()
    } catch (e) {
      setLastResult(e instanceof Error ? e.message : 'Failed')
      router.refresh()
    } finally {
      setRunning(false)
    }
  }

  if (cursor?.error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-semibold text-amber-900">Cron sync status</h2>
        <p className="mt-2 text-sm text-amber-800">
          Cannot read progress: {cursor.error}. Run the <code className="rounded bg-amber-100 px-1">sync_cursor</code> migration.
        </p>
      </div>
    )
  }

  const isIdle = cursor?.phase === 'idle'
  const phaseLabel = cursor?.phase === 'listings' ? 'Listings' : cursor?.phase === 'history' ? 'History' : 'Idle (next run starts listings)'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Cron sync status</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Progress of the 15‑minute cron job. Use <strong>Run one chunk now</strong> to trigger a step immediately.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Phase</p>
          <p className="mt-1 font-semibold text-zinc-900">{phaseLabel}</p>
        </div>
        {cursor?.phase === 'listings' && (
          <>
            <div className="rounded-lg bg-zinc-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Listing page</p>
              <p className="mt-1 font-mono font-semibold text-zinc-900">
                {cursor.nextListingPage.toLocaleString()}
                {cursor.totalListingPages != null ? ` of ${cursor.totalListingPages.toLocaleString()}` : ''}
              </p>
            </div>
          </>
        )}
        {cursor?.phase === 'history' && (
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">History offset</p>
            <p className="mt-1 font-mono font-semibold text-zinc-900">{cursor.nextHistoryOffset.toLocaleString()}</p>
          </div>
        )}
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Last updated</p>
          <p className="mt-1 text-sm text-zinc-700">{formatTime(cursor?.updatedAt ?? null)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRunNow}
          disabled={running}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run one chunk now'}
        </button>
        <span className="text-xs text-zinc-500">
          {isIdle ? 'Next cron run will start a new full cycle (listings then history).' : 'Runs automatically every 15 min.'}
        </span>
      </div>

      {lastResult && (
        <p className="mt-3 text-sm text-zinc-600">{lastResult}</p>
      )}
    </div>
  )
}
