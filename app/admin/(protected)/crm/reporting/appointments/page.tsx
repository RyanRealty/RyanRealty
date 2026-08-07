// @no-parity — internal admin surface
/**
 * Appointments — what was set and what came of it, by agent and lead source.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only. Carried over verbatim: the getCrmAccess guard + redirect,
 * scopeBroker, the superuser broker-filter branch, the `date` default
 * ('this_month'), the getAppointmentsReport read, the delta arithmetic
 * (current − previous, "no change" at zero, suppressed when previous is 0), the
 * all-day date formatting, the 500-row ceiling notice, and every href. ONE truth
 * correction: a failed read now says so instead of rendering zeros as data
 * (CLAUDE.md §0).
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAppointmentsReport,
  type AppointmentRow,
  type AppointmentsTotals,
  type OutcomeBucket,
} from '@/lib/data/crm/getAppointmentsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { formatDate, formatDateTime as fmtDateTimeFn } from '@/lib/format/date'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import AppointmentsFilters from './AppointmentsFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Appointments | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO datetime for display: "Jun 30, 2026" or "Jun 30, 2026, 2:00 PM" */
function formatAppointmentDate(iso: string, allDay: boolean): string {
  return allDay ? formatDate(iso) : fmtDateTimeFn(iso)
}

/**
 * Change vs the previous period — the same arithmetic the report has always
 * used: no comparison when the previous period was empty, "no change" at zero.
 */
function delta(current: number, previous: number): { text: string; color: string } | null {
  if (previous === 0) return null
  const diff = current - previous
  if (diff === 0) return { text: 'no change', color: 'var(--a-text-2)' }
  const isUp = diff > 0
  return {
    text: `${isUp ? '↑' : '↓'} ${Math.abs(diff)} vs prev`,
    color: isUp ? 'var(--a-ok)' : 'var(--a-danger)',
  }
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
  'minmax(160px,1.2fr) minmax(150px,1.3fr) minmax(104px,0.9fr) minmax(112px,0.9fr) minmax(112px,0.9fr) minmax(120px,1fr)'

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
const GRID: CSSProperties = { minWidth: 820 }
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
const STAMP: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 'var(--a-text-sm)',
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

// ── Figure ────────────────────────────────────────────────────────────────────

function Figure({
  value,
  label,
  change,
}: {
  value: string
  label: string
  change?: { text: string; color: string } | null
}) {
  return (
    <span className="av2-wk">
      <span className="av2-wk__n">{value}</span>
      <span className="av2-wk__l">
        {label}
        {change ? (
          <span style={{ color: change.color, fontVariantNumeric: 'tabular-nums' }}> · {change.text}</span>
        ) : null}
      </span>
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

export default async function AppointmentsReportPage({
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
  const report = await getAppointmentsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  // A failed read is NOT zero appointments — say so rather than print a wrong figure.
  const unreadable = report === null
  const totals: AppointmentsTotals = report?.totals ?? {
    total: 0, set: 0, previousTotal: 0, previousSet: 0,
  }
  const rows: AppointmentRow[] = report?.rows ?? []
  const byOutcome: OutcomeBucket[] = report?.byOutcome ?? []

  const period = windowWords(currentDate)
  const refreshHref = `/admin/crm/reporting/appointments?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`

  return (
    <div className="av2-scope" style={PAGE}>
      <ReportingTabStrip active="appointments" />

      {unreadable ? (
        <VerdictLine tone="attention">
          <b>Appointment data could not be read.</b> Nothing is shown rather than a wrong number —
          refresh below, and if it keeps failing the appointments read is down.
        </VerdictLine>
      ) : (
        <VerdictLine tone="ok">
          <b>
            {totals.total.toLocaleString('en-US')} appointment{totals.total === 1 ? '' : 's'}
          </b>{' '}
          {period} · {totals.set.toLocaleString('en-US')} attached to a lead.
        </VerdictLine>
      )}

      <div style={TOOLBAR}>
        <Link href={refreshHref} className="av2-btn" style={{ textDecoration: 'none' }}>
          Refresh results
        </Link>
        {/* Filter controls — superuser only; non-superusers are broker-scoped */}
        {isSuperuser ? (
          <AppointmentsFilters
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
        Figures:
          APPOINTMENTS (total)  — crm_appointments, broker-scoped, start_at in range
          SET (has person)      — same WHERE person_id IS NOT NULL
          + per-outcome buckets — tallied from the 500-row detail fetch

        Honest empty state: outcome buckets are absent when no outcome data
        exists — never a guessed zero.
      */}
      {unreadable ? null : (
        <>
          <SectionHead>
            {period === 'this period' ? 'This period' : period[0].toUpperCase() + period.slice(1)}
          </SectionHead>
          <div className="av2-week">
            <Figure
              value={totals.total.toLocaleString('en-US')}
              label="appointments"
              change={delta(totals.total, totals.previousTotal)}
            />
            <Figure
              value={totals.set.toLocaleString('en-US')}
              label="set"
              change={delta(totals.set, totals.previousSet)}
            />
            {byOutcome.map((bucket) => (
              <Figure
                key={bucket.outcomeName}
                value={bucket.count.toLocaleString('en-US')}
                label={bucket.outcomeName}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead>Every appointment</SectionHead>

      {unreadable ? (
        <div style={STATE_PANEL}>
          Could not read the appointment calendar.{' '}
          <Link href={refreshHref} style={LINK}>
            Try again
          </Link>
          .
        </div>
      ) : rows.length === 0 ? (
        <div style={STATE_PANEL}>
          No appointments {period}. Widen the date range, or switch the agent filter above.
        </div>
      ) : (
        <div style={SCROLLER} tabIndex={0}>
          <div style={GRID} role="table" aria-label="Appointments">
            <div style={HEAD_ROW} role="row">
              <span style={HEAD_CELL} role="columnheader">Date / time</span>
              <span style={HEAD_CELL} role="columnheader">Person</span>
              <span style={HEAD_CELL} role="columnheader">Agent</span>
              <span style={HEAD_CELL} role="columnheader">Type</span>
              <span style={HEAD_CELL} role="columnheader">Outcome</span>
              <span style={HEAD_CELL} role="columnheader">Lead source</span>
            </div>

            {rows.map((row) => (
              <div style={ROW} role="row" key={row.id}>
                <span role="cell" style={STAMP}>
                  {formatAppointmentDate(row.startAt, row.allDay)}
                </span>
                {/* Person — a door to the contact when one is linked */}
                <span role="cell">
                  {row.personId ? (
                    <Link href={`/admin/crm/${row.personId}`} style={LINK}>
                      {row.personName ?? `Person #${row.personId}`}
                    </Link>
                  ) : (
                    <span style={MUTED}>—</span>
                  )}
                </span>
                <span role="cell">{row.brokerName}</span>
                <span role="cell">
                  {row.typeLabel ? row.typeLabel : <span style={MUTED}>—</span>}
                </span>
                <span role="cell">
                  {row.outcomeLabel ? row.outcomeLabel : <span style={MUTED}>—</span>}
                </span>
                <span role="cell" style={MUTED}>{row.leadSource ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!unreadable && rows.length >= 500 ? (
        <p style={NOTE}>
          Showing the 500 most recent appointments. Narrow the date range to see earlier records.
        </p>
      ) : null}

      <p style={NOTE}>
        Results may be cached for up to 10 minutes.{' '}
        <Link href={refreshHref} style={LINK}>
          Refresh results
        </Link>
        . Schedule and manage appointments in the{' '}
        <Link href="/admin/crm?filter=appointments" style={LINK}>
          CRM Calendar
        </Link>
        .
      </p>
    </div>
  )
}
