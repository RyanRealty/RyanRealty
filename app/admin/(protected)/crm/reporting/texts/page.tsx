// @no-parity — internal admin surface
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard + redirect,
// scopeBroker, the superuser broker-filter branch, the `date` default
// ('this_month'), the getTextsReport read, every figure and its formatting
// (including the response-rate one-decimal format), and every href. ONE truth
// correction: a failed read now says so instead of rendering the zero-filled
// fallback as if it were data (CLAUDE.md §0).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getTextsReport, type TextsRow, type TextsTotals } from '@/lib/data/crm/getTextsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import BrokerDateFilters from '../_components/BrokerDateFilters'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Texts | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function peopleLabel(people: number): string {
  if (people === 0) return ''
  return `${people} ${people === 1 ? 'person' : 'people'}`
}

/** Rate as "N%" — one decimal, the format the report has always used. */
function formatRate(rate: number): string {
  return `${rate.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
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

const COLS = 'minmax(150px,1.6fr) repeat(4, minmax(96px,1fr))'

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
const GRID: CSSProperties = { minWidth: 620 }
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

/** Rate cell — "N%" or "—" when null. */
function RateCell({ rate }: { rate: number | null }) {
  if (rate == null) return <span style={{ ...NUM, color: 'var(--a-text-2)' }}>—</span>
  return <span style={NUM}>{formatRate(rate)}</span>
}

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

export default async function TextsReportPage({
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
  const report = await getTextsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  // A failed read is NOT zero texts — say so rather than print a wrong figure.
  const unreadable = report === null
  const rows: TextsRow[] = report?.rows ?? []
  const totals: TextsTotals = report?.totals ?? {
    sent: 0,
    sentPeople: 0,
    received: 0,
    receivedPeople: 0,
    conversations: 0,
    responseRate: null,
  }

  const period = windowWords(currentDate)
  const refreshHref = `/admin/crm/reporting/texts?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingSubNav active="texts" />

      {unreadable ? (
        <VerdictLine tone="attention">
          <b>Text data could not be read.</b> Nothing is shown rather than a wrong number — refresh
          below, and if it keeps failing the timeline read is down.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {totals.sent.toLocaleString('en-US')} text{totals.sent === 1 ? '' : 's'} sent
          </b>{' '}
          {period} · {totals.received.toLocaleString('en-US')} received ·{' '}
          {totals.conversations.toLocaleString('en-US')} two-way conversation
          {totals.conversations === 1 ? '' : 's'}
          {totals.responseRate != null ? ` · ${formatRate(totals.responseRate)} response rate` : ''}.
        </VerdictLine>
      )}

      <div style={TOOLBAR}>
        <Link href={refreshHref} className="av2-btn" style={{ textDecoration: 'none' }}>
          Refresh results
        </Link>
        {/* Filter controls — agent + date */}
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
        TEXTS SENT | TEXTS RECEIVED | CONVERSATIONS | RESPONSE RATE

        Honest empty state: RESPONSE RATE is "—" when no texts were sent
        (conversations / sentPeople × 100 cannot divide by zero).
      */}
      {unreadable ? null : (
        <>
          <SectionHead>
            {period === 'this period' ? 'This period' : period[0].toUpperCase() + period.slice(1)}
          </SectionHead>
          <div className="av2-week">
            <Figure
              value={totals.sent.toLocaleString('en-US')}
              label={`texts sent${totals.sentPeople > 0 ? ` · ${peopleLabel(totals.sentPeople)}` : ''}`}
            />
            <Figure
              value={totals.received.toLocaleString('en-US')}
              label={`texts received${totals.receivedPeople > 0 ? ` · ${peopleLabel(totals.receivedPeople)}` : ''}`}
            />
            <Figure
              value={totals.conversations.toLocaleString('en-US')}
              label={`conversations${
                totals.conversations > 0
                  ? ` · ${totals.conversations} ${totals.conversations === 1 ? 'person' : 'people'}`
                  : ''
              }`}
            />
            <Figure
              value={totals.responseRate != null ? formatRate(totals.responseRate) : '—'}
              label="response rate"
            />
          </div>
        </>
      )}

      <SectionHead>By broker</SectionHead>

      {unreadable ? (
        <div style={STATE_PANEL}>
          Could not read the text timeline.{' '}
          <Link href={refreshHref} style={{ color: 'var(--a-accent)' }}>
            Try again
          </Link>
          .
        </div>
      ) : rows.length === 0 ? (
        <div style={STATE_PANEL}>
          No texts logged {period}. Widen the date range, or switch the agent filter above.
        </div>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={GRID} role="table" aria-label="Texts by broker">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Name</span>
              <span style={HEAD_NUM} role="columnheader">Texts sent</span>
              <span style={HEAD_NUM} role="columnheader">Texts received</span>
              <span style={HEAD_NUM} role="columnheader">Conversations</span>
              <span style={HEAD_NUM} role="columnheader">Response rate</span>
            </div>

            {rows.map((row) => (
              <div style={ROW} role="row" key={row.brokerSlug}>
                <span role="cell">
                  {isSuperuser ? (
                    <Link
                      href={`/admin/crm/reporting/texts?broker=${row.brokerSlug}&date=${currentDate}`}
                      style={{ color: 'var(--a-accent)', fontWeight: 500 }}
                    >
                      {row.brokerName}
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 500 }}>{row.brokerName}</span>
                  )}
                </span>
                <span role="cell"><DualCell count={row.sent} people={row.sentPeople} /></span>
                <span role="cell"><DualCell count={row.received} people={row.receivedPeople} /></span>
                {/* Conversations — 2-way threads */}
                <span role="cell">
                  {row.conversations === 0 ? (
                    <span style={{ ...NUM, color: 'var(--a-text-2)' }}>0</span>
                  ) : (
                    <span style={{ ...NUM, fontWeight: 500 }}>{row.conversations}</span>
                  )}
                </span>
                <span role="cell"><RateCell rate={row.responseRate} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={NOTE}>
        Conversations counts people who both received a text and replied. Response rate is the share
        of texted people who replied back.
      </p>

      <p style={NOTE}>
        Results may be cached for up to 10 minutes.{' '}
        <Link href={refreshHref} style={{ color: 'var(--a-accent)' }}>
          Refresh results
        </Link>
        . Read and reply to individual conversations in the{' '}
        <Link href="/admin/messages" style={{ color: 'var(--a-accent)' }}>
          Inbox
        </Link>
        .
      </p>
    </div>
  )
}
