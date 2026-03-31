'use client'

import { useState, useRef, useEffect } from 'react'
import { syncListingHistory } from '@/app/actions/sync-spark'
import type { SyncHistoryResult } from '@/app/actions/sync-spark'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BATCH_LIMIT = 50

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
    startRef.current = Date.now()
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
    <div className={compact ? 'flex flex-wrap items-center gap-3' : 'mt-6 rounded-lg border border-border bg-card p-6 shadow-sm'}>
      {!compact && (
        <>
          <h2 className="text-lg font-semibold text-foreground">Listing history sync</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Backfill price/status history from Spark. Active & pending runs first; backfill closed/expired/withdrawn/canceled when you have time.
          </p>
        </>
      )}
      <div className={compact ? 'flex flex-wrap items-center gap-3' : 'mt-4 flex flex-wrap items-center gap-3'}>
        <Button
          type="button"
          onClick={() => runLoop(true)}
          disabled={running !== null}
          className="rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-success-foreground hover:bg-success/75 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running === 'active' ? 'Running…' : 'Run all active listing histories'}
        </Button>
        <Button
          type="button"
          onClick={() => runLoop(false)}
          disabled={running !== null}
          className="rounded-lg border-2 border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running === 'closed' ? 'Running…' : 'Backfill closed / expired / withdrawn / canceled'}
        </Button>
        {running !== null && (
          <Button
            type="button"
            onClick={handleStop}
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/15"
          >
            Stop
          </Button>
        )}
      </div>
      {(running === null || running === 'closed') && (
        <div className={compact ? 'w-full grid grid-cols-1 sm:grid-cols-2 gap-2' : 'mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'}>
          <div>
            <Label htmlFor="terminal-from-year" className="text-xs text-muted-foreground">From year</Label>
            <Input
              id="terminal-from-year"
              type="number"
              placeholder="e.g. 2020"
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
              disabled={running !== null}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="terminal-to-year" className="text-xs text-muted-foreground">To year</Label>
            <Input
              id="terminal-to-year"
              type="number"
              placeholder="e.g. 2025"
              value={toYear}
              onChange={(e) => setToYear(e.target.value)}
              disabled={running !== null}
              className="mt-1"
            />
          </div>
        </div>
      )}
      {!compact && (
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>Active & pending:</strong> only listings that are active or pending. <strong>Backfill closed:</strong> includes closed, expired, withdrawn, and canceled listings. If you set years, terminal backfill is scoped to that year range.
        </p>
      )}
      {running !== null && (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs font-medium text-muted-foreground">Elapsed</p>
            <p className="font-mono text-sm font-semibold text-foreground">{formatElapsed(elapsedMs)}</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs font-medium text-muted-foreground">Listings processed</p>
            <p className="font-mono text-sm font-semibold text-foreground">{listingsProcessed.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs font-medium text-muted-foreground">History rows stored</p>
            <p className="font-mono text-sm font-semibold text-foreground">{historyRowsUpserted.toLocaleString()}</p>
          </div>
          {totalListings != null && (
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs font-medium text-muted-foreground">Total in scope</p>
              <p className="font-mono text-sm font-semibold text-foreground">{totalListings.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
      {message && (
        <p className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
      )}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}
