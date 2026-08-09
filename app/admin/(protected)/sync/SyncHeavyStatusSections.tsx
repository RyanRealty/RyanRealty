'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ReportGrid } from '@/components/admin/v2'
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

/* ── admin v2 surface tokens (design_system/admin/ADMIN_UI.md) ──────────────
   The page sits on --a-bg, so a panel on it takes --a-surface plus a hairline;
   "elevation: borders first" retires the shadow the shadcn card carried. */
const panelStyle: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
  color: 'var(--a-text)',
}
const sectionHeadingStyle: CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
}
const subHeadingStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
}
const labelStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }
const bigFigureStyle: CSSProperties = {
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-lg)',
  fontWeight: 600,
  color: 'var(--a-text)',
}
const bigFigureWarnStyle: CSSProperties = { ...bigFigureStyle, color: 'var(--a-warn)' }
const warnBodyStyle: CSSProperties = { fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }
const quietBodyStyle: CSSProperties = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }
const quietMetaStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }
const warnMetaStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-warn)' }
/* Figures inside a grid cell: the cell owns alignment, the span owns the face. */
const cellFigureStyle: CSSProperties = { fontFamily: 'var(--a-font-mono)', color: 'var(--a-text-2)' }
const cellFigureStrongStyle: CSSProperties = { fontFamily: 'var(--a-font-mono)', color: 'var(--a-text)' }
const cellFigureOkStyle: CSSProperties = { fontFamily: 'var(--a-font-mono)', color: 'var(--a-ok)' }
const cellFigureWarnStyle: CSSProperties = { fontFamily: 'var(--a-font-mono)', color: 'var(--a-warn)' }
/* The by-city grid is hand-assembled from the same report-grid shape ReportGrid
   renders, for ONE reason: its header is sticky inside a 320px-tall scroller.
   Sticky resolves against the nearest scroll container, and ReportGrid owns its
   own `.av2-rgrid__scroll`, which would become that container and pin the header
   to a box that scrolls away with the rows. */
const cityGridStyle = {
  '--rgrid-cols': 'minmax(120px,1.4fr) repeat(9, minmax(56px,1fr))',
  '--rgrid-min': '720px',
} as CSSProperties
const cityHeadStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--a-surface)',
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
      <section className="mt-6 p-5" style={panelStyle} aria-labelledby="spark-db-heading">
        <h2 id="spark-db-heading" style={sectionHeadingStyle}>Spark API vs database</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:text-left">
          <div>
            <p style={labelStyle}>Spark (source)</p>
            <p className="mt-0.5" style={bigFigureStyle}>
              {sparkTotal != null ? sparkTotal.toLocaleString() : sparkSyncCount?.error ?? (loading ? 'Loading...' : '—')}
            </p>
          </div>
          <div>
            <p style={labelStyle}>In database</p>
            <p className="mt-0.5" style={bigFigureStyle}>{totalListings.toLocaleString()}</p>
          </div>
          <div>
            <p style={labelStyle}>Gap (missing)</p>
            <p className="mt-0.5" style={gap != null && gap > 0 ? bigFigureWarnStyle : bigFigureStyle}>
              {gap != null ? gap.toLocaleString() : '—'}
            </p>
          </div>
        </div>
        {gap != null && gap > 0 && (
          <p className="mt-2" style={warnBodyStyle}>{gap.toLocaleString()} listings missing in DB. Background full sync will backfill; gap should shrink over the next runs.</p>
        )}
        {error && (
          <p className="mt-2" style={quietMetaStyle}>{error}</p>
        )}
        {loading && (
          <p className="mt-2" style={quietMetaStyle}>Extended diagnostics are loading...</p>
        )}
        {!loading && statusBreakdown && (statusBreakdown.total > 0 || totalListings > 0) && (
          <div className="mt-4">
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
                  <ReportGrid
                    label="Spark versus database by status"
                    columns={[
                      { key: 'status', label: 'Status' },
                      { key: 'spark', label: 'Spark', numeric: true },
                      { key: 'db', label: 'DB', numeric: true },
                      { key: 'gap', label: 'Gap', numeric: true },
                    ]}
                    template="minmax(120px,1fr) 100px 100px 100px"
                    minWidth={440}
                    empty="No status rows to compare."
                    rows={rows.map(({ key, label, spark, db }) => {
                      const gapVal = spark != null ? Math.max(0, spark - db) : null
                      return {
                        key,
                        cells: [
                          label,
                          <span key="spark" style={cellFigureStyle}>{spark != null ? spark.toLocaleString() : '—'}</span>,
                          <span key="db" style={cellFigureStyle}>{db.toLocaleString()}</span>,
                          <span key="gap" style={gapVal != null && gapVal > 0 ? cellFigureWarnStyle : cellFigureStyle}>
                            {gapVal != null && gapVal > 0 ? gapVal.toLocaleString() : '—'}
                          </span>,
                        ],
                      }
                    })}
                  />
                  <p className="mt-1.5" style={quietMetaStyle}>Gap = Spark − DB (listings in Spark not yet in database).</p>
                  {sparkCountsByStatus && !sparkCountsByStatus.error && !sparkStatusesOk && sparkCountsByStatus.total > 0 && (
                    <p className="mt-1" style={quietMetaStyle}>Spark per-status not available for this MLS. Total Spark vs DB still shown.</p>
                  )}
                  {sparkCountsByStatus?.error && (
                    <p className="mt-1" style={warnMetaStyle}>Spark: {sparkCountsByStatus.error}</p>
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

      <section className="mt-6 p-5" style={panelStyle} aria-labelledby="status-heading">
        <h2 id="status-heading" style={sectionHeadingStyle}>Listing status (DB)</h2>
        {loading && (
          <p className="mt-2" style={quietBodyStyle}>Loading listing status breakdown...</p>
        )}
        {!loading && statusBreakdown && statusBreakdown.total === 0 && totalListings > 0 && (
          <p className="mt-2" style={warnBodyStyle}>DB breakdown RPC not available. Apply migrations: npx supabase db push</p>
        )}
        {!loading && statusBreakdown?.error ? (
          <p className="mt-2" style={warnBodyStyle}>{statusBreakdown.error}</p>
        ) : !loading && statusBreakdown ? (
          <>
            <div className="mt-3">
              <ReportGrid
                label="Listing status counts in the database"
                columns={[
                  { key: 'total', label: 'Total' },
                  { key: 'active', label: 'Active', numeric: true },
                  { key: 'pending', label: 'Pending', numeric: true },
                  { key: 'contingent', label: 'Contingent', numeric: true },
                  { key: 'closed', label: 'Closed', numeric: true },
                  { key: 'finalized', label: 'Finalized', numeric: true },
                  { key: 'expired', label: 'Expired', numeric: true },
                  { key: 'withdrawn', label: 'Withdrawn', numeric: true },
                  { key: 'cancelled', label: 'Cancelled', numeric: true },
                  { key: 'other', label: 'Other', numeric: true },
                ]}
                template="repeat(10, minmax(72px,1fr))"
                minWidth={820}
                empty="No listing status breakdown to show."
                rows={[
                  {
                    key: 'db-breakdown',
                    cells: [
                      <span key="total" style={cellFigureStrongStyle}>{statusBreakdown.total.toLocaleString()}</span>,
                      <span key="active" style={cellFigureStyle}>{statusBreakdown.active.toLocaleString()}</span>,
                      <span key="pending" style={cellFigureStyle}>{statusBreakdown.pending.toLocaleString()}</span>,
                      <span key="contingent" style={cellFigureStyle}>{statusBreakdown.contingent.toLocaleString()}</span>,
                      <span key="closed" style={cellFigureStyle}>{statusBreakdown.closed.toLocaleString()}</span>,
                      <span key="finalized" style={cellFigureOkStyle} title="Closed with full history; no re-fetch">{statusBreakdown.closed_finalized.toLocaleString()}</span>,
                      <span key="expired" style={cellFigureStyle}>{statusBreakdown.expired.toLocaleString()}</span>,
                      <span key="withdrawn" style={cellFigureStyle}>{statusBreakdown.withdrawn.toLocaleString()}</span>,
                      <span key="cancelled" style={cellFigureStyle}>{statusBreakdown.cancelled.toLocaleString()}</span>,
                      <span key="other" style={cellFigureStyle}>{statusBreakdown.other.toLocaleString()}</span>,
                    ],
                  },
                ]}
              />
            </div>
            <p className="mt-2" style={quietMetaStyle}>Finalized = closed with full history; excluded from future sync.</p>
            {statusBreakdown.by_city.length > 0 && (
              <>
                <h3 className="mt-4" style={subHeadingStyle}>By city (A–Z)</h3>
                <div
                  className="mt-2 max-h-[320px] overflow-auto"
                  role="group"
                  tabIndex={0}
                  aria-label="Listing status by city"
                >
                  <div className="av2-rgrid" role="table" aria-label="Listing status by city" style={cityGridStyle}>
                    <div className="av2-rgrid__head" role="row" style={cityHeadStyle}>
                      <span role="columnheader" className="av2-rgrid__h">City</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Active</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Pending</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Cont.</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Closed</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Fin.</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Exp.</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">W/d</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Can.</span>
                      <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Other</span>
                    </div>
                    {statusBreakdown.by_city.map((row) => (
                      <div key={row.city} role="row" className="av2-rgrid__row">
                        <span role="cell" data-label="City" className="av2-rgrid__c">{row.city}</span>
                        <span role="cell" data-label="Active" className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.active}</span>
                        <span role="cell" data-label="Pending" className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.pending}</span>
                        <span role="cell" data-label="Cont." className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.contingent}</span>
                        <span role="cell" data-label="Closed" className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.closed}</span>
                        <span role="cell" data-label="Fin." className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureOkStyle}>{row.closed_finalized}</span>
                        <span role="cell" data-label="Exp." className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.expired}</span>
                        <span role="cell" data-label="W/d" className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.withdrawn}</span>
                        <span role="cell" data-label="Can." className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.cancelled}</span>
                        <span role="cell" data-label="Other" className="av2-rgrid__c av2-rgrid__c--n" style={cellFigureStyle}>{row.other}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : null}
      </section>
    </>
  )
}
