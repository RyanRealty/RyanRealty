// @no-parity — admin-internal reporting surface, no public mockup contract.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getEmailSendLog,
  getEmailEngagementSummary,
  getBrokerEmailEngagement,
  formatRate,
  type EmailSendLogRow,
} from '@/lib/data/crm/getEmailReporting'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { KpiStrip } from '@/components/console/KpiStrip'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { formatDateTime } from '@/lib/format/date'
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

/** Tone for the lifecycle-event pill, so a bounce reads red and a click green. */
function eventTone(event: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (event) {
    case 'click':
    case 'open':
      return 'default'
    case 'bounce':
    case 'complaint':
      return 'destructive'
    case 'unsubscribe':
      return 'outline'
    default:
      return 'secondary'
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
  }
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

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email reporting</h1>
        <p className="text-sm text-muted-foreground">
          Every sent email and its engagement, read from the unified email-events store. Open and click rates are computed against deliveries. A rate reads a dash when there is nothing to measure, never a false zero.
        </p>
      </header>

      {/* Engagement summary — counts + honest rates over the filtered window. */}
      <KpiStrip
        items={[
          { label: 'Sent', value: summary.sent.toLocaleString('en-US') },
          { label: 'Delivered', value: summary.delivered.toLocaleString('en-US') },
          { label: 'Open rate', value: formatRate(summary.openRate) },
          { label: 'Click rate', value: formatRate(summary.clickRate) },
        ]}
      />
      <KpiStrip
        items={[
          { label: 'Opened', value: summary.opened.toLocaleString('en-US') },
          { label: 'Clicked', value: summary.clicked.toLocaleString('en-US') },
          { label: 'Bounced', value: summary.bounced.toLocaleString('en-US') },
          { label: 'Bounce rate', value: formatRate(summary.bounceRate) },
        ]}
      />

      {/* Filters — native GET form, the canonical CRM filter pattern. */}
      <form
        method="GET"
        action="/admin/reports/emails"
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        {scopedBroker ? (
          // A restricted broker cannot change the broker scope.
          <input type="hidden" name="broker" value={scopedBroker} />
        ) : (
          <select
            name="broker"
            defaultValue={sp.broker ?? 'all'}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
          >
            <option value="all">All brokers</option>
            {brokers.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name || b.slug}</option>
            ))}
          </select>
        )}
        <select
          name="type"
          defaultValue={sp.type ?? 'all'}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
        >
          <option value="all">All types</option>
          {SEND_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ''}
          aria-label="From date"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ''}
          aria-label="To date"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-auto"
        />
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Recipient or subject"
          aria-label="Search recipient or subject"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:h-9 sm:w-64"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" className="h-10 sm:h-9">Apply</Button>
          <Link
            href="/admin/reports/emails"
            className="flex h-10 items-center text-sm text-muted-foreground hover:text-foreground sm:h-9"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Per-broker engagement (superuser only — a scoped broker sees just self). */}
      {brokerEngagement.length > 0 ? (
        <ConsoleSection title="Engagement by broker">
          <TableWithMobileCards
            rows={brokerEngagement}
            cap={brokerEngagement.length}
            getRowKey={(b) => b.broker}
            columns={[
              { key: 'broker', header: 'Broker', className: 'font-medium text-foreground', cell: (b) => b.broker },
              { key: 'sent', header: 'Sent', className: 'text-right tabular-nums', cell: (b) => b.sent.toLocaleString('en-US') },
              { key: 'delivered', header: 'Delivered', className: 'text-right tabular-nums', cell: (b) => b.delivered.toLocaleString('en-US') },
              { key: 'openrate', header: 'Open rate', className: 'text-right tabular-nums', cell: (b) => formatRate(b.openRate) },
              { key: 'clickrate', header: 'Click rate', className: 'text-right tabular-nums', cell: (b) => formatRate(b.clickRate) },
              { key: 'bouncerate', header: 'Bounce rate', className: 'text-right tabular-nums', cell: (b) => formatRate(b.bounceRate) },
            ]}
            renderCard={(b) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="text-sm font-medium text-foreground">{b.broker}</div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {b.sent.toLocaleString('en-US')} sent · {b.delivered.toLocaleString('en-US')} delivered · open {formatRate(b.openRate)} · click {formatRate(b.clickRate)}
                  </p>
                </CardContent>
              </Card>
            )}
            empty={<>No broker engagement in this window yet.</>}
          />
        </ConsoleSection>
      ) : null}

      {/* The sent-email log — one row per send, latest lifecycle event. */}
      <ConsoleSection
        title="Sent email log"
        count={`(${log.count.toLocaleString('en-US')})`}
        action={<EmailLogCsvButton rows={csvRows} />}
      >
        {log.unreadable ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            The email-events store could not be read. The log is unavailable right now.
          </div>
        ) : (
          <TableWithMobileCards
            rows={log.rows}
            cap={PAGE_SIZE}
            getRowKey={(r) => r.key}
            columns={[
              {
                key: 'recipient',
                header: 'Recipient',
                className: 'font-medium text-foreground',
                cell: (r) =>
                  r.personId != null ? (
                    <Link href={`/admin/crm/${r.personId}`} className="hover:underline">
                      {r.recipientEmail}
                    </Link>
                  ) : (
                    r.recipientEmail
                  ),
              },
              { key: 'subject', header: 'Subject', className: 'text-muted-foreground', cell: (r) => r.subject ?? '—' },
              { key: 'broker', header: 'Broker', className: 'text-xs', cell: (r) => r.broker ?? '—' },
              { key: 'type', header: 'Type', className: 'text-xs', cell: (r) => r.sendType ?? '—' },
              {
                key: 'event',
                header: 'Latest event',
                cell: (r) => <Badge variant={eventTone(r.latestEvent)}>{r.latestEvent}</Badge>,
              },
              {
                key: 'at',
                header: 'When',
                className: 'text-xs text-muted-foreground whitespace-nowrap',
                cell: (r) => formatDateTime(r.latestAtIso),
              },
            ]}
            renderCard={(r) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">
                      {r.personId != null ? (
                        <Link href={`/admin/crm/${r.personId}`} className="hover:underline">
                          {r.recipientEmail}
                        </Link>
                      ) : (
                        r.recipientEmail
                      )}
                    </span>
                    <Badge variant={eventTone(r.latestEvent)} className="shrink-0">{r.latestEvent}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">{r.subject ?? '—'}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {(r.broker ?? '—')} · {(r.sendType ?? '—')} · {formatDateTime(r.latestAtIso)}
                  </p>
                </CardContent>
              </Card>
            )}
            empty={<>No sends match this filter yet. Email engagement appears here as the engine sends.</>}
          />
        )}

        {(hasPrev || hasNext) ? (
          <div className="mt-4 flex items-center justify-between">
            {hasPrev ? (
              <Link href={pageHref(page - 1)}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">Page {page}</span>
            {hasNext ? (
              <Link href={pageHref(page + 1)}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </ConsoleSection>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/analytics" className="underline hover:no-underline">Back to Performance</Link>
      </p>
    </main>
  )
}
