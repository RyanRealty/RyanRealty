// @no-parity — internal admin surface
/**
 * Batch emails — how each bulk send performed.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. Carried over verbatim: the getCrmAccess guard + redirect,
 * scopeBroker, the superuser-sees-all / broker-sees-own filter, the
 * getBatchEmailsReport read, the `unreadable` vs empty distinction, the rate
 * formatting (one decimal), the `tracked` "0 vs —" rule, the subject truncation,
 * and every href.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getBatchEmailsReport, type BatchEmailRow } from '@/lib/data/crm/getBatchEmailsReport'
import { formatDate } from '@/lib/format/date'
import { SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Batch Emails | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Formatters ────────────────────────────────────────────────────────────────

/** Short date like "Apr 9, '26". */
function shortDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric', year: '2-digit' })
}

/** Format a rate in [0,1] as e.g. "24.3%". Returns "—" for null (no data). */
function fmtRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

/** Subject truncated at ~60 chars for display. */
function subjectDisplay(subject: string | null): string {
  const s = (subject ?? '(No subject)').trim()
  return s.length > 65 ? `${s.slice(0, 62)}…` : s
}

// ── Presentation constants (v2 tokens only) ───────────────────────────────────

// Nine columns that must fit a 1280px window without sideways scroll: the
// minimums below sum to 844px + 64px of gaps + 32px of padding = 940px.
const COLS =
  'minmax(170px,2fr) minmax(92px,0.9fr) minmax(72px,0.7fr) minmax(80px,0.7fr) minmax(62px,0.6fr) minmax(78px,0.7fr) minmax(78px,0.7fr) minmax(92px,0.7fr) minmax(120px,1fr)'

const PAGE: CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: 16 }
const TOOLBAR: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--a-s3)',
  alignItems: 'center',
  marginTop: 12,
}
const SCROLLER: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
}
const GRID: CSSProperties = { minWidth: 940 }
const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLS,
  gap: 'var(--a-s2)',
  alignItems: 'baseline',
  padding: '10px 16px',
  borderTop: '1px solid var(--a-border)',
}
const HEAD_ROW: CSSProperties = { ...ROW, borderTop: 'none', background: 'var(--a-inset)' }
const HEAD_CELL: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
}
const HEAD_NUM: CSSProperties = { ...HEAD_CELL, textAlign: 'right' }
const NUM: CSSProperties = {
  display: 'block',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  color: 'var(--a-text)',
}
const NUM_MUTED: CSSProperties = { ...NUM, color: 'var(--a-text-2)' }
const RATE: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginLeft: 4 }
const LINK: CSSProperties = { color: 'var(--a-accent)' }
const MUTED: CSSProperties = { color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }
const NOTE: CSSProperties = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 12 }
const STATE_PANEL: CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
  padding: 'var(--a-s6)',
  textAlign: 'center',
  color: 'var(--a-text-2)',
  fontSize: 'var(--a-text-sm)',
}

// ── Cells ─────────────────────────────────────────────────────────────────────

/** Count + its rate, or the tracked-aware "0 vs —" fallback. */
function EventCell({ count, rate, tracked }: { count: number; rate: number | null; tracked: boolean }) {
  if (count > 0) {
    return (
      <span style={NUM}>
        {count.toLocaleString('en-US')}
        {rate !== null ? <span style={RATE}>{fmtRate(rate)}</span> : null}
      </span>
    )
  }
  return <span style={NUM_MUTED}>{tracked ? '0' : '—'}</span>
}

/** The send's state — and, when it finished, the door to its detail. */
function StatusCell({ row }: { row: BatchEmailRow }) {
  if (row.status === 'finished') {
    return (
      <span style={{ display: 'flex', gap: 'var(--a-s2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <StateWord state="ok">Finished</StateWord>
        <Link href={`/admin/crm/emails?campaign=${row.id}`} style={{ ...LINK, fontSize: 'var(--a-text-sm)' }}>
          Details
        </Link>
      </span>
    )
  }
  return <StateWord state="waiting">Draft</StateWord>
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = { t?: string }

export default async function BatchEmailsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)

  // Superusers (Matt) see all campaigns. Scoped brokers see only their own.
  const brokerFilter = access.role === 'superuser' ? null : scope

  const result = await getBatchEmailsReport(brokerFilter).catch(() => null)
  const rows: BatchEmailRow[] = result?.rows ?? []
  const unreadable = result?.unreadable ?? false

  const refreshHref = `/admin/crm/reporting/batch-emails?t=${Date.now()}`
  const finished = rows.filter((r) => r.status === 'finished').length

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingSubNav active="batch-emails" />

      {unreadable ? (
        <VerdictLine tone="attention">
          <b>Campaign data could not be read.</b> Nothing is shown rather than a wrong number —
          refresh below, and if it keeps failing the email tables are down.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {rows.length.toLocaleString('en-US')} recent campaign{rows.length === 1 ? '' : 's'}
          </b>
          {rows.length > 0 ? `, ${finished.toLocaleString('en-US')} of them sent.` : '.'} Opens and
          clicks come from tracked email events — “—” means the send has none.
        </VerdictLine>
      )}

      <div style={TOOLBAR}>
        {/* Refresh: appends ?t= to bust the 10-min cache */}
        <Link href={refreshHref} className="av2-btn" style={{ textDecoration: 'none' }}>
          Refresh
        </Link>
      </div>

      <SectionHead>Recent batch emails</SectionHead>

      {unreadable ? (
        /* DB error — honest error state, never fake data */
        <div style={STATE_PANEL}>
          Could not load email campaign data.{' '}
          <Link href={refreshHref} style={LINK}>
            Try again
          </Link>
          .
        </div>
      ) : rows.length === 0 ? (
        /* No campaigns yet — honest empty state */
        <div style={STATE_PANEL}>
          No batch emails found. Campaigns sent from the email admin appear here.
        </div>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={GRID} role="table" aria-label="Batch email campaigns">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Subject</span>
              <span style={HEAD_CELL} role="columnheader">From</span>
              <span style={HEAD_CELL} role="columnheader">Created</span>
              <span style={HEAD_NUM} role="columnheader">Recipients</span>
              <span style={HEAD_NUM} role="columnheader">Sent</span>
              <span style={HEAD_NUM} role="columnheader">Opens</span>
              <span style={HEAD_NUM} role="columnheader">Clicks</span>
              <span style={HEAD_NUM} role="columnheader">Unsubscribes</span>
              <span style={HEAD_CELL} role="columnheader">Status</span>
            </div>

            {rows.map((row) => (
              <div style={ROW} role="row" key={row.id}>
                {/* Subject — the campaign's own "Details" door lives in Status;
                    it is the one link this row has ever carried, kept verbatim. */}
                <span role="cell" style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                  <span title={row.subject ?? undefined}>{subjectDisplay(row.subject)}</span>
                </span>
                <span role="cell" style={MUTED}>{row.fromBrokerName ?? '—'}</span>
                <span role="cell" style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {shortDate(row.createdAtIso)}
                </span>
                <span role="cell">
                  {row.recipientCount > 0 ? (
                    <span style={NUM_MUTED}>{row.recipientCount.toLocaleString('en-US')}</span>
                  ) : (
                    <span style={NUM_MUTED}>—</span>
                  )}
                </span>
                <span role="cell">
                  {row.sent > 0 ? (
                    <span style={NUM}>{row.sent.toLocaleString('en-US')}</span>
                  ) : (
                    <span style={NUM_MUTED}>—</span>
                  )}
                </span>
                <span role="cell">
                  <EventCell count={row.opens} rate={row.openRate} tracked={row.tracked} />
                </span>
                <span role="cell">
                  <EventCell count={row.clicks} rate={row.clickRate} tracked={row.tracked} />
                </span>
                <span role="cell">
                  {row.unsubscribes > 0 ? (
                    <span style={NUM}>{row.unsubscribes.toLocaleString('en-US')}</span>
                  ) : (
                    <span style={NUM_MUTED}>{row.tracked ? '0' : '—'}</span>
                  )}
                </span>
                <span role="cell"><StatusCell row={row} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={NOTE}>
        Open rate is opens ÷ delivered and click rate is clicks ÷ delivered; both read “—” when a
        campaign has no delivery events rather than a fabricated 0%.
      </p>

      <p style={NOTE}>
        Results may be cached for up to 10 minutes.{' '}
        <Link href={refreshHref} style={LINK}>
          Refresh results
        </Link>
        .
      </p>
    </div>
  )
}
