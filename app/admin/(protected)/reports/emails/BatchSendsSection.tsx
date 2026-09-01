// @no-parity — admin-internal reporting section, no public mockup contract.
/**
 * Batch sends — how each bulk send performed, one row per campaign with the
 * live in-flight strip. Ported verbatim from the standalone
 * /admin/crm/reporting/batch-emails page when email performance consolidated
 * into ONE home under Reports (Matt lock 2026-09-01, decisions.md "UX
 * CONSOLIDATION LOCKS" #3). The per-send funnel detail stays at
 * /admin/crm/reporting/batch-emails/[jobId] — every row doors there.
 */
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { getBatchEmailsReport, type BatchEmailRow } from '@/lib/data/crm/getBatchEmailsReport'
import {
  getRecentCrmBulkJobs,
  inFlightEmailCohortJobs,
} from '@/lib/data/crm/getCrmBulkJob'
import { formatDate } from '@/lib/format/date'
import { Button, SectionHead, StateWord } from '@/components/admin/v2'
import BulkProgress from '@/components/admin/crm/BulkProgress'
import { refreshBatchEmailsAction } from '../../crm/reporting/batch-emails/actions'

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

// Ten columns: subject, from, created, recipients, sent, delivered, bounced,
// opens, clicks, status.
const COLS =
  'minmax(170px,2fr) minmax(92px,0.9fr) minmax(72px,0.7fr) minmax(72px,0.6fr) minmax(62px,0.5fr) minmax(78px,0.6fr) minmax(72px,0.6fr) minmax(72px,0.6fr) minmax(72px,0.6fr) minmax(120px,1fr)'

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

/**
 * A text-styled Refresh control. It has to be a form + submit button rather than
 * a link, because the thing that needs busting is a cache tag, not a URL.
 */
function RefreshLink({ children }: { children: React.ReactNode }) {
  return (
    <form action={refreshBatchEmailsAction} style={{ display: 'inline-block' }}>
      <Button type="submit" variant="quiet">{children}</Button>
    </form>
  )
}

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
  const href =
    row.jobId != null
      ? `/admin/crm/reporting/batch-emails/${row.jobId}`
      : `/admin/reports/emails?q=${encodeURIComponent(row.subject ?? '')}`
  return (
    <span style={{ display: 'flex', gap: 'var(--a-s2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <StateWord state={row.status === 'finished' ? 'ok' : 'waiting'}>
        {row.status === 'finished' ? 'Finished' : 'Sending'}
      </StateWord>
      <Link href={href} style={{ ...LINK, fontSize: 'var(--a-text-sm)' }}>
        Recipients
      </Link>
    </span>
  )
}

export async function BatchSendsSection({
  scope,
  scopedEmail,
}: {
  /** Broker scope slug, or null for the whole company (superuser). */
  scope: string | null
  /** The scoped broker's email — keys the in-flight job read when scoped. */
  scopedEmail: string
}) {
  // A bare .catch(() => null) here rendered a thrown read as the honest-looking
  // "No batch emails found" empty state, which is the worst of both: the page
  // looks fine and the failure is invisible. Log it, and report it as
  // unreadable rather than as empty.
  const result = await getBatchEmailsReport(scope).catch((e) => {
    console.error('[batch-emails report]', e instanceof Error ? e.message : e)
    return null
  })
  const rows: BatchEmailRow[] = result?.rows ?? []
  const unreadable = result === null || result.unreadable
  const inFlight = inFlightEmailCohortJobs(
    await getRecentCrmBulkJobs(scope ? scopedEmail : undefined),
  )

  return (
    <section aria-label="Batch sends">
      {inFlight.length > 0 ? (
        <>
          <SectionHead>In flight</SectionHead>
          <p style={{ ...MUTED, marginTop: 8, marginBottom: 4 }}>
            Queued and running batch sends. These numbers update live — you do not need to Refresh.
          </p>
          {inFlight.map((job) => (
            <BulkProgress key={job.id} jobId={job.id} />
          ))}
        </>
      ) : null}

      <SectionHead>Batch sends</SectionHead>

      {unreadable ? (
        /* DB error — honest error state, never fake data */
        <div style={STATE_PANEL}>
          Could not load email campaign data.{' '}
          <RefreshLink>Try again</RefreshLink>
          .
        </div>
      ) : rows.length === 0 ? (
        /* No campaigns yet — honest empty state */
        <div style={STATE_PANEL}>
          No batch emails found. Batch Email sends from the People list and blasts from the email admin both appear here.
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
              <span style={HEAD_NUM} role="columnheader">Delivered</span>
              <span style={HEAD_NUM} role="columnheader">Bounced</span>
              <span style={HEAD_NUM} role="columnheader">Opens</span>
              <span style={HEAD_NUM} role="columnheader">Clicks</span>
              <span style={HEAD_CELL} role="columnheader">Status</span>
            </div>

            {rows.map((row) => (
              <div style={ROW} role="row" key={row.id}>
                <span role="cell" style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                  <Link
                    href={
                      row.jobId != null
                        ? `/admin/crm/reporting/batch-emails/${row.jobId}`
                        : `/admin/reports/emails?q=${encodeURIComponent(row.subject ?? '')}`
                    }
                    style={LINK}
                    title={row.subject ?? undefined}
                  >
                    {subjectDisplay(row.subject)}
                  </Link>
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
                  <EventCell count={row.delivered} rate={null} tracked={row.tracked} />
                </span>
                <span role="cell">
                  <EventCell count={row.bounced} rate={null} tracked={row.tracked} />
                </span>
                <span role="cell">
                  <EventCell count={row.opens} rate={row.openRate} tracked={row.tracked} />
                </span>
                <span role="cell">
                  <EventCell count={row.clicks} rate={row.clickRate} tracked={row.tracked} />
                </span>
                <span role="cell"><StatusCell row={row} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={NOTE}>
        Open rate is opens ÷ delivered and click rate is clicks ÷ delivered; both read “—” when a
        campaign has no delivery events rather than a fabricated 0%. Batch results may be cached
        for up to 10 minutes.{' '}
        <RefreshLink>Refresh</RefreshLink>
      </p>
    </section>
  )
}
