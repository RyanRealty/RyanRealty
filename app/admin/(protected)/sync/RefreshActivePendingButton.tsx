'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { startRefreshActivePending, runOneSyncChunk, getSyncStatus, setSyncAbortRequested } from '@/app/actions/sync-full-cron'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import { Button } from "@/components/ui/button"

const CHUNK_DELAY_MS = 200

type Props = {
  /** When true, a sync run is in progress (from server). */
  runInProgress?: boolean
  /** Current phase from sync_cursor so we can show "Refresh in progress" when user returns. */
  syncPhase?: SyncCursor['phase'] | null
}

export default function RefreshActivePendingButton({ runInProgress = false, syncPhase = null }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [stopPending, setStopPending] = useState(false)
  const stopRequestedRef = useRef(false)

  async function handleClick() {
    setLoading(true)
    setMessage(null)
    setProgress(null)
    stopRequestedRef.current = false

    try {
      const startRes = await startRefreshActivePending()
      if (!startRes.ok) {
        setMessage({ type: 'error', text: startRes.error ?? 'Failed to start' })
        setLoading(false)
        return
      }

      setProgress('Starting…')

      while (true) {
        const result = await runOneSyncChunk()
        const status = await getSyncStatus()
        const cursor = status?.cursor
        const upserted = cursor?.runListingsUpserted ?? 0
        if (cursor?.phase === 'refresh_active_pending' && upserted > 0) {
          setProgress(`${upserted} listings upserted so far…`)
        } else if (result.message) {
          setProgress(result.message)
        }

        if (!result.ok) {
          setMessage({ type: 'error', text: result.error ?? result.message ?? 'Refresh failed' })
          break
        }
        if (result.done) {
          const isWarning = result.message?.includes('No listings') ?? false
          setMessage({
            type: isWarning ? 'error' : 'success',
            text: result.message ?? 'Done.',
          })
          break
        }
        if (stopRequestedRef.current) break
        await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS))
      }

      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      const friendly = /failed to fetch|load failed|networkerror/i.test(msg)
        ? 'Network error. Check your connection and that the dev server is running (npm run dev).'
        : msg
      setMessage({ type: 'error', text: friendly })
      router.refresh()
    } finally {
      setLoading(false)
      setProgress(null)
      stopRequestedRef.current = false
    }
  }

  async function handleStop() {
    stopRequestedRef.current = true
    setStopPending(true)
    try {
      await setSyncAbortRequested()
      await runOneSyncChunk()
    } finally {
      setStopPending(false)
    }
  }

  const refreshRunningElsewhere = runInProgress && syncPhase === 'refresh_active_pending' && !loading
  const buttonDisabled = loading || refreshRunningElsewhere

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleClick}
          disabled={buttonDisabled}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : refreshRunningElsewhere ? 'Refresh in progress' : 'Refresh active & pending'}
        </Button>
        {loading && (
          <Button
            type="button"
            onClick={handleStop}
            disabled={stopPending}
            className="rounded-lg border-2 border-destructive bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
          >
            {stopPending ? 'Stopping…' : 'Stop'}
          </Button>
        )}
        {refreshRunningElsewhere && (
          <span className="text-xs text-muted-foreground">Use Pause/Stop above to cancel.</span>
        )}
        {progress && loading && (
          <span className="text-sm text-muted-foreground">{progress}</span>
        )}
      </div>
      {message && (
        <span className={message.type === 'success' ? 'text-sm text-success' : 'text-sm text-destructive'}>
          {message.text}
        </span>
      )}
    </div>
  )
}
