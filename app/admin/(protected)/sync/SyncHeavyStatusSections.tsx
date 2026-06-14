'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import SyncPageAdvanced from './SyncPageAdvanced'
import type { SyncStatus } from '@/app/actions/sync-full-cron'
import type { ListingSyncStatusBreakdown } from '@/app/actions/listings'
import type { SparkListingCountsByStatus } from '@/lib/spark'

type SparkSyncCountResult = {
  totalListings: number
  totalPages: number
  pageSize: number
  error?: string
} | null

type HeavyPayload = {
  statusBreakdown: ListingSyncStatusBreakdown
  sparkSyncCount: SparkSyncCountResult
  sparkCountsByStatus: SparkListingCountsByStatus | null
}

type Props = {
  totalListings: number
  syncStatus: SyncStatus
  runInProgress: boolean
}

export default function SyncHeavyStatusSections({ totalListings, syncStatus, runInProgress }: Props) {
  const [payload, setPayload] = useState<HeavyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), runInProgress ? 15000 : 20000)

    const load = async () => {
      try {
        setError(null)
        const res = await fetch('/api/admin/sync-heavy', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`)
        }
        const data = (await res.json()) as HeavyPayload
        setPayload(data)
      } catch (err) {
        if (controller.signal.aborted) {
          setError('Extended diagnostics are still loading. Last successful values are shown when available.')
          return
        }
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
    const interval = setInterval(() => {
      void load()
    }, 30000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      controller.abort()
    }
  }, [runInProgress])

  const loading = payload == null && !error
  const statusBreakdown = payload?.statusBreakdown ?? null
  const sparkSyncCount = payload?.sparkSyncCount ?? null
  const sparkCountsByStatus = payload?.sparkCountsByStatus ?? null
  const sparkTotal = sparkSyncCount && !sparkSyncCount.error ? sparkSyncCount.totalListings : null
  const gap = sparkTotal != null ? Math.max(0, sparkTotal - totalListings) : null

  return (
    <>
      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="spark-db-heading">
        <h2 id="spark-db-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Spark API vs database</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:text-left">
          <div>
            <p className="text-xs text-muted-foreground">Spark (source)</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">
              {sparkTotal != null ? sparkTotal.toLocaleString() : sparkSyncCount?.error ?? (loading ? 'Loading...' : '—')}
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
          <p className="mt-2 text-sm text-warning">{gap.toLocaleString()} listings missing in DB. Background full sync will backfill; gap should shrink over the next runs.</p>
        )}
        {error && (
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
        )}
        {loading && (
          <p className="mt-2 text-xs text-muted-foreground">Extended diagnostics are loading...</p>
        )}
        {!loading && statusBreakdown && (statusBreakdown.total > 0 || totalListings > 0) && (
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
                  <p className="mt-1.5 text-xs text-muted-foreground">Gap = Spark − DB (listings in Spark not yet in database).</p>
                  {sparkCountsByStatus && !sparkCountsByStatus.error && !sparkStatusesOk && sparkCountsByStatus.total > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Spark per-status not available for this MLS. Total Spark vs DB still shown.</p>
                  )}
                  {sparkCountsByStatus?.error && (
                    <p className="mt-1 text-xs text-warning">Spark: {sparkCountsByStatus.error}</p>
                  )}
                </>
              )
            })()}
          </div>
        )}
        <div className="mt-4">
          <SyncPageAdvanced syncStatus={syncStatus} runInProgress={runInProgress} sparkConfigured={sparkSyncCount != null && !sparkSyncCount.error} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Listing status (DB)</h2>
        {loading && (
          <p className="mt-2 text-sm text-muted-foreground">Loading listing status breakdown...</p>
        )}
        {!loading && statusBreakdown && statusBreakdown.total === 0 && totalListings > 0 && (
          <p className="mt-2 text-sm text-warning">DB breakdown RPC not available. Apply migrations: npx supabase db push</p>
        )}
        {!loading && statusBreakdown?.error ? (
          <p className="mt-2 text-sm text-warning">{statusBreakdown.error}</p>
        ) : !loading && statusBreakdown ? (
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
        ) : null}
      </section>
    </>
  )
}
