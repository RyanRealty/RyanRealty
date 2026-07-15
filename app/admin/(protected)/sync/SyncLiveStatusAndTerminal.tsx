'use client'

import { useEffect, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from '@/components/ui/button'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import { cn } from '@/lib/utils'

type TerminalSnapshot = {
  closedTotalInDb: number
  closedFinalizedCount: number
  closedNotFinalizedCount: number
  expiredTotalInDb: number
  expiredFinalizedCount: number
  expiredNotFinalizedCount: number
  withdrawnTotalInDb: number
  withdrawnFinalizedCount: number
  withdrawnNotFinalizedCount: number
  canceledTotalInDb: number
  canceledFinalizedCount: number
  canceledNotFinalizedCount: number
  terminalTotalInDb: number
  terminalFinalizedInDb: number
  terminalRemainingInDb: number
  terminalFinalizedPct: number
}

type LivePayload = {
  ok: boolean
  serverTime: string
  cursor: SyncCursor | null
  scope?: {
    fromYear: number
    toYear: number
    mode: 'explicit' | 'lookback' | 'all'
  }
  terminal: TerminalSnapshot
  warnings?: {
    listingsCountError?: string | null
    historyError?: string | null
  }
}

type YieldPayload = {
  ok: boolean
  sampled: number
  reachableCount: number
  withHistoryCount: number
  yieldPct: number
  reachablePct: number
  checkedAt: string
  note?: string | null
}

type Props = {
  initialCursor: SyncCursor | null
  initialTerminal: TerminalSnapshot
  embedded?: boolean
}

const LIVE_POLL_MS = 5000
const YIELD_POLL_MS = 180000
const RUN_ACTIVE_HEARTBEAT_MS = 120000

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    const day = Math.floor(h / 24)
    if (day > 0) return `${day} day${day !== 1 ? 's' : ''} ago`
    if (h > 0) return `${h} hour${h !== 1 ? 's' : ''} ago`
    if (m > 0) return `${m} min ago`
    return 'Just now'
  } catch {
    return '—'
  }
}

function formatElapsedFrom(startIso?: string | null): string {
  if (!startIso) return '—'
  try {
    const elapsed = Math.max(0, Date.now() - new Date(startIso).getTime())
    const s = Math.floor(elapsed / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  } catch {
    return '—'
  }
}

function isRecentlyActive(updatedAtIso?: string | null): boolean {
  if (!updatedAtIso) return false
  const updatedAtMs = new Date(updatedAtIso).getTime()
  if (!Number.isFinite(updatedAtMs)) return false
  return Date.now() - updatedAtMs <= RUN_ACTIVE_HEARTBEAT_MS
}

export default function SyncLiveStatusAndTerminal({ initialCursor, initialTerminal, embedded = false }: Props) {
  const [livePayload, setLivePayload] = useState<LivePayload | null>(null)
  const [yieldPayload, setYieldPayload] = useState<YieldPayload | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [yieldError, setYieldError] = useState<string | null>(null)
  const [controlBusy, setControlBusy] = useState(false)
  // Totals seed from the server-rendered snapshot (the page passes zero
  // placeholders) and are OVERWRITTEN by every live poll — the old setter-less
  // useState froze the zeros forever, so the panel showed 'Terminal in DB: 0' and
  // a green 'remaining 0' regardless of live data.
  const [fixedTotals, setFixedTotals] = useState(() => ({
    closedTotalInDb: initialTerminal.closedTotalInDb,
    expiredTotalInDb: initialTerminal.expiredTotalInDb,
    withdrawnTotalInDb: initialTerminal.withdrawnTotalInDb,
    canceledTotalInDb: initialTerminal.canceledTotalInDb,
    terminalTotalInDb: initialTerminal.terminalTotalInDb,
  }))
  const [finalizedCounts, setFinalizedCounts] = useState(() => ({
    closedFinalizedCount: initialTerminal.closedFinalizedCount,
    expiredFinalizedCount: initialTerminal.expiredFinalizedCount,
    withdrawnFinalizedCount: initialTerminal.withdrawnFinalizedCount,
    canceledFinalizedCount: initialTerminal.canceledFinalizedCount,
  }))

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/sync/live', { method: 'GET', cache: 'no-store' })
        if (!res.ok) throw new Error(`Live status request failed (${res.status})`)
        const payload = (await res.json()) as LivePayload
        if (!cancelled) {
          setLivePayload(payload)
          if (payload.terminal) {
            // Live totals win — the initialTerminal seed is an all-zero
            // placeholder from the page.
            setFixedTotals({
              closedTotalInDb: payload.terminal.closedTotalInDb,
              expiredTotalInDb: payload.terminal.expiredTotalInDb,
              withdrawnTotalInDb: payload.terminal.withdrawnTotalInDb,
              canceledTotalInDb: payload.terminal.canceledTotalInDb,
              terminalTotalInDb: payload.terminal.terminalTotalInDb,
            })
            setFinalizedCounts((prev) => ({
              closedFinalizedCount: Math.max(prev.closedFinalizedCount, payload.terminal.closedFinalizedCount),
              expiredFinalizedCount: Math.max(prev.expiredFinalizedCount, payload.terminal.expiredFinalizedCount),
              withdrawnFinalizedCount: Math.max(prev.withdrawnFinalizedCount, payload.terminal.withdrawnFinalizedCount),
              canceledFinalizedCount: Math.max(prev.canceledFinalizedCount, payload.terminal.canceledFinalizedCount),
            }))
          }
          setLiveError(null)
        }
      } catch (err) {
        if (!cancelled) setLiveError(err instanceof Error ? err.message : String(err))
      }
    }
    void poll()
    const id = setInterval(() => void poll(), LIVE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/sync/history-yield', { method: 'GET', cache: 'no-store' })
        if (!res.ok) throw new Error(`History yield request failed (${res.status})`)
        const payload = (await res.json()) as YieldPayload
        if (!cancelled) {
          setYieldPayload(payload)
          setYieldError(null)
        }
      } catch (err) {
        if (!cancelled) setYieldError(err instanceof Error ? err.message : String(err))
      }
    }
    void poll()
    const id = setInterval(() => void poll(), YIELD_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const cursor = livePayload?.cursor ?? initialCursor
  const terminal: TerminalSnapshot = useMemo(() => {
    const closedNotFinalizedCount = Math.max(0, fixedTotals.closedTotalInDb - finalizedCounts.closedFinalizedCount)
    const expiredNotFinalizedCount = Math.max(0, fixedTotals.expiredTotalInDb - finalizedCounts.expiredFinalizedCount)
    const withdrawnNotFinalizedCount = Math.max(0, fixedTotals.withdrawnTotalInDb - finalizedCounts.withdrawnFinalizedCount)
    const canceledNotFinalizedCount = Math.max(0, fixedTotals.canceledTotalInDb - finalizedCounts.canceledFinalizedCount)
    const terminalFinalizedInDb =
      finalizedCounts.closedFinalizedCount +
      finalizedCounts.expiredFinalizedCount +
      finalizedCounts.withdrawnFinalizedCount +
      finalizedCounts.canceledFinalizedCount
    const terminalRemainingInDb =
      closedNotFinalizedCount +
      expiredNotFinalizedCount +
      withdrawnNotFinalizedCount +
      canceledNotFinalizedCount
    const terminalFinalizedPct =
      fixedTotals.terminalTotalInDb > 0
        ? Math.min(100, Math.round((terminalFinalizedInDb / fixedTotals.terminalTotalInDb) * 1000) / 10)
        : 0
    return {
      closedTotalInDb: fixedTotals.closedTotalInDb,
      closedFinalizedCount: finalizedCounts.closedFinalizedCount,
      closedNotFinalizedCount,
      expiredTotalInDb: fixedTotals.expiredTotalInDb,
      expiredFinalizedCount: finalizedCounts.expiredFinalizedCount,
      expiredNotFinalizedCount,
      withdrawnTotalInDb: fixedTotals.withdrawnTotalInDb,
      withdrawnFinalizedCount: finalizedCounts.withdrawnFinalizedCount,
      withdrawnNotFinalizedCount,
      canceledTotalInDb: fixedTotals.canceledTotalInDb,
      canceledFinalizedCount: finalizedCounts.canceledFinalizedCount,
      canceledNotFinalizedCount,
      terminalTotalInDb: fixedTotals.terminalTotalInDb,
      terminalFinalizedInDb,
      terminalRemainingInDb,
      terminalFinalizedPct,
    }
  }, [finalizedCounts, fixedTotals])
  const hasRunMarker = !!cursor?.runStartedAt
  const recentlyActive = isRecentlyActive(cursor?.updatedAt)
  const liveRunInProgress = hasRunMarker && recentlyActive && (cursor?.phase === 'history' || cursor?.phase === 'listings')
  const staleRunMarker = hasRunMarker && !recentlyActive
  const serverTick = livePayload?.serverTime ?? null
  const scopeLabel = livePayload?.scope
    ? `${livePayload.scope.fromYear}-${livePayload.scope.toYear} (${livePayload.scope.mode})`
    : 'Unavailable'
  const runStateLabel = liveRunInProgress ? 'Running' : staleRunMarker ? 'Stale marker' : 'Idle'
  const runStateClass = liveRunInProgress ? 'text-success' : staleRunMarker ? 'text-warning' : 'text-muted-foreground'
  const pollStatus = useMemo(
    () => (liveError ? `Live polling error: ${liveError}` : `Live polling every ${Math.round(LIVE_POLL_MS / 1000)}s`),
    [liveError]
  )

  async function updateTerminalRun(action: 'start' | 'stop') {
    try {
      setControlBusy(true)
      const res = await fetch('/api/admin/sync/terminal-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Terminal control failed (${res.status})`)
      const next = await fetch('/api/admin/sync/live', { method: 'GET', cache: 'no-store' })
      if (next.ok) {
        const payload = (await next.json()) as LivePayload
        setLivePayload(payload)
      }
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : String(err))
    } finally {
      setControlBusy(false)
    }
  }

  return (
    <>
      <section
        className={cn(
          "rounded-lg border border-border bg-card p-5 shadow-sm",
          !embedded && "mt-6",
          embedded && "mt-0 border-0 bg-transparent p-0 shadow-none"
        )}
        aria-labelledby="live-sync-heading"
      >
        <h2 id="live-sync-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live sync status</h2>
        {!cursor ? (
          <p className="mt-2 text-sm text-warning">Sync cursor unavailable.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Cron enabled</p>
                <p className={`mt-0.5 font-mono text-sm font-medium ${cursor.cronEnabled ? 'text-success' : 'text-warning'}`}>
                  {cursor.cronEnabled ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phase</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">
                  {cursor.phase === 'listings' ? 'Listings' : cursor.phase === 'history' ? 'History' : cursor.phase === 'refresh_active_pending' ? 'Refresh active & pending' : 'Idle'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Run started</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{cursor.runStartedAt ? formatDateTime(cursor.runStartedAt) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Elapsed</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{cursor.runStartedAt ? formatElapsedFrom(cursor.runStartedAt) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last activity</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">
                  {cursor.updatedAt ? `${formatDateTime(cursor.updatedAt)} (${relativeTime(cursor.updatedAt)})` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">History rows this run</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{cursor.runHistoryRows.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Listings this run</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{cursor.runListingsUpserted.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Server tick</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{serverTick ? `${formatDateTime(serverTick)} (${relativeTime(serverTick)})` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Run state</p>
                <p className={`mt-0.5 font-mono text-sm font-medium ${runStateClass}`}>{runStateLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Effective terminal scope</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{scopeLabel}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void updateTerminalRun('start')}
                disabled={controlBusy || liveRunInProgress}
              >
                {controlBusy ? 'Working...' : 'Start terminal history'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void updateTerminalRun('stop')}
                disabled={controlBusy || !liveRunInProgress}
              >
                Stop terminal history
              </Button>
            </div>
            {cursor.error && <p className="mt-3 text-sm text-destructive">{cursor.error}</p>}
            {!cursor.error && liveRunInProgress && <p className="mt-3 text-sm text-success">Sync is currently running.</p>}
            {!cursor.error && staleRunMarker && (
              <p className="mt-3 text-sm text-warning">
                Run marker is stale. Last activity is older than {Math.round(RUN_ACTIVE_HEARTBEAT_MS / 60000)} minutes.
              </p>
            )}
            {!cursor.error && !liveRunInProgress && !staleRunMarker && (
              <p className="mt-3 text-sm text-muted-foreground">No run active right now.</p>
            )}
            <p className={`mt-2 text-xs ${liveError ? 'text-warning' : 'text-muted-foreground'}`}>{pollStatus}</p>
            {livePayload?.warnings?.listingsCountError && (
              <p className="mt-1 text-xs text-warning">{livePayload.warnings.listingsCountError}</p>
            )}
          </>
        )}
      </section>

      <section
        className={cn(
          "rounded-lg border border-border bg-card p-5 shadow-sm",
          embedded ? "mt-4" : "mt-6"
        )}
        aria-labelledby="history-yield-heading"
      >
        <h2 id="history-yield-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live history yield</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Sampled listings</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{yieldPayload?.sampled?.toLocaleString?.() ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spark reachable</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {yieldPayload ? `${yieldPayload.reachableCount.toLocaleString()} (${yieldPayload.reachablePct.toFixed(1)}%)` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Listings with history</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {yieldPayload ? `${yieldPayload.withHistoryCount.toLocaleString()} (${yieldPayload.yieldPct.toFixed(1)}%)` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last checked</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">
              {yieldPayload?.checkedAt ? `${formatDateTime(yieldPayload.checkedAt)} (${relativeTime(yieldPayload.checkedAt)})` : '—'}
            </p>
          </div>
        </div>
        {yieldPayload?.note && <p className="mt-2 text-xs text-warning">{yieldPayload.note}</p>}
        {yieldError && <p className="mt-2 text-xs text-warning">History yield probe error: {yieldError}</p>}
        {!yieldError && <p className="mt-2 text-xs text-muted-foreground">Spark probe runs every {Math.round(YIELD_POLL_MS / 1000)}s.</p>}
      </section>

      <section
        className={cn(
          "rounded-lg border border-border bg-card p-5 shadow-sm",
          embedded ? "mt-4" : "mt-6"
        )}
        aria-labelledby="terminal-finalization-heading"
      >
        <h2 id="terminal-finalization-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Terminal history finalization</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Terminal in DB</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{terminal.terminalTotalInDb.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Terminal finalized</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-success">{terminal.terminalFinalizedInDb.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Terminal remaining</p>
            <p className={`mt-0.5 font-mono text-sm font-medium ${terminal.terminalRemainingInDb > 0 ? 'text-warning' : 'text-success'}`}>
              {terminal.terminalRemainingInDb.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Finalized %</p>
            <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{terminal.terminalFinalizedPct.toFixed(1)}%</p>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <Table className="min-w-full border-collapse text-sm">
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="py-1.5 pr-2 text-left font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Total</TableHead>
                <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Finalized</TableHead>
                <TableHead className="py-1.5 pl-2 text-right font-medium text-muted-foreground">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: 'Closed', total: terminal.closedTotalInDb, finalized: terminal.closedFinalizedCount, remaining: terminal.closedNotFinalizedCount },
                { label: 'Expired', total: terminal.expiredTotalInDb, finalized: terminal.expiredFinalizedCount, remaining: terminal.expiredNotFinalizedCount },
                { label: 'Withdrawn', total: terminal.withdrawnTotalInDb, finalized: terminal.withdrawnFinalizedCount, remaining: terminal.withdrawnNotFinalizedCount },
                { label: 'Canceled', total: terminal.canceledTotalInDb, finalized: terminal.canceledFinalizedCount, remaining: terminal.canceledNotFinalizedCount },
              ].map((row) => (
                <TableRow key={row.label} className="border-b border-border">
                  <TableCell className="py-1.5 pr-2 text-foreground">{row.label}</TableCell>
                  <TableCell className="py-1.5 px-2 text-right font-mono text-foreground">{row.total.toLocaleString()}</TableCell>
                  <TableCell className="py-1.5 px-2 text-right font-mono text-success">{row.finalized.toLocaleString()}</TableCell>
                  <TableCell className={`py-1.5 pl-2 text-right font-mono ${row.remaining > 0 ? 'text-warning' : 'text-success'}`}>{row.remaining.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-success transition-all" style={{ width: `${terminal.terminalFinalizedPct}%` }} aria-label="Terminal finalization progress" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Totals, finalized, and remaining update with each live poll.
        </p>
      </section>
    </>
  )
}
