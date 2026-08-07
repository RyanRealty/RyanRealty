// @no-parity — internal admin surface; no mockup contract (CRM reporting suite)
/**
 * Call Logs — the chronological, broker-scoped, paginated ledger of individual
 * inbound calls and voicemails. The Calls report links here for recording
 * playback and transcripts.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. Carried over verbatim: the getCrmAccess guard + redirect,
 * scopeBroker, the superuser broker-filter branch, the `date` default
 * ('this_month'), the `page` parse (Math.max(0, parseInt(...) || 0)), the
 * getCallLogsReport read, the pagination arithmetic, every formatter, and every
 * href (person, recording, transcript, page links, refresh, back). ONE truth
 * correction: a failed read now says so instead of rendering zeros as data
 * (CLAUDE.md §0).
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getCallLogsReport,
  CALL_LOGS_PAGE_SIZE,
  type CallLogEntry,
  type CallLogOutcome,
} from '@/lib/data/crm/getCallLogsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { formatDate } from '@/lib/format/date'
import { SectionHead, StateWord, VerdictLine, type AdminState } from '@/components/admin/v2'
import CallsFilters from '../calls/CallsFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Call Logs | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as "Xm Ys" for table cells, or "—" when null/zero. */
function formatDuration(sec: number | null): string {
  if (sec === null || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** Format an ISO timestamp as "Jun 25 · 10:48 AM" (Pacific, matching broker timezone). */
function formatCallTime(iso: string): string {
  const date = formatDate(iso, { month: 'short', day: 'numeric' })
  const time = formatDate(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} · ${time}`
}

/** Format a E.164 phone number as "(541) 213-6706". */
function formatPhone(raw: string | null): string {
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    const d = digits.slice(1)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

const OUTCOME_LABELS: Record<CallLogOutcome, string> = {
  connected: 'Connected',
  received: 'Received',
  voicemail: 'Voicemail',
}

/** Status is text + color, never color alone (WCAG 1.4.1). */
const OUTCOME_TONE: Record<CallLogOutcome, AdminState> = {
  connected: 'ok',
  received: 'waiting',
  voicemail: 'slow',
}

const DATE_WORDS: Record<string, string> = {
  today: 'today',
  this_week: 'this week',
  this_month: 'this month',
  this_year: 'this year',
}
function windowWords(preset: string): string {
  return DATE_WORDS[preset] ?? 'this period'
}

// ── Presentation constants (v2 tokens only) ───────────────────────────────────

const COLS =
  'minmax(140px,1.1fr) minmax(150px,1.4fr) minmax(104px,0.9fr) minmax(84px,0.7fr) minmax(78px,0.7fr) minmax(112px,0.9fr) minmax(130px,1fr)'

const PAGE: CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: 16 }
const TOOLBAR: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--a-s3)',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 12,
}
const SCROLLER: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
}
const GRID: CSSProperties = { minWidth: 880 }
const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLS,
  gap: 'var(--a-s3)',
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
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', display: 'block' }
const STAMP: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
  whiteSpace: 'nowrap',
}
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
const PAGER: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--a-s3)',
  marginTop: 'var(--a-s4)',
  fontSize: 'var(--a-text-sm)',
  color: 'var(--a-text-2)',
}
const PAGER_OFF: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

// ── Cells ─────────────────────────────────────────────────────────────────────

/**
 * The person is a door — resolved name when we have it, the caller's number
 * when we do not (honest fallback, never hides the data).
 */
function PersonCell({ entry }: { entry: CallLogEntry }) {
  const display = entry.personName ?? formatPhone(entry.fromNumber)
  return (
    <Link href={`/admin/crm/${entry.personId}`} style={LINK}>
      {display}
    </Link>
  )
}

/** The recording is a door too — play the audio, or open the transcript. */
function RecordingCell({ entry }: { entry: CallLogEntry }) {
  if (!entry.hasRecording && !entry.hasTranscript) {
    return <span style={MUTED}>—</span>
  }
  return (
    <span style={{ display: 'flex', gap: 'var(--a-s3)', flexWrap: 'wrap' }}>
      {entry.recordingPath ? (
        <a href={entry.recordingPath} target="_blank" rel="noopener noreferrer" style={LINK}>
          Play
        </a>
      ) : null}
      {entry.hasTranscript ? (
        <Link href={`/admin/crm/${entry.personId}?tab=timeline`} style={LINK}>
          Transcript
        </Link>
      ) : null}
    </span>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <span className="av2-wk">
      <span className="av2-wk__n">{value}</span>
      <span className="av2-wk__l">{label}</span>
    </span>
  )
}

// ── Search params ─────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  page?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CallLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as string
  const currentPage = Math.max(0, parseInt(sp.page ?? '0', 10) || 0)

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch paginated call log entries
  const report = await getCallLogsReport({
    brokerSlug: brokerFilter,
    datePreset,
    page: currentPage,
  }).catch(() => null)

  // A failed read is NOT an empty ledger — say so rather than print zeros.
  const unreadable = report === null
  const entries: CallLogEntry[] = report?.entries ?? []
  const totalCount = report?.totalCount ?? 0
  const callCount = report?.callCount ?? 0
  const voicemailCount = report?.voicemailCount ?? 0

  // Pagination metadata
  const totalPages = Math.max(1, Math.ceil(totalCount / CALL_LOGS_PAGE_SIZE))
  const showingFrom = totalCount === 0 ? 0 : currentPage * CALL_LOGS_PAGE_SIZE + 1
  const showingTo = Math.min((currentPage + 1) * CALL_LOGS_PAGE_SIZE, totalCount)

  /** Build a URL that preserves broker + date filters and changes only the page. */
  function pageHref(p: number): string {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      page: String(p),
    })
    return `/admin/crm/reporting/call-logs?${params.toString()}`
  }

  const period = windowWords(currentDate)
  const refreshHref = `/admin/crm/reporting/call-logs?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingTabStrip active="call-logs" />

      {unreadable ? (
        <VerdictLine tone="attention">
          <b>The call ledger could not be read.</b> Nothing is shown rather than a wrong number —
          refresh below, and if it keeps failing the timeline read is down.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {totalCount.toLocaleString('en-US')} call record{totalCount === 1 ? '' : 's'}
          </b>{' '}
          {period} · {callCount.toLocaleString('en-US')} call
          {callCount === 1 ? '' : 's'} · {voicemailCount.toLocaleString('en-US')} voicemail
          {voicemailCount === 1 ? '' : 's'}.
        </VerdictLine>
      )}

      <div style={TOOLBAR}>
        <Link href={refreshHref} className="av2-btn" style={{ textDecoration: 'none' }}>
          Refresh results
        </Link>
        {/* Reuses CallsFilters — identical broker + date filter bar.
            usePathname() inside the component resolves the call-logs URL,
            so navigation updates this page's params correctly. */}
        {isSuperuser ? (
          <CallsFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        ) : null}
      </div>

      {/*
        Three figures: Calls (kind='call') · Voicemails (kind='voicemail') · Total.

        A dedicated "Connected" figure is intentionally absent here: the count
        requires filtering on a JSONB subkey (payload.recordingSid), which is not
        expressible in a count:'exact' PostgREST query. Per-row outcome below is
        the correct place to read connected status; the aggregate lives on the
        parent Calls report.
      */}
      {unreadable ? null : (
        <>
          <SectionHead>
            {period === 'this period' ? 'This period' : period[0].toUpperCase() + period.slice(1)}
          </SectionHead>
          <div className="av2-week">
            <Figure value={callCount.toLocaleString('en-US')} label="calls — all inbound" />
            <Figure value={voicemailCount.toLocaleString('en-US')} label="voicemails — missed calls" />
            <Figure value={totalCount.toLocaleString('en-US')} label="total — calls + voicemails" />
          </div>
        </>
      )}

      <SectionHead>The ledger — newest first</SectionHead>

      {unreadable ? (
        <div style={STATE_PANEL}>
          Could not read the call timeline.{' '}
          <Link href={refreshHref} style={LINK}>
            Try again
          </Link>
          .
        </div>
      ) : entries.length === 0 ? (
        <div style={STATE_PANEL}>
          No calls {period}. Widen the date range, or switch the agent filter above.
        </div>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={GRID} role="table" aria-label="Call log">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Date / time</span>
              <span style={HEAD_CELL} role="columnheader">Person</span>
              <span style={HEAD_CELL} role="columnheader">Agent</span>
              <span style={HEAD_CELL} role="columnheader">Direction</span>
              <span style={HEAD_NUM} role="columnheader">Duration</span>
              <span style={HEAD_CELL} role="columnheader">Outcome</span>
              <span style={HEAD_CELL} role="columnheader">Recording</span>
            </div>

            {entries.map((entry) => (
              <div style={ROW} role="row" key={entry.id}>
                {/* Date / time — Pacific, matches broker timezone */}
                <span role="cell" style={STAMP}>{formatCallTime(entry.ts)}</span>
                {/* Person — linked; phone fallback for unresolved callers */}
                <span role="cell"><PersonCell entry={entry} /></span>
                <span role="cell">{entry.brokerName ?? '—'}</span>
                {/* Direction — always Inbound in V1 */}
                <span role="cell" style={MUTED}>Inbound</span>
                {/* Duration — "—" for voicemails and unrecorded calls */}
                <span role="cell" style={NUM}>{formatDuration(entry.durationSec)}</span>
                <span role="cell">
                  <StateWord state={OUTCOME_TONE[entry.outcome]}>
                    {OUTCOME_LABELS[entry.outcome]}
                  </StateWord>
                </span>
                <span role="cell"><RecordingCell entry={entry} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!unreadable && totalCount > 0 ? (
        <div style={PAGER}>
          <p style={{ fontVariantNumeric: 'tabular-nums' }}>
            Showing {showingFrom.toLocaleString('en-US')}–{showingTo.toLocaleString('en-US')} of{' '}
            {totalCount.toLocaleString('en-US')}
          </p>

          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--a-s2)' }}>
            {currentPage > 0 ? (
              <Link
                href={pageHref(currentPage - 1)}
                className="av2-btn av2-btn--quiet"
                style={{ textDecoration: 'none' }}
              >
                Previous
              </Link>
            ) : (
              <span className="av2-btn av2-btn--quiet" style={PAGER_OFF} aria-disabled="true">
                Previous
              </span>
            )}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              Page {currentPage + 1} of {totalPages}
            </span>
            {currentPage < totalPages - 1 ? (
              <Link
                href={pageHref(currentPage + 1)}
                className="av2-btn av2-btn--quiet"
                style={{ textDecoration: 'none' }}
              >
                Next
              </Link>
            ) : (
              <span className="av2-btn av2-btn--quiet" style={PAGER_OFF} aria-disabled="true">
                Next
              </span>
            )}
          </span>
        </div>
      ) : null}

      <p style={NOTE}>
        Direction is inbound only — outbound click-to-call is not tracked yet.
      </p>

      <p style={NOTE}>
        Results may be cached for up to 10 minutes.{' '}
        <Link href={refreshHref} style={LINK}>
          Refresh results
        </Link>
        .{' '}
        <Link href="/admin/crm/reporting/calls" style={LINK}>
          Back to the Calls report
        </Link>
        .
      </p>
    </div>
  )
}
