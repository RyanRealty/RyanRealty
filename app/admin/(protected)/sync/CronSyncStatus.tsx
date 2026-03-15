'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { runOneFullSyncChunk } from '@/app/actions/sync-full-cron'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import { Button } from "@/components/ui/button"

type Props = { cursor: SyncCursor | null }

function formatTime(iso: string | null): string {
  if (!iso) return 'â€”'
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
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
        <h2 className="text-lg font-semibold text-foreground">Cron sync status</h2>
        <p className="mt-2 text-sm text-warning">
          Cannot read progress: {cursor.error}. Run the <code className="rounded bg-warning/15 px-1">sync_cursor</code> migration.
        </p>
      </div>
    )
  }

  const isIdle = cursor?.phase === 'idle'
  const phaseLabel = cursor?.phase === 'listings' ? 'Listings' : cursor?.phase === 'history' ? 'History' : 'Idle (next run starts listings)'

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Cron sync status</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Progress of the 15â€‘minute cron job. Use <strong>Run one chunk now</strong> to trigger a step immediately.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phase</p>
          <p className="mt-1 font-semibold text-foreground">{phaseLabel}</p>
        </div>
        {cursor?.phase === 'listings' && (
          <>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Listing page</p>
              <p className="mt-1 font-mono font-semibold text-foreground">
                {cursor.nextListingPage.toLocaleString()}
                {cursor.totalListingPages != null ? ` of ${cursor.totalListingPages.toLocaleString()}` : ''}
              </p>
            </div>
          </>
        )}
        {cursor?.phase === 'history' && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">History offset</p>
            <p className="mt-1 font-mono font-semibold text-foreground">{cursor.nextHistoryOffset.toLocaleString()}</p>
          </div>
        )}
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last updated</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatTime(cursor?.updatedAt ?? null)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleRunNow}
          disabled={running}
          className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/75 disabled:opacity-50"
        >
          {running ? 'Runningâ€¦' : 'Run one chunk now'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {isIdle ? 'Next cron run will start a new full cycle (listings then history).' : 'Runs automatically every 15 min.'}
        </span>
      </div>

      {lastResult && (
        <p className="mt-3 text-sm text-muted-foreground">{lastResult}</p>
      )}
    </div>
  )
}
