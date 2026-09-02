// @no-parity — internal admin surface
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard + redirect,
// scopeBroker, the superuser broker-filter branch, the `date` default
// ('this_month'), the getCallsReport read, every figure and its formatting, and
// every href. ONE truth correction: a failed read now says so instead of
// rendering the zero-filled fallback as if it were data (CLAUDE.md §0).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getCallsReport, type CallsRow, type CallsTotals } from '@/lib/data/crm/getCallsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import BrokerDateFilters from '../_components/BrokerDateFilters'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Calls | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as "N min M sec" or "—" when zero. */
function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} sec`
  return `${m} min ${s} sec`
}

function peopleLabel(people: number): string {
  if (people === 0) return ''
  return `${people} ${people === 1 ? 'person' : 'people'}`
}

/** Plain words for the selected date preset — the window the figures cover. */
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

const COLS = 'minmax(140px,1.6fr) repeat(7, minmax(78px,1fr))'

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
const GRID: CSSProperties = { minWidth: 840 }
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
const NUM: CSSProperties = {
  display: 'block',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  color: 'var(--a-text)',
}
const SUB: CSSProperties = {
  display: 'block',
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  fontWeight: 400,
}
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

/** Count + "N person/people" sub-label — the dual-value cell, stacked. */
function DualCell({ count, people }: { count: number; people: number }) {
  if (count === 0) return <span style={{ ...NUM, color: 'var(--a-text-2)' }}>0</span>
  return (
    <span style={{ ...NUM, fontWeight: 500 }}>
      {count.toLocaleString('en-US')}
      {people > 0 ? <span style={SUB}>{peopleLabel(people)}</span> : null}
    </span>
  )
}

/** Duration cell — formatted time or "—". */
function DurationCell({ sec }: { sec: number }) {
  if (sec <= 0) return <span style={{ ...NUM, color: 'var(--a-text-2)' }}>—</span>
  return <span style={NUM}>{formatDuration(sec)}</span>
}

/** One figure in the numbers strip. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <span className="av2-wk">
      <span className="av2-wk__n">{value}</span>
      <span className="av2-wk__l">{label}</span>
    </span>
  )
}

// ── Page params ───────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CallsReportPage({
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

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch report data
  const report = await getCallsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  // A failed read is NOT zero calls — say so rather than print a wrong figure.
  const unreadable = report === null
  const rows: CallsRow[] = report?.rows ?? []
  const totals: CallsTotals = report?.totals ?? {
    callsMade: 0, callsMadePeople: 0,
    connected: 0, connectedPeople: 0,
    conversations: 0, conversationsPeople: 0,
    received: 0, receivedPeople: 0,
    missed: 0, missedPeople: 0,
    talkTimeSec: 0, answerTimeSec: null,
  }

  const period = windowWords(currentDate)
  const refreshHref = `/admin/crm/reporting/calls?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingSubNav active="calls" />

      {unreadable ? (
        <VerdictLine tone="attention">
          <b>Call data could not be read.</b> Nothing is shown rather than a wrong number — refresh
          below, and if it keeps failing the timeline read is down.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {totals.received.toLocaleString('en-US')} call{totals.received === 1 ? '' : 's'} received
          </b>{' '}
          {period} · {totals.missed.toLocaleString('en-US')} missed ·{' '}
          {totals.conversations.toLocaleString('en-US')} with recorded talk time.
        </VerdictLine>
      )}

      <div style={TOOLBAR}>
        <Link href={refreshHref} className="av2-btn" style={{ textDecoration: 'none' }}>
          Refresh results
        </Link>
        {/* Filter controls — agent + date (no lead-type per the Calls reference) */}
        {isSuperuser ? (
          <BrokerDateFilters
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
        Figures, in the locked report order:
        CALLS MADE | CONNECTED | CONVERSATIONS | RECEIVED | CALLS MISSED | TALK TIME | ANSWER TIME

        Honest empty states for metrics without a data source:
        - CALLS MADE: 0 (outbound click-to-call not yet implemented)
        - CONNECTED PEOPLE: 0 (requires set-difference join — V1 approximation)
        - ANSWER TIME: "—" (not tracked; Twilio webhook fires before answer)
      */}
      {unreadable ? null : (
        <>
          <SectionHead>{period === 'this period' ? 'This period' : period[0].toUpperCase() + period.slice(1)}</SectionHead>
          <div className="av2-week">
            {/* Outbound click-to-call is not built, so this can only ever be
                zero — say "not tracked" (the answer-time idiom below) instead
                of a fabricated 0 that reads as "nobody called anyone". */}
            <Figure value="—" label="calls made — not tracked" />
            <Figure
              value={totals.connected.toLocaleString('en-US')}
              label={`connected${totals.connectedPeople > 0 ? ` · ${peopleLabel(totals.connectedPeople)}` : ''}`}
            />
            <Figure
              value={totals.conversations.toLocaleString('en-US')}
              label={`conversations${totals.conversationsPeople > 0 ? ` · ${peopleLabel(totals.conversationsPeople)}` : ''}`}
            />
            <Figure
              value={totals.received.toLocaleString('en-US')}
              label={`received${totals.receivedPeople > 0 ? ` · ${peopleLabel(totals.receivedPeople)}` : ''}`}
            />
            <Figure
              value={totals.missed.toLocaleString('en-US')}
              label={`missed${totals.missedPeople > 0 ? ` · ${peopleLabel(totals.missedPeople)}` : ''}`}
            />
            <Figure
              value={totals.talkTimeSec > 0 ? formatDuration(totals.talkTimeSec) : '—'}
              label="talk time"
            />
            <Figure value="—" label="answer time — not tracked" />
          </div>
        </>
      )}

      <SectionHead>By broker</SectionHead>

      {unreadable ? (
        <div style={STATE_PANEL}>
          Could not read the call timeline.{' '}
          <Link href={refreshHref} style={{ color: 'var(--a-accent)' }}>
            Try again
          </Link>
          .
        </div>
      ) : rows.length === 0 ? (
        <div style={STATE_PANEL}>
          No calls logged {period}. Widen the date range, or switch the agent filter above.
        </div>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={GRID} role="table" aria-label="Calls by broker">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Name</span>
              <span style={HEAD_NUM} role="columnheader">Calls made</span>
              <span style={HEAD_NUM} role="columnheader">Connected</span>
              <span style={HEAD_NUM} role="columnheader">Conversations</span>
              <span style={HEAD_NUM} role="columnheader">Received</span>
              <span style={HEAD_NUM} role="columnheader">Missed</span>
              <span style={HEAD_NUM} role="columnheader">Talk time</span>
              <span style={HEAD_NUM} role="columnheader">Answer time</span>
            </div>

            {rows.map((row) => (
              <div style={ROW} role="row" key={row.brokerSlug}>
                <span role="cell">
                  {isSuperuser ? (
                    <Link
                      href={`/admin/crm/reporting/calls?broker=${row.brokerSlug}&date=${currentDate}`}
                      style={{ color: 'var(--a-accent)', fontWeight: 500 }}
                    >
                      {row.brokerName}
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 500 }}>{row.brokerName}</span>
                  )}
                </span>
                {/* Calls made — outbound, not yet tracked */}
                <span role="cell"><DualCell count={row.callsMade} people={row.callsMadePeople} /></span>
                {/* Connected — answered inbound calls */}
                <span role="cell"><DualCell count={row.connected} people={row.connectedPeople} /></span>
                {/* Conversations — calls with recordingDurationSec > 0 */}
                <span role="cell"><DualCell count={row.conversations} people={row.conversationsPeople} /></span>
                {/* Received — all inbound calls */}
                <span role="cell"><DualCell count={row.received} people={row.receivedPeople} /></span>
                {/* Missed — went to voicemail */}
                <span role="cell"><DualCell count={row.missed} people={row.missedPeople} /></span>
                {/* Total talk time */}
                <span role="cell"><DurationCell sec={row.talkTimeSec} /></span>
                {/* Answer time — not tracked */}
                <span role="cell"><span style={{ ...NUM, color: 'var(--a-text-2)' }}>—</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={NOTE}>
        Connected counts answered inbound calls. Conversations counts calls with recorded talk time.
        Calls made covers outbound click-to-call, which is not tracked yet. Answer time is not
        currently tracked.
      </p>

      <p style={NOTE}>
        Results may be cached for up to 10 minutes.{' '}
        <Link href={refreshHref} style={{ color: 'var(--a-accent)' }}>
          Refresh results
        </Link>
        . Individual recordings and transcripts live in{' '}
        <Link href="/admin/crm?filter=calls" style={{ color: 'var(--a-accent)' }}>
          Call Logs
        </Link>
        .
      </p>
    </div>
  )
}
