'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { StateWord, type AdminState } from '@/components/admin/v2'

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
    /** Terminal listings the strict verify cron actually processes. */
    terminalStrictVerifyBacklogListings?: number
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
  strictVerifyTelemetry: {
    tableReady: boolean
    tableError: string | null
    health: {
      status: 'healthy' | 'degraded' | 'stalled' | 'unknown'
      summary: string
      minutesSinceLastRun: number | null
      successRateLast10: number | null
      avgMarkedVerifiedLast5: number | null
      avgFetchFailuresLast5: number | null
    } | null
    recentRuns: Array<{ completed_at: string; marked_verified: number; fetch_failures: number; ok: boolean }>
    etaMinutesRough: number | null
    etaNote: string
  }
}

const POLL_MS = 15000

/* ── admin v2 surface tokens (design_system/admin/ADMIN_UI.md) ──────────────
   Declared once because this panel repeats the same label/figure pair fifteen
   times, and because a surface painted with its own parent's token is
   invisible: the page sits on --a-bg, this panel takes --a-surface, the card
   NESTED inside it drops back to --a-bg + a hairline, and the notes take
   --a-inset. Three levels, three fills, every boundary readable. */
const panelStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
  color: 'var(--a-text)',
  fontSize: 'var(--a-text-sm)',
}
const innerPanelStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-bg)',
  color: 'var(--a-text)',
  fontSize: 'var(--a-text-sm)',
}
const titleStyle: CSSProperties = {
  fontSize: 'var(--a-text-lg)',
  fontWeight: 500,
  color: 'var(--a-text)',
}
const noteStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  background: 'var(--a-inset)',
  padding: '8px 10px',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text)',
}
const dangerNoteStyle: CSSProperties = {
  ...noteStyle,
  borderColor: 'var(--a-danger)',
  background: 'var(--a-danger-wash)',
  color: 'var(--a-danger)',
}
const noteTitleStyle: CSSProperties = { fontWeight: 500 }
const noteBodyStyle: CSSProperties = { color: 'var(--a-text-2)' }
const dangerNoteBodyStyle: CSSProperties = { color: 'var(--a-danger)' }
const labelStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }
const figureStyle: CSSProperties = {
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text)',
}
const inlineFigureStyle: CSSProperties = {
  fontFamily: 'var(--a-font-mono)',
  color: 'var(--a-text)',
}
const quietBodyStyle: CSSProperties = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }
const quietMetaStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—'
  return value.toLocaleString()
}

function toStateTone(state: BackfillHealthPayload['status']['state']): AdminState {
  if (state === 'running' || state === 'complete') return 'ok'
  if (state === 'stalled') return 'down'
  return 'waiting'
}

function stateLabel(state: BackfillHealthPayload['status']['state']): string {
  if (state === 'running') return 'Running'
  if (state === 'stalled') return 'Stalled'
  if (state === 'complete') return 'Complete'
  return 'Idle'
}

function strictCronStateTone(
  status: NonNullable<BackfillHealthPayload['strictVerifyTelemetry']['health']>['status']
): AdminState {
  if (status === 'healthy') return 'ok'
  if (status === 'stalled' || status === 'degraded') return 'down'
  return 'waiting'
}

function strictCronLabel(
  status: NonNullable<BackfillHealthPayload['strictVerifyTelemetry']['health']>['status']
): string {
  if (status === 'healthy') return 'Cron healthy'
  if (status === 'degraded') return 'Cron degraded'
  if (status === 'stalled') return 'Cron stalled'
  return 'Cron unknown'
}

type StrictActivity = {
  lastPoll: { verified: number; backlogAll: number; backlogTerminal: number } | null
  sinceLoad: { verified: number; backlogAll: number; backlogTerminal: number }
}

export default function BackfillHealthPanel() {
  const [payload, setPayload] = useState<BackfillHealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)
  const [strictActivity, setStrictActivity] = useState<StrictActivity | null>(null)
  const strictPrevRef = useRef<{ v: number; b: number; t: number } | null>(null)
  const strictBaselineRef = useRef<{ v: number; b: number; t: number } | null>(null)

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
          const p = data as BackfillHealthPayload
          const v = p.totals.verifiedFullHistoryListings
          const b = p.totals.finalizedUnverifiedListings
          const t =
            typeof p.totals.terminalStrictVerifyBacklogListings === 'number'
              ? p.totals.terminalStrictVerifyBacklogListings
              : b
          const prev = strictPrevRef.current
          const lastPoll =
            prev != null
              ? {
                  verified: v - prev.v,
                  backlogAll: prev.b - b,
                  backlogTerminal: prev.t - t,
                }
              : null
          if (strictBaselineRef.current == null) {
            strictBaselineRef.current = { v, b, t }
          }
          const base = strictBaselineRef.current!
          const sinceLoad = {
            verified: v - base.v,
            backlogAll: base.b - b,
            backlogTerminal: base.t - t,
          }
          strictPrevRef.current = { v, b, t }
          setStrictActivity({ lastPoll, sinceLoad })
          setPayload(p)
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
    const sv = payload.strictVerifyTelemetry
    if (sv && !sv.tableReady && sv.tableError) {
      warnings.push(`Strict verify run log unavailable: ${sv.tableError}`)
    }
    if (sv?.health?.status === 'stalled') {
      warnings.push(`Strict verify cron stalled: ${sv.health.summary}`)
    }
    if (sv?.health?.status === 'degraded') {
      warnings.push(`Strict verify cron degraded: ${sv.health.summary}`)
    }
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

  const strictMakingProgress = useMemo(() => {
    const lp = strictActivity?.lastPoll
    if (!lp) return false
    return lp.verified > 0 || lp.backlogTerminal > 0 || lp.backlogAll > 0
  }, [strictActivity])

  return (
    <section style={panelStyle}>
      <div className="p-4">
        <div style={titleStyle}>Backfill health</div>
      </div>
      <div className="space-y-4 p-4">
        <div role="alert" style={noteStyle}>
          <div style={noteTitleStyle}>Goal</div>
          <div style={noteBodyStyle}>
            Two lanes run together: fresh sync keeps current listings updated, and historical backfill processes newest year first then moves down through older years until terminal listings are finalized with complete Spark history.
          </div>
        </div>

        {payload && strictActivity && (
          <section style={innerPanelStyle}>
            <div className="space-y-1 p-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <div style={titleStyle}>Strict verification</div>
                <StateWord state={strictMakingProgress ? 'accent' : 'waiting'}>
                  {strictMakingProgress ? 'Moving' : 'Flat'}
                </StateWord>
                {payload.strictVerifyTelemetry.health && (
                  <StateWord state={strictCronStateTone(payload.strictVerifyTelemetry.health.status)}>
                    {strictCronLabel(payload.strictVerifyTelemetry.health.status)}
                  </StateWord>
                )}
              </div>
              <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 400, color: 'var(--a-text-2)' }}>
                Cron <span style={inlineFigureStyle}>sync-verify-full-history</span> raises strict verified
                counts for terminal listings. This page refreshes every {POLL_MS / 1000} seconds so you can see numbers
                change.
              </p>
            </div>
            <div className="space-y-3 p-4 pt-0">
              {!payload.strictVerifyTelemetry.tableReady && (
                <div role="alert" style={dangerNoteStyle}>
                  <div style={noteTitleStyle}>Strict verify telemetry missing</div>
                  <div style={dangerNoteBodyStyle}>
                    {payload.strictVerifyTelemetry.tableError ?? 'Could not read strict_verify_runs.'}{' '}
                    {payload.strictVerifyTelemetry.etaNote}
                  </div>
                </div>
              )}
              {payload.strictVerifyTelemetry.tableReady && payload.strictVerifyTelemetry.health && (
                <p style={quietBodyStyle}>
                  {payload.strictVerifyTelemetry.health.summary}
                  {payload.strictVerifyTelemetry.health.minutesSinceLastRun != null
                    ? ` Last logged run about ${Math.round(payload.strictVerifyTelemetry.health.minutesSinceLastRun)} min ago.`
                    : ''}
                  {payload.strictVerifyTelemetry.health.successRateLast10 != null
                    ? ` Success rate over the last ten runs is ${payload.strictVerifyTelemetry.health.successRateLast10}%.`
                    : ''}
                </p>
              )}
              {payload.strictVerifyTelemetry.tableReady &&
                payload.strictVerifyTelemetry.etaMinutesRough != null && (
                  <p style={quietMetaStyle}>
                    Rough ETA to clear terminal strict queue about {payload.strictVerifyTelemetry.etaMinutesRough} min.{' '}
                    {payload.strictVerifyTelemetry.etaNote}
                  </p>
                )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p style={labelStyle}>Terminal strict queue</p>
                  <p style={figureStyle}>
                    {formatNumber(
                      payload.totals.terminalStrictVerifyBacklogListings ?? payload.totals.finalizedUnverifiedListings
                    )}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Strict verified (all listings)</p>
                  <p style={figureStyle}>
                    {formatNumber(payload.totals.verifiedFullHistoryListings)}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Last refresh delta</p>
                  <p style={figureStyle}>
                    {strictActivity.lastPoll == null
                      ? '—'
                      : strictActivity.lastPoll.verified === 0 &&
                          strictActivity.lastPoll.backlogTerminal === 0 &&
                          strictActivity.lastPoll.backlogAll === 0
                        ? 'No change'
                        : `${strictActivity.lastPoll.verified >= 0 ? '+' : ''}${strictActivity.lastPoll.verified.toLocaleString()} verified, terminal queue ${strictActivity.lastPoll.backlogTerminal >= 0 ? '−' : '+'}${
                            Math.abs(strictActivity.lastPoll.backlogTerminal).toLocaleString()
                          }`}
                  </p>
                </div>
              </div>
              <p style={quietMetaStyle}>
                Since this page loaded:{' '}
                <span style={inlineFigureStyle}>
                  {strictActivity.sinceLoad.verified >= 0 ? '+' : ''}
                  {strictActivity.sinceLoad.verified.toLocaleString()} verified
                </span>
                , terminal queue{' '}
                <span style={inlineFigureStyle}>
                  {strictActivity.sinceLoad.backlogTerminal >= 0 ? '−' : '+'}
                  {Math.abs(strictActivity.sinceLoad.backlogTerminal).toLocaleString()}
                </span>
                . If deltas stay flat for several minutes while the queue is large, check Vercel cron logs for 504 or 401
                on that path.
              </p>
            </div>
          </section>
        )}

        {rateLimitMessage && (
          <div role="alert" style={noteStyle}>
            <div style={noteTitleStyle}>Dashboard request rate limit</div>
            <div style={noteBodyStyle}>{rateLimitMessage}</div>
          </div>
        )}

        {error && (
          <div role="alert" style={dangerNoteStyle}>
            <div style={noteTitleStyle}>Health check unavailable</div>
            <div style={dangerNoteBodyStyle}>{error}</div>
          </div>
        )}

        {!error && !payload && (
          <p style={quietBodyStyle}>Loading live backfill health...</p>
        )}

        {payload && (
          <>
            <div className="flex items-center gap-3">
              <StateWord state={toStateTone(payload.status.state)}>{stateLabel(payload.status.state)}</StateWord>
              <p style={quietBodyStyle}>
                Last check {new Date(payload.checkedAt).toLocaleString()}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p style={labelStyle}>Still needs finalization</p>
                <p style={figureStyle}>{formatNumber(payload.totals.terminalRemainingListings)}</p>
              </div>
              <div>
                <p style={labelStyle}>History finalized</p>
                <p style={figureStyle}>{formatNumber(payload.totals.finalizedTerminalListings)}</p>
              </div>
              <div>
                <p style={labelStyle}>Strict verified full history</p>
                <p style={figureStyle}>{formatNumber(payload.totals.verifiedFullHistoryListings)}</p>
              </div>
              <div>
                <p style={labelStyle}>Legacy year cursor (lane removed)</p>
                <p style={figureStyle}>
                  {payload.yearCursor.currentYear ?? '—'} {payload.yearCursor.nextHistoryOffset ?? 0}/{payload.yearCursor.totalListings ?? '—'}
                </p>
              </div>
              <div>
                <p style={labelStyle}>Last sync heartbeat</p>
                <p style={figureStyle}>
                  {payload.cursor.minutesSinceUpdate != null ? `${Math.round(payload.cursor.minutesSinceUpdate)} min ago` : '—'}
                </p>
              </div>
            </div>

            {progressSummary && (
              <p style={quietBodyStyle}>
                Finalization progress: {progressSummary.pct}% ({formatNumber(payload.totals.finalizedTerminalListings)} of {formatNumber(progressSummary.total)} terminal listings).
              </p>
            )}

            <div aria-hidden="true" style={{ height: 1, width: '100%', background: 'var(--a-border)' }} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p style={labelStyle}>Photos synced rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.listingPhotosRows)}</p>
              </div>
              <div>
                <p style={labelStyle}>Videos synced rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.listingVideosRows)}</p>
              </div>
              <div>
                <p style={labelStyle}>Agents synced rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.listingAgentsRows)}</p>
              </div>
              <div>
                <p style={labelStyle}>Open houses synced rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.openHousesRows)}</p>
              </div>
              <div>
                <p style={labelStyle}>Status history rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.statusHistoryRows)}</p>
              </div>
              <div>
                <p style={labelStyle}>Price history rows</p>
                <p style={figureStyle}>{formatNumber(payload.mediaCoverage.priceHistoryRows)}</p>
              </div>
            </div>

            {warningMessages.length > 0 && (
              <div role="alert" style={noteStyle}>
                <div style={noteTitleStyle}>Attention needed</div>
                <div style={noteBodyStyle}>{warningMessages.join(' ')}</div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
