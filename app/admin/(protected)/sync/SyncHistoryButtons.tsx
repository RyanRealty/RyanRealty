'use client'

/**
 * SyncHistoryButtons — listing history backfill controls on /admin/sync.
 *
 * 11F residual: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — run loop, year
 * scoping, abort, compact mode, and all props stay.
 */

import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { syncListingHistory } from '@/app/actions/sync-spark'
import type { SyncHistoryResult } from '@/app/actions/sync-spark'
import { useRouter } from 'next/navigation'
import { Button, TextField } from '@/components/admin/v2'

const BATCH_LIMIT = 50

const panelStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
  color: 'var(--a-text)',
  fontSize: 'var(--a-text-sm)',
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
const statCellStyle: CSSProperties = {
  borderRadius: 'var(--a-r-md)',
  background: 'var(--a-inset)',
  padding: 8,
}
const labelStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  color: 'var(--a-text-2)',
}
const figureStyle: CSSProperties = {
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-sm)',
  fontWeight: 600,
  color: 'var(--a-text)',
}
const dangerTextStyle: CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-danger)',
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

type RunMode = 'active' | 'closed' | null

type Props = { compact?: boolean }

export default function SyncHistoryButtons({ compact = false }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState<RunMode>(null)
  const [fromYear, setFromYear] = useState<string>('')
  const [toYear, setToYear] = useState<string>('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [listingsProcessed, setListingsProcessed] = useState(0)
  const [historyRowsUpserted, setHistoryRowsUpserted] = useState(0)
  const [totalListings, setTotalListings] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startRef = useRef(0)
  const abortedRef = useRef(false)

  // Elapsed ticker: only when running
  useEffect(() => {
    if (running === null) return
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [running])

  async function runLoop(activeAndPendingOnly: boolean) {
    const mode: RunMode = activeAndPendingOnly ? 'active' : 'closed'
    setRunning(mode)
    setError(null)
    setMessage(null)
    setListingsProcessed(0)
    setHistoryRowsUpserted(0)
    setTotalListings(null)
    startRef.current = Date.now() // hydration-safe — click handler, not render
    setElapsedMs(0)
    abortedRef.current = false

    let offset = 0
    let totalProcessed = 0
    let totalRows = 0

    const parsedFromYear = !activeAndPendingOnly && fromYear.trim() ? Number(fromYear.trim()) : undefined
    const parsedToYear = !activeAndPendingOnly && toYear.trim() ? Number(toYear.trim()) : undefined
    const terminalFromYear = Number.isFinite(parsedFromYear as number) && (parsedFromYear as number) > 0 ? Math.floor(parsedFromYear as number) : undefined
    const terminalToYear = Number.isFinite(parsedToYear as number) && (parsedToYear as number) > 0 ? Math.floor(parsedToYear as number) : undefined

    try {
      while (true) {
        if (abortedRef.current) {
          setMessage('Stopped by user.')
          break
        }
        const res: SyncHistoryResult = await syncListingHistory({
          limit: BATCH_LIMIT,
          offset,
          activeAndPendingOnly,
          terminalFromYear,
          terminalToYear,
        })
        if (res.totalListings != null) setTotalListings(res.totalListings)
        totalProcessed += res.listingsProcessed ?? 0
        totalRows += res.historyRowsUpserted ?? 0
        setListingsProcessed(totalProcessed)
        setHistoryRowsUpserted(totalRows)

        if (!res.success) {
          setError(res.error ?? res.message)
          setMessage(res.message)
          break
        }
        if (res.nextOffset == null) {
          setMessage(res.message ?? 'Complete.')
          break
        }
        offset = res.nextOffset
      }
    } finally {
      setRunning(null)
      router.refresh()
    }
  }

  function handleStop() {
    abortedRef.current = true
  }

  return (
    <div
      className={compact ? 'flex flex-wrap items-center gap-3' : 'mt-6 p-6'}
      style={compact ? undefined : panelStyle}
    >
      {!compact && (
        <>
          <h2 style={titleStyle}>Listing history sync</h2>
          <p className="mt-1" style={quietBodyStyle}>
            Backfill price/status history from Spark. Active & pending runs first; backfill closed/expired/withdrawn/canceled when you have time.
          </p>
        </>
      )}
      <div className={compact ? 'flex flex-wrap items-center gap-3' : 'mt-4 flex flex-wrap items-center gap-3'}>
        <Button
          type="button"
          onClick={() => runLoop(true)}
          disabled={running !== null}
        >
          {running === 'active' ? 'Running…' : 'Run all active listing histories'}
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => runLoop(false)}
          disabled={running !== null}
        >
          {running === 'closed' ? 'Running…' : 'Backfill closed / expired / withdrawn / canceled'}
        </Button>
        {running !== null && (
          <Button
            type="button"
            variant="danger"
            onClick={handleStop}
          >
            Stop
          </Button>
        )}
      </div>
      {(running === null || running === 'closed') && (
        <div className={compact ? 'w-full grid grid-cols-1 sm:grid-cols-2 gap-2' : 'mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'}>
          <TextField
            label="From year"
            type="number"
            placeholder="e.g. 2020"
            value={fromYear}
            onChange={(e) => setFromYear(e.target.value)}
            disabled={running !== null}
          />
          <TextField
            label="To year"
            type="number"
            placeholder="e.g. 2025"
            value={toYear}
            onChange={(e) => setToYear(e.target.value)}
            disabled={running !== null}
          />
        </div>
      )}
      {!compact && (
        <p className="mt-2" style={quietMetaStyle}>
          <strong>Active & pending:</strong> only listings that are active or pending. <strong>Backfill closed:</strong> includes closed, expired, withdrawn, and canceled listings. If you set years, terminal backfill is scoped to that year range.
        </p>
      )}
      {running !== null && (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div style={statCellStyle}>
            <p style={labelStyle}>Elapsed</p>
            <p style={figureStyle}>{formatElapsed(elapsedMs)}</p>
          </div>
          <div style={statCellStyle}>
            <p style={labelStyle}>Listings processed</p>
            <p style={figureStyle}>{listingsProcessed.toLocaleString()}</p>
          </div>
          <div style={statCellStyle}>
            <p style={labelStyle}>History rows stored</p>
            <p style={figureStyle}>{historyRowsUpserted.toLocaleString()}</p>
          </div>
          {totalListings != null && (
            <div style={statCellStyle}>
              <p style={labelStyle}>Total in scope</p>
              <p style={figureStyle}>{totalListings.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
      {message && (
        <p className="mt-3" style={error ? dangerTextStyle : quietBodyStyle}>{message}</p>
      )}
      {error && <p className="mt-1" style={dangerTextStyle}>{error}</p>}
    </div>
  )
}
