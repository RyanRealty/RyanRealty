import Link from 'next/link'
import { unstable_noStore } from 'next/cache'
import { getAdminSyncCounts, getListingSyncStatusBreakdown } from '@/app/actions/listings'
import { getSyncStatus, getDeltaSyncLog } from '@/app/actions/sync-full-cron'
import { getSparkListingsCountForSync, getSparkListingsCountsByStatus } from '@/lib/spark'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import SyncSmart from './SyncSmart'
import SyncHistoryTable from './SyncHistoryTable'
import SyncRunLog from './SyncRunLog'
import SyncDataRefreshButton from './SyncDataRefreshButton'
import SyncAutoRefresh from './SyncAutoRefresh'
import SyncHistoryButtons from './SyncHistoryButtons'
import TriggerDeltaSyncButton from './TriggerDeltaSyncButton'
import SyncSinceDateButton from './SyncSinceDateButton'
import RefreshActivePendingButton from './RefreshActivePendingButton'

/** Always fetch fresh data so numbers and sync status are up to date. */
export const dynamic = 'force-dynamic'

function formatDate(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function relativeTime(iso: string): string {
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
    return iso
  }
}

export default async function SyncPage() {
  unstable_noStore()
  const [counts, statusBreakdown, sparkSyncCount, sparkCountsByStatus, syncStatus, deltaSyncRows] = await Promise.all([
    getAdminSyncCounts(),
    getListingSyncStatusBreakdown(),
    getSparkListingsCountForSync(),
    getSparkListingsCountsByStatus(),
    getSyncStatus(),
    getDeltaSyncLog(50),
  ])
  const {
    totalListings,
    historyCount,
    activeNeedingHistoryCount,
    closedNotFinalizedCount,
    expiredNotFinalizedCount,
    withdrawnNotFinalizedCount,
    canceledNotFinalizedCount,
    historyError,
    listingsCountError,
  } = counts
  const lastDeltaSyncAt = syncStatus?.lastDeltaSyncCompletedAt ?? null
  const runInProgress = !!syncStatus?.cursor?.runStartedAt

  const sparkTotal = sparkSyncCount && !sparkSyncCount.error ? sparkSyncCount.totalListings : null
  const gap = sparkTotal != null ? Math.max(0, sparkTotal - totalListings) : null
  const terminalNeedingHistory =
    closedNotFinalizedCount + expiredNotFinalizedCount + withdrawnNotFinalizedCount + canceledNotFinalizedCount
  const deltaStale = lastDeltaSyncAt && Date.now() - new Date(lastDeltaSyncAt).getTime() > 10 * 60 * 1000

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseProjectRef = supabaseUrl
    ? (() => {
        try {
          return new URL(supabaseUrl).hostname?.replace(/\.supabase\.co$/i, '') ?? ''
        } catch {
          return ''
        }
      })()
    : ''
  const supabaseDashboardLink = supabaseProjectRef
    ? `https://supabase.com/dashboard/project/${supabaseProjectRef}`
    : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-foreground">Sync</h1>
      <p className="mt-1 text-sm text-muted-foreground">Prefer <strong>Refresh active &amp; pending</strong> to stay current without a full sync. Use full sync (Smart Sync) only when filling a large gap or history.</p>
      <SyncAutoRefresh runInProgress={runInProgress} />

      {/* Step 1: Listings (source vs DB, gap) */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="step1-heading">
        <h2 id="step1-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">1. Listings</h2>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center sm:text-left">
          <div>
            <p className="text-xs text-muted-foreground">Spark (source)</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">
              {sparkTotal != null ? sparkTotal.toLocaleString() : sparkSyncCount?.error ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In database</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{totalListings.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gap (missing)</p>
            <p className={`mt-0.5 font-mono text-lg font-semibold ${gap != null && gap > 0 ? 'text-warning' : 'text-foreground'}`}>
              {gap != null ? gap.toLocaleString() : '—'}
            </p>
          </div>
        </div>
        {gap != null && gap > 0 && (
          <p className="mt-2 text-sm text-warning">{gap.toLocaleString()} listings missing. Try <strong>Refresh active &amp; pending</strong> first; use Smart Sync (full) only if the gap persists.</p>
        )}
        {/* Spark vs DB by status: DB always from breakdown (RPC or direct fallback); Spark per-status when API filters work */}
        {(statusBreakdown.total > 0 || totalListings > 0) && (
          <div className="mt-4 overflow-x-auto">
            {(() => {
              const dbTotal = statusBreakdown.total > 0 ? statusBreakdown.total : totalListings
              const sparkStatusesOk =
                sparkCountsByStatus &&
                !sparkCountsByStatus.error &&
                sparkCountsByStatus.total > 0 &&
                (sparkCountsByStatus.active !== sparkCountsByStatus.total ||
                  sparkCountsByStatus.closed !== sparkCountsByStatus.total)
              const rows: Array<{ key: string; label: string; spark: number | null; db: number }> = [
                { key: 'total', label: 'Total', spark: sparkCountsByStatus?.total ?? null, db: dbTotal },
                { key: 'active', label: 'Active', spark: sparkStatusesOk ? (sparkCountsByStatus?.active ?? null) : null, db: statusBreakdown.active },
                { key: 'pending', label: 'Pending', spark: sparkStatusesOk ? (sparkCountsByStatus?.pending ?? null) : null, db: statusBreakdown.pending },
                { key: 'contingent', label: 'Contingent', spark: sparkStatusesOk ? (sparkCountsByStatus?.contingent ?? null) : null, db: statusBreakdown.contingent },
                { key: 'closed', label: 'Closed', spark: sparkStatusesOk ? (sparkCountsByStatus?.closed ?? null) : null, db: statusBreakdown.closed },
                { key: 'expired', label: 'Expired', spark: sparkStatusesOk ? (sparkCountsByStatus?.expired ?? null) : null, db: statusBreakdown.expired },
                { key: 'withdrawn', label: 'Withdrawn', spark: sparkStatusesOk ? (sparkCountsByStatus?.withdrawn ?? null) : null, db: statusBreakdown.withdrawn },
                { key: 'cancelled', label: 'Cancelled', spark: sparkStatusesOk ? (sparkCountsByStatus?.cancelled ?? null) : null, db: statusBreakdown.cancelled },
                { key: 'other', label: 'Other', spark: sparkStatusesOk ? (sparkCountsByStatus?.other ?? null) : null, db: statusBreakdown.other },
              ]
              return (
                <>
                  <Table className="min-w-full border-collapse text-sm">
                    <TableHeader>
                      <TableRow className="border-b border-border">
                        <TableHead className="py-1.5 pr-2 text-left font-medium text-muted-foreground">Status</TableHead>
                        <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Spark</TableHead>
                        <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">DB</TableHead>
                        <TableHead className="py-1.5 pl-2 text-right font-medium text-muted-foreground">Gap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ key, label, spark, db }) => {
                        const sparkNum = spark ?? 0
                        const gapVal = spark != null ? Math.max(0, spark - db) : null
                        return (
                          <TableRow key={key} className="border-b border-border">
                            <TableCell className="py-1.5 pr-2 text-foreground">{label}</TableCell>
                            <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{spark != null ? spark.toLocaleString() : '—'}</TableCell>
                            <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{db.toLocaleString()}</TableCell>
                            <TableCell className={`py-1.5 pl-2 text-right font-mono ${gapVal != null && gapVal > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                              {gapVal != null && gapVal > 0 ? gapVal.toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <p className="mt-1.5 text-xs text-muted-foreground">Gap = Spark − DB (missing in database). DB counts by status always from Supabase.</p>
                  {sparkCountsByStatus && !sparkCountsByStatus.error && !sparkStatusesOk && sparkCountsByStatus.total > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Spark per-status not available for this MLS (filters not applied). Total Spark vs DB still shown.</p>
                  )}
                  {sparkCountsByStatus?.error && (
                    <p className="mt-1 text-xs text-warning">Spark: {sparkCountsByStatus.error}</p>
                  )}
                </>
              )
            })()}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SyncSmart initialStatus={syncStatus} sparkConfigured={sparkSyncCount != null && !sparkSyncCount.error} compact />
          <div className="flex items-center gap-3">
            <RefreshActivePendingButton runInProgress={runInProgress} syncPhase={syncStatus?.cursor?.phase ?? null} />
          </div>
        </div>
      </section>

      {/* Step 2: History */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="step2-heading">
        <h2 id="step2-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">2. History</h2>
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Active/pending needing history</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{activeNeedingHistoryCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Terminal (closed/expired/etc.) not finalized</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">{terminalNeedingHistory.toLocaleString()}</p>
          </div>
        </div>
        {historyError && (
          <p className="mt-2 text-sm text-warning">{historyError}</p>
        )}
        <div className="mt-4">
          <SyncHistoryButtons compact />
        </div>
      </section>

      {/* Step 3: Keep current (2‑min ingest) */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="step3-heading">
        <h2 id="step3-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">3. Keep current (2‑min ingest)</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Last run: {lastDeltaSyncAt ? <span className="text-success">{formatDateTime(lastDeltaSyncAt)} ({relativeTime(lastDeltaSyncAt)})</span> : <span className="text-warning">Never</span>}
        </p>
        {deltaStale && (
          <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground" role="alert">
            Ingest may have stopped. <a href="https://app.inngest.com" target="_blank" rel="noopener noreferrer" className="font-medium underline">Inngest dashboard</a> · check env (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY).
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TriggerDeltaSyncButton />
          {!lastDeltaSyncAt && <span className="text-xs text-warning">Requires Inngest (dev or Cloud).</span>}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Or sync only listings changed since a date (faster than full sync):</p>
        <SyncSinceDateButton />
      </section>

      {/* Listing status: all buckets + by city */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Listing status (DB)</h2>
        {statusBreakdown.total === 0 && totalListings > 0 && (
          <p className="mt-2 text-sm text-warning">DB breakdown RPC not available. Apply migrations: npx supabase db push</p>
        )}
        {statusBreakdown.error ? (
          <p className="mt-2 text-sm text-warning">{statusBreakdown.error}</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <Table className="min-w-full border-collapse text-sm">
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead className="py-1.5 pr-2 text-left font-medium text-muted-foreground">Total</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Active</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Pending</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Contingent</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Closed</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Finalized</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Expired</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Withdrawn</TableHead>
                    <TableHead className="py-1.5 px-2 text-right font-medium text-muted-foreground">Cancelled</TableHead>
                    <TableHead className="py-1.5 pl-2 text-right font-medium text-muted-foreground">Other</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-border">
                    <TableCell className="py-1.5 pr-2 font-mono text-foreground">{statusBreakdown.total.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.active.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.pending.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.contingent.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.closed.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-success" title="Closed with full history; no re-fetch">{statusBreakdown.closed_finalized.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.expired.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.withdrawn.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 px-2 text-right font-mono text-muted-foreground">{statusBreakdown.cancelled.toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 pl-2 text-right font-mono text-muted-foreground">{statusBreakdown.other.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Finalized = closed with full history; excluded from future sync.</p>
            {statusBreakdown.by_city.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">By city (A–Z)</h3>
                <div className="mt-2 max-h-[320px] overflow-auto overflow-x-auto">
                  <Table className="min-w-full border-collapse text-sm">
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow className="border-b border-border">
                        <TableHead className="py-1 pr-2 text-left font-medium text-muted-foreground">City</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Active</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Pending</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Cont.</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Closed</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Fin.</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Exp.</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">W/d</TableHead>
                        <TableHead className="py-1 px-1 text-right font-medium text-muted-foreground">Can.</TableHead>
                        <TableHead className="py-1 pl-1 text-right font-medium text-muted-foreground">Other</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusBreakdown.by_city.map((row) => (
                        <TableRow key={row.city} className="border-b border-border">
                          <TableCell className="py-1 pr-2 text-foreground">{row.city}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.active}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.pending}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.contingent}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.closed}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-success">{row.closed_finalized}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.expired}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.withdrawn}</TableCell>
                          <TableCell className="py-1 px-1 text-right font-mono text-muted-foreground">{row.cancelled}</TableCell>
                          <TableCell className="py-1 pl-1 text-right font-mono text-muted-foreground">{row.other}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* Run log (delta only) & data */}
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="step5-heading">
        <h2 id="step5-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Run log & data</h2>
        <div className="mt-3">
          <SyncRunLog deltaRows={deltaSyncRows} fullRows={[]} limit={40} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted-foreground">DB: {totalListings.toLocaleString()} listings · {historyCount.toLocaleString()} history rows</span>
            <SyncDataRefreshButton />
          </div>
          {supabaseDashboardLink && (
            <a href={supabaseDashboardLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
              Supabase →
            </a>
          )}
        </div>
        {listingsCountError && (
          <p className="mt-2 text-sm text-destructive">{listingsCountError}</p>
        )}
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/admin/spark-status" className="underline hover:no-underline">Spark</Link>
        {' · '}
        <Link href="/admin/banners" className="underline hover:no-underline">Banners</Link>
        {' · '}
        <Link href="/admin/reports" className="underline hover:no-underline">Reports</Link>
      </p>
    </main>
  )
}
