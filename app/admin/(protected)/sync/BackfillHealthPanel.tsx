'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

type BackfillHealthPayload = {
  ok: boolean
  checkedAt: string
  status: {
    state: 'running' | 'stalled' | 'idle' | 'complete'
    isLikelyRunning: boolean
    isStalled: boolean
  }
  cursor: {
    phase: string
    updatedAt: string | null
    runStartedAt: string | null
    error: string | null
    minutesSinceUpdate: number | null
  }
  yearCursor: {
    currentYear: number | null
    phase: string | null
    nextHistoryOffset: number | null
    totalListings: number | null
    updatedAt: string | null
    minutesSinceUpdate: number | null
  }
  totals: {
    totalListings: number
    totalHistoryRows: number
    finalizedTerminalListings: number
    verifiedFullHistoryListings: number
    finalizedUnverifiedListings: number
    terminalRemainingListings: number
    terminalFinalizedBreakdown: {
      closed: number
      expired: number
      withdrawn: number
      canceled: number
    }
  }
  integrity: {
    historyFinalizedDefinition: string
    hasListingsCountError: boolean
    hasHistoryCountError: boolean
    listingsCountError: string | null
    historyCountError: string | null
  }
  mediaCoverage: {
    listingPhotosRows: number | null
    listingVideosRows: number | null
    listingAgentsRows: number | null
    openHousesRows: number | null
    statusHistoryRows: number | null
    priceHistoryRows: number | null
    allAuxiliaryTablesPopulated: boolean
  }
}

const POLL_MS = 15000

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—'
  return value.toLocaleString()
}

function toBadgeVariant(state: BackfillHealthPayload['status']['state']): 'default' | 'secondary' | 'destructive' {
  if (state === 'running' || state === 'complete') return 'default'
  if (state === 'stalled') return 'destructive'
  return 'secondary'
}

function stateLabel(state: BackfillHealthPayload['status']['state']): string {
  if (state === 'running') return 'Running'
  if (state === 'stalled') return 'Stalled'
  if (state === 'complete') return 'Complete'
  return 'Idle'
}

export default function BackfillHealthPanel() {
  const [payload, setPayload] = useState<BackfillHealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/admin/sync/backfill-health', { cache: 'no-store' })
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') ?? '60')
          throw new Error(`Rate limited while loading dashboard data. Retrying automatically in about ${retryAfter} seconds.`)
        }
        const data = (await res.json()) as BackfillHealthPayload | { error?: string }
        if (!res.ok || !('ok' in data && data.ok)) {
          throw new Error(('error' in data && data.error) ? data.error : `Request failed (${res.status})`)
        }
        if (!cancelled) {
          setPayload(data as BackfillHealthPayload)
          setError(null)
          setRateLimitMessage(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          if (message.toLowerCase().includes('rate limited')) {
            setRateLimitMessage(message)
            setError(null)
          } else {
            setError(message)
            setRateLimitMessage(null)
          }
        }
      }
    }
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const warningMessages = useMemo(() => {
    if (!payload) return []
    const warnings: string[] = []
    if (payload.status.isStalled) warnings.push('No recent sync heartbeat. Backfill appears stalled.')
    if (payload.mediaCoverage.allAuxiliaryTablesPopulated === false) {
      warnings.push('Auxiliary Spark data tables are not fully populated yet.')
    }
    if (payload.integrity.hasListingsCountError && payload.integrity.listingsCountError) {
      warnings.push(payload.integrity.listingsCountError)
    }
    if (payload.integrity.hasHistoryCountError && payload.integrity.historyCountError) {
      warnings.push(payload.integrity.historyCountError)
    }
    if (payload.cursor.error) warnings.push(`Sync cursor error: ${payload.cursor.error}`)
    return warnings
  }, [payload])

  const progressSummary = useMemo(() => {
    if (!payload) return null
    const total = payload.totals.finalizedTerminalListings + payload.totals.terminalRemainingListings
    const pct = total > 0
      ? Math.round((payload.totals.finalizedTerminalListings / total) * 1000) / 10
      : 0
    return { total, pct }
  }, [payload])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Goal</AlertTitle>
          <AlertDescription>
            Two lanes run together: fresh sync keeps current listings updated, and historical backfill processes newest year first then moves down through older years until terminal listings are finalized with complete Spark history.
          </AlertDescription>
        </Alert>

        {rateLimitMessage && (
          <Alert>
            <AlertTitle>Dashboard request rate limit</AlertTitle>
            <AlertDescription>{rateLimitMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Health check unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!error && !payload && (
          <p className="text-sm text-muted-foreground">Loading live backfill health...</p>
        )}

        {payload && (
          <>
            <div className="flex items-center gap-3">
              <Badge variant={toBadgeVariant(payload.status.state)}>{stateLabel(payload.status.state)}</Badge>
              <p className="text-sm text-muted-foreground">
                Last check {new Date(payload.checkedAt).toLocaleString()}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Still needs finalization</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.totals.terminalRemainingListings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">History finalized</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.totals.finalizedTerminalListings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Strict verified full history</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.totals.verifiedFullHistoryListings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current year in progress</p>
                <p className="font-mono text-sm text-foreground">
                  {payload.yearCursor.currentYear ?? '—'} {payload.yearCursor.nextHistoryOffset ?? 0}/{payload.yearCursor.totalListings ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last sync heartbeat</p>
                <p className="font-mono text-sm text-foreground">
                  {payload.cursor.minutesSinceUpdate != null ? `${Math.round(payload.cursor.minutesSinceUpdate)} min ago` : '—'}
                </p>
              </div>
            </div>

            {progressSummary && (
              <p className="text-sm text-muted-foreground">
                Finalization progress: {progressSummary.pct}% ({formatNumber(payload.totals.finalizedTerminalListings)} of {formatNumber(progressSummary.total)} terminal listings).
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Strict verification backlog: {formatNumber(payload.totals.finalizedUnverifiedListings)} finalized listings still need full Spark verification.
            </p>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Photos synced rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.listingPhotosRows)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Videos synced rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.listingVideosRows)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Agents synced rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.listingAgentsRows)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open houses synced rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.openHousesRows)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status history rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.statusHistoryRows)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price history rows</p>
                <p className="font-mono text-sm text-foreground">{formatNumber(payload.mediaCoverage.priceHistoryRows)}</p>
              </div>
            </div>

            {warningMessages.length > 0 && (
              <Alert>
                <AlertTitle>Attention needed</AlertTitle>
                <AlertDescription>{warningMessages.join(' ')}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
