import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { SyncHistoryRow } from '@/app/actions/sync-history'
import type { SyncCursor } from '@/app/actions/sync-full-cron'
import CronSyncStatus from './CronSyncStatus'
import '@/components/admin/v2/report-grid.css'

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

type Props = {
  history: SyncHistoryRow[]
  cursor: SyncCursor | null
  counts: {
    activeCount: number
    totalListings: number
    historyCount: number
    historyFinalizedCount: number
    closedFinalizedCount: number
    closedNotFinalizedCount: number
    expiredFinalizedCount?: number
    expiredNotFinalizedCount?: number
    withdrawnFinalizedCount?: number
    withdrawnNotFinalizedCount?: number
    canceledFinalizedCount?: number
    canceledNotFinalizedCount?: number
    historyError?: string
  }
  breakdown: { total: number; byStatus: { status: string; count: number }[]; breakdownError?: string }
  historyTableStatus: { exists: boolean; error?: string }
  dataQuality: { totalListings: number; missingPrimaryPhoto: number; classifiedPhotos: number }
}

// Shared stat-tile styling — the grids below render several of these, each
// only differing in label/value/color, so the tokens live once here.
const tileStyle: CSSProperties = {
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-inset)',
  padding: 'var(--a-s3)',
}

const tileLabelStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--a-text-2)',
}

function tileValueStyle(color: string): CSSProperties {
  return { marginTop: 4, fontSize: 'var(--a-text-xl)', fontWeight: 600, color }
}

// Desktop grid column template read by report-grid.css at >=720px (below
// that, the whole block is `hidden` in favor of the phone card list).
const syncGridStyle = {
  '--rgrid-cols': '120px 90px 80px 96px minmax(160px,1fr)',
  '--rgrid-min': '600px',
} as CSSProperties

export default function DashboardSyncPanel(props: Props) {
  const { history, cursor, counts, breakdown, historyTableStatus, dataQuality } = props
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div style={tileStyle}>
          {/* "estimated" is not hedging — getAllListingsCount() reads planner
              reltuples. It measured 3.82% high on 2026-08-08 and an ANALYZE on
              2026-08-09 brought it to 0.004%, but nothing holds it there as the
              sync writes, so a bare "total" would still claim an exactness this
              number cannot keep. */}
          <p style={tileLabelStyle}>Listings (total, estimated)</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{counts.totalListings.toLocaleString()}</p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Active</p>
          <p className="a-num" style={tileValueStyle('var(--a-ok)')}>{counts.activeCount.toLocaleString()}</p>
        </div>
        <div style={tileStyle} title="Excluded from history re-sync (history_finalized = true)">
          <p style={tileLabelStyle}>Finalized (skipped)</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{counts.historyFinalizedCount.toLocaleString()}</p>
        </div>
        <div style={tileStyle} title="Closed + history synced">
          <p style={tileLabelStyle}>Closed finalized</p>
          <p className="a-num" style={tileValueStyle('var(--a-ok)')}>{counts.closedFinalizedCount.toLocaleString()}</p>
        </div>
        <div style={tileStyle} title="Closed, backfill pending">
          <p style={tileLabelStyle}>Closed not finalized</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{counts.closedNotFinalizedCount.toLocaleString()}</p>
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>Current sync state</h3>
        <div style={{ marginTop: 'var(--a-s2)' }}>
          <CronSyncStatus cursor={cursor} />
        </div>
      </div>
      <div>
        {/* 11F: this heading said "Sync job history (last 10)", which reads as
            every sync. recordSyncRun() is called from ONE place —
            sync-full-cron.ts, and only when a FULL run completes (history
            done). The delta sync that actually keeps listings fresh, 96 runs a
            day, never writes here at all. Measured 2026-08-08: sync_history
            holds 19 rows, ALL dated 2026-03-16, zero in the last 30 days —
            while sync_cursor updated today and listings carry a modification
            stamp from today. The pipeline is healthy; only this log is old. A
            broker reading the old title would have concluded sync last ran in
            March. Why no full run has COMPLETED since March is a real question
            and is filed, not answered here. */}
        <h3 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>Completed full syncs (last 10)</h3>
        {history.length === 0 ? (
          <p style={{ marginTop: 'var(--a-s2)', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No sync runs recorded yet.</p>
        ) : (
          <div style={{ marginTop: 'var(--a-s2)' }}>
            {/* Phones: a card per run (no horizontally-scrolling 5-col table) */}
            <div className="av2-cardlist">
              {history.slice(0, 10).map((row) => (
                <div
                  key={row.id}
                  className="av2-pane"
                  style={row.error ? { background: 'var(--a-danger-wash)' } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
                      {formatDateTime(row.completed_at)}
                    </span>
                    <span className="capitalize" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {row.run_type}
                    </span>
                  </div>
                  <div
                    className="flex flex-wrap gap-x-4 gap-y-0.5"
                    style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                  >
                    <span className="a-num">{formatDuration(row.duration_seconds)}</span>
                    <span className="a-num">
                      {row.listings_upserted > 0 ? `${row.listings_upserted.toLocaleString()} listings` : 'no upserts'}
                    </span>
                  </div>
                  {row.error ? (
                    <p style={{ overflowWrap: 'break-word', fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
                      {row.error}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {/* Desktop: full table */}
            <div className="hidden md:block">
              <div className="av2-rgrid__scroll no-scrollbar" role="group" tabIndex={0} aria-label="Completed full syncs">
                <div className="av2-rgrid" role="table" aria-label="Completed full syncs" style={syncGridStyle}>
                  <div className="av2-rgrid__head" role="row">
                    <span role="columnheader" className="av2-rgrid__h">Completed</span>
                    <span role="columnheader" className="av2-rgrid__h">Type</span>
                    <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Duration</span>
                    <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">Listings</span>
                    <span role="columnheader" className="av2-rgrid__h">Error</span>
                  </div>
                  {history.slice(0, 10).map((row) => (
                    <div
                      key={row.id}
                      role="row"
                      className="av2-rgrid__row"
                      style={row.error ? { background: 'var(--a-danger-wash)' } : undefined}
                    >
                      <span role="cell" data-label="Completed" className="av2-rgrid__c">
                        {formatDateTime(row.completed_at)}
                      </span>
                      <span role="cell" data-label="Type" className="av2-rgrid__c capitalize" style={{ color: 'var(--a-text-2)' }}>
                        {row.run_type}
                      </span>
                      <span
                        role="cell"
                        data-label="Duration"
                        className="av2-rgrid__c av2-rgrid__c--n a-num"
                        style={{ fontFamily: 'var(--a-font-mono)', color: 'var(--a-text-2)' }}
                      >
                        {formatDuration(row.duration_seconds)}
                      </span>
                      <span
                        role="cell"
                        data-label="Listings"
                        className="av2-rgrid__c av2-rgrid__c--n a-num"
                        style={{ fontFamily: 'var(--a-font-mono)', color: 'var(--a-text-2)' }}
                      >
                        {row.listings_upserted > 0 ? row.listings_upserted.toLocaleString() : '—'}
                      </span>
                      <span
                        role="cell"
                        data-label="Error"
                        className="av2-rgrid__c"
                        style={{
                          color: 'var(--a-danger)',
                          fontSize: 'var(--a-text-xs)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={row.error ?? undefined}
                      >
                        {row.error ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <p style={{ marginTop: 'var(--a-s2)' }}>
          <Link
            href="/admin/sync"
            className="hover:underline"
            style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-ok)' }}
          >
            Full sync page
          </Link>
        </p>
      </div>
      <div>
        <h3 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>Data quality</h3>
        <div className="grid gap-2 sm:grid-cols-3" style={{ marginTop: 'var(--a-s2)' }}>
          <div className="av2-pane">
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Active listings missing primary photo</p>
            <p
              className="a-num"
              style={{ fontWeight: 600, color: dataQuality.missingPrimaryPhoto > 0 ? 'var(--a-warn)' : 'var(--a-text)' }}
            >
              {dataQuality.missingPrimaryPhoto.toLocaleString()}
            </p>
          </div>
          <div className="av2-pane">
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Photos classified</p>
            <p className="a-num" style={{ fontWeight: 600, color: 'var(--a-text)' }}>
              {dataQuality.classifiedPhotos.toLocaleString()}
            </p>
          </div>
          <div className="av2-pane">
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>History table</p>
            <p
              style={{
                fontSize: 'var(--a-text-sm)',
                fontWeight: 500,
                color: historyTableStatus.exists ? 'var(--a-ok)' : 'var(--a-warn)',
              }}
            >
              {historyTableStatus.exists ? 'OK' : (historyTableStatus.error ?? 'Missing')}
            </p>
          </div>
        </div>
      </div>
      {!breakdown.breakdownError && breakdown.byStatus.length > 0 && (
        <div>
          <h3 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>By status</h3>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 'var(--a-s2)' }}>
            {breakdown.byStatus.slice(0, 8).map(({ status, count }) => (
              <span
                key={status}
                style={{
                  fontSize: 'var(--a-text-xs)',
                  color: 'var(--a-text-2)',
                  border: '1px solid var(--a-border)',
                  borderRadius: 'var(--a-r-sm)',
                  padding: '1px 6px',
                }}
              >
                {status}: <strong className="a-num">{count.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
