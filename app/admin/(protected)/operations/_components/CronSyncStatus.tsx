'use client'

/**
 * CronSyncStatus — the full-sync cursor panel inside DashboardSyncPanel.
 *
 * 11F: migrated to the admin v2 language and moved here from
 * app/admin/(protected)/sync/, where it lived but had exactly ONE consumer —
 * the operations sync panel. /admin/sync never imported it.
 *
 * THE CADENCE IN THIS COPY WAS WRONG AND IS CORRECTED. It read "Progress of the
 * 15-minute cron job" and "Runs automatically every 15 min." This component
 * tracks the cursor from app/actions/sync-full-cron, whose runOneFullSyncChunk
 * is called by /api/cron/sync-full — and vercel.json schedules that
 * `0 2 * * 0`: WEEKLY, Sundays at 02:00. The 15-minute job is
 * /api/cron/sync-delta (`3,18,33,48 * * * *`), which runs runDeltaSync, a
 * different path with a different cursor. A broker reading this panel would
 * have waited fifteen minutes for a run that comes once a week.
 *
 * Cadences come from vercel.json, never from prose (CLAUDE.md §5) — so the two
 * sentences below name the schedule that file actually carries.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { runOneFullSyncChunk } from '@/app/actions/sync-full-cron'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import { Button, SectionHead } from '@/components/admin/v2'

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

const TILE: React.CSSProperties = {
  background: 'var(--a-inset)',
  borderRadius: 'var(--a-r-lg)',
  padding: 'var(--a-s3)',
}
const EYEBROW: React.CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--a-text-2)',
}
const VALUE: React.CSSProperties = {
  marginTop: 4,
  fontWeight: 600,
  color: 'var(--a-text)',
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
      <div
        className="av2-pane"
        style={{ borderColor: 'var(--a-warn)', background: 'var(--a-warn-wash)' }}
      >
        <SectionHead>Cron sync status</SectionHead>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
          Cannot read progress: {cursor.error}. Run the{' '}
          <code style={{ fontFamily: 'var(--a-font-mono)' }}>sync_cursor</code> migration.
        </p>
      </div>
    )
  }

  const isIdle = cursor?.phase === 'idle'
  const phaseLabel =
    cursor?.phase === 'listings'
      ? 'Listings'
      : cursor?.phase === 'history'
        ? 'History'
        : 'Idle (next run starts listings)'

  return (
    <div className="av2-pane">
      <SectionHead>Cron sync status</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Progress of the weekly full sync. Use <strong>Run one chunk now</strong> to trigger a step
        immediately.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div style={TILE}>
          <p style={EYEBROW}>Phase</p>
          <p style={VALUE}>{phaseLabel}</p>
        </div>
        {cursor?.phase === 'listings' && (
          <div style={TILE}>
            <p style={EYEBROW}>Listing page</p>
            <p style={{ ...VALUE, fontFamily: 'var(--a-font-mono)' }} className="a-num">
              {cursor.nextListingPage.toLocaleString()}
              {cursor.totalListingPages != null
                ? ` of ${cursor.totalListingPages.toLocaleString()}`
                : ''}
            </p>
          </div>
        )}
        {cursor?.phase === 'history' && (
          <div style={TILE}>
            <p style={EYEBROW}>History offset</p>
            <p style={{ ...VALUE, fontFamily: 'var(--a-font-mono)' }} className="a-num">
              {cursor.nextHistoryOffset.toLocaleString()}
            </p>
          </div>
        )}
        <div style={TILE}>
          <p style={EYEBROW}>Last updated</p>
          <p style={{ marginTop: 4, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            {formatTime(cursor?.updatedAt ?? null)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleRunNow} disabled={running}>
          {running ? 'Running…' : 'Run one chunk now'}
        </Button>
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {isIdle
            ? 'Next run will start a new full cycle (listings then history).'
            : 'Runs automatically every Sunday at 2am.'}
        </span>
      </div>

      {lastResult && (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{lastResult}</p>
      )}
    </div>
  )
}
