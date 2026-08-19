import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { DashboardLeadData } from '@/app/actions/dashboard'
import '@/components/admin/v2/report-grid.css'

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

type Props = { data: DashboardLeadData }

// Overview panel — cap the recent-activity feed so the dashboard stays glanceable.
// Full visit history lives on its own screen (/admin/visitors/live).
const RECENT_VISITS_LIMIT = 25

// Shared stat-tile styling — mirrors DashboardSyncPanel's tiles so both panels
// read as one family.
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
const leadGridStyle = {
  '--rgrid-cols': '128px minmax(160px,1fr) 80px',
} as CSSProperties

export default function DashboardLeadPanel({ data }: Props) {
  const rate = data.totalVisits > 0 ? ((data.visitsWithUser / data.totalVisits) * 100).toFixed(1) : '0'
  const shownVisits = data.recentVisits.slice(0, RECENT_VISITS_LIMIT)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Total visits</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{data.totalVisits.toLocaleString()}</p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Identified sessions</p>
          <p className="a-num" style={tileValueStyle('var(--a-ok)')}>{data.visitsWithUser.toLocaleString()}</p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Identification rate</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{rate}%</p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Visits (24h)</p>
          <p className="a-num" style={tileValueStyle('var(--a-text)')}>{data.visitsLast24h.toLocaleString()}</p>
          <p className="a-num" style={{ marginTop: 2, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {data.visitsWithUserLast24h} identified
          </p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>
            Recent activity{data.recentVisits.length > shownVisits.length ? ` (latest ${shownVisits.length})` : ''}
          </h3>
          {data.recentVisits.length > shownVisits.length ? (
            <Link
              href="/admin/visitors/live"
              className="shrink-0 hover:underline"
              style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-accent)' }}
            >
              See all →
            </Link>
          ) : null}
        </div>
        {data.recentVisits.length === 0 ? (
          <p style={{ marginTop: 'var(--a-s2)', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No visits yet.</p>
        ) : (
          <>
            {/* Visit cards — phones */}
            <div className="av2-cardlist max-h-64 overflow-y-auto" style={{ marginTop: 'var(--a-s2)' }}>
              {shownVisits.map((v) => (
                <div key={v.visit_id + v.created_at} className="av2-pane">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate"
                      style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}
                      title={v.path}
                    >
                      {v.path}
                    </span>
                    <span className="shrink-0" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {v.user_id ? 'Identified' : '—'}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{formatTime(v.created_at)}</p>
                </div>
              ))}
            </div>
            {/* Visit table — desktop */}
            <div className="hidden md:block max-h-64 overflow-y-auto" style={{ marginTop: 'var(--a-s2)' }}>
              <div className="av2-rgrid" role="table" aria-label="Recent visits" style={leadGridStyle}>
                <div
                  className="av2-rgrid__head"
                  role="row"
                  style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--a-inset)' }}
                >
                  <span role="columnheader" className="av2-rgrid__h">Time</span>
                  <span role="columnheader" className="av2-rgrid__h">Path</span>
                  <span role="columnheader" className="av2-rgrid__h">User</span>
                </div>
                {shownVisits.map((v) => (
                  <div key={v.visit_id + v.created_at} role="row" className="av2-rgrid__row">
                    <span
                      role="cell"
                      data-label="Time"
                      className="av2-rgrid__c"
                      style={{ color: 'var(--a-text-2)', whiteSpace: 'nowrap' }}
                    >
                      {formatTime(v.created_at)}
                    </span>
                    <span
                      role="cell"
                      data-label="Path"
                      className="av2-rgrid__c"
                      style={{
                        fontFamily: 'var(--a-font-mono)',
                        color: 'var(--a-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={v.path}
                    >
                      {v.path}
                    </span>
                    <span role="cell" data-label="User" className="av2-rgrid__c" style={{ color: 'var(--a-text-2)' }}>
                      {v.user_id ? 'Yes' : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {/* 11F: a trailing footnote was deleted here, not restyled. It read "Hot
          leads and engagement scoring require CRM API or a contacts table. GA4
          panel will show acquisition and conversion funnel." Both halves were
          false by the time it was read: the prior CRM vendor was decommissioned
          2026-06-24, the contacts table it says is missing is crm_people and
          holds 22,977 rows (18,379 with an assigned broker, checked
          2026-08-08), and the GA4 panel it promises in future tense is already
          mounted above it on this same page. Lead scoring also exists — see
          getInboundTriage. A sentence explaining an absence that is not the
          reason is worse than no sentence. */}
    </div>
  )
}
