// @no-parity — admin-internal reporting surface, no public mockup contract.
//
// Email reporting — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getCrmAccess guard + redirect, scopeBroker and the
// rule that a restricted broker's scope beats any ?broker= param, PAGE_SIZE 50
// and the offset arithmetic, the `page` parse, the requestedBroker /
// effectiveBroker branch, the dateFrom start-of-day and dateTo end-of-day ISO
// bounds, the sendType and q parses, the single `filter` object handed to all
// three reads, the four parallel reads, toCsvRow and the CSV column set,
// pageHref's param set and order, hasNext / hasPrev, all eight summary figures
// and their labels, formatRate for every rate, the six broker-engagement
// columns, the six log columns, every /admin/people/<personId> href, the form's
// five field names (broker · type · from · to · q) and their defaults, and the
// SEND_TYPES list. No metric, date window, filter default, sort order, unit or
// rounding moved.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the page-title <h1> is gone (the nav names the page), the two
// KPI strips became one typographic numbers strip in the same order, the raw
// <select>/<input> controls became the v2 field primitives on the same native
// GET form, both shadcn tables plus their parallel mobile card lists became the
// family's grid (one source of markup, scrolling inside its own box), and the
// lifecycle Badge became a StateWord — text plus color, never color alone.
//
// Two shape notes worth naming:
//   - A restricted broker's scope used to ride along in a hidden <input>. Hidden
//     inputs are raw markup the v2 language does not own, so the control is now
//     a one-option dropdown carrying the same slug. scopeBroker still decides
//     server-side, so the submitted value cannot widen anyone's scope.
//   - The Badge tones collapse to three states: opens and clicks read ok,
//     bounces and complaints read down, and everything else — delivered, sent,
//     unsubscribe — reads neutral, which is what the old 'secondary' and
//     'outline' variants both were.
//
// ONE truth correction (§0): the page checked log.unreadable but never
// summary.unreadable, so an unreadable engagement summary printed eight zeros
// and four "—" rates as if they were this window's measurement. A failed read
// now leads and is labelled.
//
// Wall-of-identical-states probe (ADMIN_UI §3 acceptance bar rule 6, run
// 2026-08-07 against dwvlophlbvvygjfxcrhm): email_events grouped by event =
// delivered 404 · sent 68 · open 58 · click 11 · bounce 6. Five real kinds, so
// the latest-event column is a genuine mix. complaint and unsubscribe have no
// rows yet; their tones are kept for when they arrive.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { BatchSendsSection } from './BatchSendsSection'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getEmailSendLog,
  getEmailEngagementSummary,
  getBrokerEmailEngagement,
  formatRate,
  type EmailSendLogRow,
} from '@/lib/data/crm/getEmailReporting'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { formatDateTime } from '@/lib/format/date'
import {
  Button,
  SectionHead,
  SelectField,
  StateWord,
  TextField,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'
import { EmailLogCsvButton, type EmailLogCsvRow } from './EmailLogCsvButton'

export const metadata: Metadata = {
  title: 'Email reporting',
  description: 'Brokerage-wide sent-email log and engagement rates from the unified email-events store.',
}

export const dynamic = 'force-dynamic'

/** Send types offered in the filter — matches the EmailSendType taxonomy. */
const SEND_TYPES = [
  'newsletter',
  'campaign',
  'cma',
  'market-report',
  'alert',
  'sequence',
  'one-off',
  'other',
] as const

/** Tone for the lifecycle event, so a bounce reads red and a click green. */
function eventTone(event: string): AdminState {
  switch (event) {
    case 'click':
    case 'open':
      return 'ok'
    case 'bounce':
    case 'complaint':
      return 'down'
    default:
      return 'waiting'
  }
}

type SearchParams = {
  broker?: string
  from?: string
  to?: string
  type?: string
  q?: string
  page?: string
}

const PAGE_SIZE = 50

function toCsvRow(r: EmailSendLogRow): EmailLogCsvRow {
  return {
    recipientEmail: r.recipientEmail,
    person: r.personId != null ? String(r.personId) : '',
    broker: r.broker ?? '',
    sendType: r.sendType ?? '',
    subject: r.subject ?? '',
    latestEvent: r.latestEvent,
    latestAt: formatDateTime(r.latestAtIso),
    messageId: r.messageId ?? '',
    openedAt: r.openedAtIso ? formatDateTime(r.openedAtIso) : '',
    clickedAt: r.clickedAtIso ? formatDateTime(r.clickedAtIso) : '',
    bouncedAt: r.bouncedAtIso ? formatDateTime(r.bouncedAtIso) : '',
    siteAfter: r.visitedAfterSend && r.lastSiteAt ? formatDateTime(r.lastSiteAt) : '',
  }
}

function campaignHref(emailKey: string | null): string | null {
  const m = /^bulk:email-cohort:(\d+)$/.exec(emailKey ?? '')
  return m ? `/admin/crm/reporting/batch-emails/${m[1]}` : null
}

export default async function AdminEmailReportingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Access + scope. The reports layout already gates superuser/report_viewer;
  // getCrmAccess resolves the caller's role + own slug, and scopeBroker enforces
  // that a restricted broker only ever sees their own sends.
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const scopedBroker = scopeBroker(access)

  const sp = await searchParams
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // A restricted broker's scope wins over any broker query param. A superuser
  // (scopedBroker === null) may filter to any broker via the dropdown.
  const requestedBroker = sp.broker?.trim() && sp.broker !== 'all' ? sp.broker.trim() : null
  const effectiveBroker = scopedBroker ?? requestedBroker

  // Date bounds: a `from` date is start-of-day, a `to` date is end-of-day, both
  // as ISO so the email_events occurred_at filter is inclusive.
  const dateFrom = sp.from?.trim() ? `${sp.from.trim()}T00:00:00.000Z` : null
  const dateTo = sp.to?.trim() ? `${sp.to.trim()}T23:59:59.999Z` : null
  const sendType = sp.type?.trim() && sp.type !== 'all' ? sp.type.trim() : null
  const q = sp.q?.trim() || null

  const filter = { broker: effectiveBroker, dateFrom, dateTo, sendType, q }

  const [log, summary, brokerEngagement, brokers] = await Promise.all([
    getEmailSendLog({ ...filter, limit: PAGE_SIZE, offset }),
    getEmailEngagementSummary(filter),
    getBrokerEmailEngagement(filter),
    getCrmBrokers(),
  ])

  const csvRows = log.rows.map(toCsvRow)

  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (sp.broker && sp.broker !== 'all') params.set('broker', sp.broker)
    if (sp.from) params.set('from', sp.from)
    if (sp.to) params.set('to', sp.to)
    if (sp.type && sp.type !== 'all') params.set('type', sp.type)
    if (sp.q) params.set('q', sp.q)
    params.set('page', String(p))
    return `/admin/reports/emails?${params.toString()}`
  }
  const hasNext = offset + log.rows.length < log.count
  const hasPrev = page > 1

  const figures: ReportNumberItem[] = [
    { key: 'sent', label: 'Sent', value: summary.sent.toLocaleString('en-US') },
    { key: 'delivered', label: 'Delivered', value: summary.delivered.toLocaleString('en-US') },
    { key: 'openrate', label: 'Open rate', value: formatRate(summary.openRate) },
    { key: 'clickrate', label: 'Click rate', value: formatRate(summary.clickRate) },
    { key: 'opened', label: 'Opened', value: summary.opened.toLocaleString('en-US') },
    { key: 'clicked', label: 'Clicked', value: summary.clicked.toLocaleString('en-US') },
    { key: 'bounced', label: 'Bounced', value: summary.bounced.toLocaleString('en-US') },
    { key: 'bouncerate', label: 'Bounce rate', value: formatRate(summary.bounceRate) },
  ]

  const brokerColumns: ReportColumn[] = [
    { key: 'broker', label: 'Broker' },
    { key: 'sent', label: 'Sent', numeric: true },
    { key: 'delivered', label: 'Delivered', numeric: true },
    { key: 'openrate', label: 'Open rate', numeric: true },
    { key: 'clickrate', label: 'Click rate', numeric: true },
    { key: 'bouncerate', label: 'Bounce rate', numeric: true },
  ]

  // Broker name → the broker's entity page (bar rule 3); brokers is already
  // fetched, so the slug→id map costs nothing.
  const brokerIdBySlug = new Map(brokers.filter((b) => b.id != null).map((b) => [b.slug, b.id as number]))
  const brokerCell = (slug: string) => {
    const id = brokerIdBySlug.get(slug)
    return id != null ? (
      <Link key="b" href={`/admin/brokers/edit?id=${id}`} style={{ color: 'var(--a-accent)' }}>
        {slug}
      </Link>
    ) : (
      slug
    )
  }
  const brokerGrid: ReportGridRow[] = brokerEngagement.map((b) => ({
    key: b.broker,
    cells: [
      brokerCell(b.broker),
      b.sent.toLocaleString('en-US'),
      b.delivered.toLocaleString('en-US'),
      formatRate(b.openRate),
      formatRate(b.clickRate),
      formatRate(b.bounceRate),
    ],
  }))

  const logColumns: ReportColumn[] = [
    { key: 'recipient', label: 'Recipient' },
    { key: 'subject', label: 'Subject' },
    { key: 'type', label: 'Type' },
    { key: 'event', label: 'Status' },
    { key: 'opened', label: 'Opened' },
    { key: 'clicked', label: 'Clicked' },
    { key: 'bounced', label: 'Bounced' },
    { key: 'site', label: 'On the site after' },
  ]

  const muted = { color: 'var(--a-text-2)' }

  const logGrid: ReportGridRow[] = log.rows.map((r) => {
    const bulkHref = campaignHref(r.emailKey)
    return {
      key: r.key,
      cells: [
        r.personId != null ? (
          <Link key="r" href={`/admin/people/${r.personId}`} style={{ color: 'var(--a-accent)' }}>
            {r.recipientEmail}
          </Link>
        ) : (
          r.recipientEmail
        ),
        bulkHref ? (
          <Link key="s" href={bulkHref} style={{ color: 'var(--a-accent)' }}>
            {r.subject ?? '—'}
          </Link>
        ) : (
          (r.subject ?? '—')
        ),
        r.sendType ?? '—',
        <StateWord key="e" state={eventTone(r.latestEvent)}>
          {r.latestEvent}
        </StateWord>,
        <span key="o" style={{ ...muted, whiteSpace: 'nowrap' }}>
          {r.openedAtIso ? formatDateTime(r.openedAtIso) : '—'}
        </span>,
        <span key="c" style={{ ...muted, whiteSpace: 'nowrap' }}>
          {r.clickedAtIso ? formatDateTime(r.clickedAtIso) : '—'}
        </span>,
        <span key="b" style={{ ...muted, whiteSpace: 'nowrap' }}>
          {r.bouncedAtIso ? formatDateTime(r.bouncedAtIso) : '—'}
        </span>,
        <span key="w" style={{ ...muted, whiteSpace: 'nowrap' }}>
          {r.visitedAfterSend && r.lastSiteAt
            ? formatDateTime(r.lastSiteAt)
            : r.lastSiteAt
              ? 'Earlier visit'
              : '—'}
        </span>,
      ],
    }
  })

  const unreadable = summary.unreadable || log.unreadable

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={unreadable ? 'attention' : 'ok'}>
          {unreadable ? (
            <>
              <b>The email-events store could not be read.</b> Nothing below is a measurement.
            </>
          ) : summary.delivered > summary.sent ? (
            <>
              {/* Lifecycle coverage is partial for some sends (a delivery or
                  open webhook landed without its sent row), so "X of Y sent"
                  would invert. State each tally on its own basis instead. */}
              <b>
                {summary.delivered.toLocaleString('en-US')} deliveries and{' '}
                {summary.sent.toLocaleString('en-US')} sent events recorded
              </b>{' '}
              — some sends are missing their sent row, so the two tallies have
              different coverage. Open rate {formatRate(summary.openRate)}, click
              rate {formatRate(summary.clickRate)}, against implied deliveries.
            </>
          ) : (
            <>
              <b>
                {summary.delivered.toLocaleString('en-US')} of{' '}
                {summary.sent.toLocaleString('en-US')} sent{' '}
                {summary.sent === 1 ? 'email was' : 'emails were'} delivered
              </b>{' '}
              — open rate {formatRate(summary.openRate)}, click rate{' '}
              {formatRate(summary.clickRate)}, against deliveries.
            </>
          )}
        </VerdictLine>
      </div>

      {unreadable ? <ReportError what="Email engagement" href="/admin/reports/emails" /> : null}

      <ReportNumbers items={figures} />

      {/* One email-performance home (Matt lock 2026-09-01): batch sends live
          here too; the old standalone Batch Emails list bridges to this page. */}
      <BatchSendsSection scope={scopedBroker} scopedEmail={access.email} />

      {/* Filters — native GET form, the canonical CRM filter pattern. */}
      <form method="get" action="/admin/reports/emails" className="av2-rfilters">
        <div className="av2-inline-form" style={{ maxWidth: 900 }}>
          <SelectField
            label="Broker"
            name="broker"
            defaultValue={scopedBroker ?? sp.broker ?? 'all'}
            hint={scopedBroker ? 'Your sends only.' : undefined}
          >
            {scopedBroker ? (
              <option value={scopedBroker}>{scopedBroker}</option>
            ) : (
              <>
                <option value="all">All brokers</option>
                {brokers.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name || b.slug}
                  </option>
                ))}
              </>
            )}
          </SelectField>
          <SelectField label="Send type" name="type" defaultValue={sp.type ?? 'all'}>
            <option value="all">All types</option>
            {SEND_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <TextField label="From" type="date" name="from" defaultValue={sp.from ?? ''} />
          <TextField label="To" type="date" name="to" defaultValue={sp.to ?? ''} />
          <TextField
            label="Recipient or subject"
            type="search"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Recipient or subject"
          />
          <Button type="submit">Apply</Button>
          <Link
            href="/admin/reports/emails"
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Per-broker engagement (superuser only — a scoped broker sees just self). */}
      {brokerEngagement.length > 0 ? (
        <>
          <SectionHead>Engagement by broker — most sent first</SectionHead>
          <ReportGrid
            label="Email engagement by broker"
            columns={brokerColumns}
            template="minmax(130px, 1.4fr) minmax(74px, 0.7fr) minmax(88px, 0.8fr) minmax(88px, 0.8fr) minmax(88px, 0.8fr) minmax(96px, 0.8fr)"
            minWidth={680}
            rows={brokerGrid}
            empty={<>No broker engagement in this window yet.</>}
          />
        </>
      ) : null}

      <SectionHead>Sent email log — newest first</SectionHead>
      {log.unreadable ? (
        <ReportError what="The sent-email log" href="/admin/reports/emails" />
      ) : (
        <ReportGrid
          label="Sent email log"
          columns={logColumns}
          template="minmax(160px, 1.5fr) minmax(160px, 1.6fr) minmax(88px, 0.7fr) minmax(88px, 0.7fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) minmax(130px, 1fr)"
          minWidth={1080}
          rows={logGrid}
          empty={<>No sends match this filter yet. Email engagement appears here as the engine sends.</>}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--a-s3)',
          marginTop: 'var(--a-s4)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
        }}
      >
        <p style={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}>
          Page {page} · {log.count.toLocaleString('en-US')} matching{' '}
          {log.count === 1 ? 'send' : 'sends'}
        </p>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--a-s2)' }}>
          {hasPrev ? (
            <Link
              href={pageHref(page - 1)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Previous
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(page + 1)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Next
            </Link>
          ) : null}
          <EmailLogCsvButton rows={csvRows} />
        </span>
      </div>

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Open and click rates are computed against deliveries. A rate reads a dash when there is
        nothing to measure, never a false zero. The CSV carries the {csvRows.length}{' '}
        {csvRows.length === 1 ? 'row' : 'rows'} on this page.{' '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Back to Performance
        </Link>
      </p>
    </div>
  )
}
