'use client'

/**
 * RefreshActivePendingButton — chunked active+pending refresh on the advanced panel.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — startRefreshActivePending,
 * runOneSyncChunk, getSyncStatus, setSyncAbortRequested, the stop ref, the
 * chunk delay, router.refresh(), the "running elsewhere" latch and every string
 * are untouched. Primary action stays the default Button; Stop maps to
 * variant="danger" (the v2 solid for abort/destructive). Message/progress
 * colours map to var(--a-ok) / var(--a-danger) / var(--a-text-2).
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { startRefreshActivePending, runOneSyncChunk, getSyncStatus, setSyncAbortRequested } from '@/app/actions/sync-full-cron'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import { Button } from '@/components/admin/v2'

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
        <Button type="button" onClick={handleClick} disabled={buttonDisabled}>
          {loading ? 'Refreshing…' : refreshRunningElsewhere ? 'Refresh in progress' : 'Refresh active & pending'}
        </Button>
        {loading && (
          <Button type="button" variant="danger" onClick={handleStop} disabled={stopPending}>
            {stopPending ? 'Stopping…' : 'Stop'}
          </Button>
        )}
        {refreshRunningElsewhere && (
          <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Use Pause/Stop above to cancel.
          </span>
        )}
        {progress && loading && (
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{progress}</span>
        )}
      </div>
      {message && (
        <span
          style={{
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'success' ? 'var(--a-ok)' : 'var(--a-danger)',
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  )
}
