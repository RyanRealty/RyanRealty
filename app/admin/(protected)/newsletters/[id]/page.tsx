// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getNewsletter,
  getNewsletterStats,
  getNewsletterStatsFromLedger,
  getNewsletterBrokerBreakdown,
  getNewsletterRecipients,
  type NewsletterRecipient,
} from '@/lib/data'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import NewsletterComposeForm from '../NewsletterComposeForm'
import NewsletterDraftActions from '../NewsletterDraftActions'
import BulkOneOffForm from '../BulkOneOffForm'

export const metadata = { title: 'Newsletter | Admin' }
export const dynamic = 'force-dynamic'
// The "Send now" action loops subscribers; give it room past the 60s default.
// (At larger list sizes the next step is Resend's batch API.)
export const maxDuration = 300

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All subscribers',
  'segment:buyer': 'Buyers',
  'segment:seller': 'Sellers',
  'segment:past-client': 'Past clients',
}

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function recipientStatusPill(status: NewsletterRecipient['status']) {
  const tone = ({
    sent: 'neutral',
    delivered: 'info',
    opened: 'info',
    clicked: 'success',
    bounced: 'danger',
    complained: 'danger',
    failed: 'danger',
  } as const)[status]
  return <StatusPill tone={tone} label={status} />
}

function ClickedLinks({ links }: { links: NewsletterRecipient['clicked_links'] }) {
  if (!links || links.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <ul className="space-y-0.5">
      {links.slice(0, 5).map((l) => (
        <li key={l.url} className="flex items-center gap-1.5 text-xs">
          <span className="min-w-0 max-w-xs truncate text-foreground">{l.url}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">×{l.count}</span>
        </li>
      ))}
    </ul>
  )
}

export default async function NewsletterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const { id } = await params

  const letter = await getNewsletter(id)
  if (!letter) notFound()

  const isDraft = letter.status === 'draft'

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/newsletters" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to Newsletter</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{letter.subject || 'Untitled'}</h1>
        <StatusPill
          tone={({ draft: 'neutral', sending: 'info', sent: 'success', failed: 'danger' } as const)[letter.status]}
          label={letter.status}
        />
      </div>

      {isDraft ? (
        <DraftView id={id} letter={letter} />
      ) : (
        <StatsView id={id} sentBy={letter.sent_by} sentAt={letter.sent_at} status={letter.status} />
      )}
    </main>
  )
}

function DraftView({ id, letter }: { id: string; letter: Awaited<ReturnType<typeof getNewsletter>> }) {
  if (!letter) return null
  return (
    <div className="mt-6 space-y-6">
      <ConsoleSection title="Compose">
        <NewsletterComposeForm
          id={id}
          initial={{
            subject: letter.subject,
            preview_text: letter.preview_text,
            audience: letter.audience,
            body_html: letter.body_html,
            body_text: letter.body_text,
          }}
        />
      </ConsoleSection>

      <ConsoleSection title="Send">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Goes to active subscribers in <span className="font-medium text-foreground">{AUDIENCE_LABELS[letter.audience] ?? letter.audience}</span>.
            Suppressed contacts are skipped automatically.
          </p>
          <NewsletterDraftActions id={id} />
        </div>
      </ConsoleSection>

      <ConsoleSection title="Send this issue to a list (one-off)">
        <BulkOneOffForm id={id} />
      </ConsoleSection>
    </div>
  )
}

async function StatsView({ id, sentBy, sentAt, status }: { id: string; sentBy: string | null; sentAt: string | null; status: string }) {
  const [s, ledger, brokerRows, recipients] = await Promise.all([
    getNewsletterStats(id),
    getNewsletterStatsFromLedger(id),
    getNewsletterBrokerBreakdown(id),
    getNewsletterRecipients(id, { limit: 500 }),
  ])

  // Lead with the metrics that survive Apple Mail Privacy Protection (MPP), which
  // auto-opens every mail and inflates the open rate. Click rate and CTOR
  // (clicks / opens) are the honest engagement signals. Open rate is shown, but
  // labeled as MPP-inflated so it is read for what it is.
  const clickRate = ledger.clickRate
  const ctor = ledger.opened > 0 ? ledger.clicked / ledger.opened : 0
  const bounceRate = ledger.sent > 0 ? ledger.bounced / ledger.sent : 0

  const columns: TwmcColumn<NewsletterRecipient>[] = [
    { key: 'email', header: 'Email', cell: (r) => <span className="font-medium text-foreground">{r.email}</span> },
    { key: 'status', header: 'Status', cell: (r) => recipientStatusPill(r.status) },
    { key: 'opens', header: 'Opens', className: 'tabular-nums', cell: (r) => <span>{r.open_count.toLocaleString('en-US')}</span> },
    { key: 'clicks', header: 'Clicks', className: 'tabular-nums', cell: (r) => <span>{r.click_count.toLocaleString('en-US')}</span> },
    { key: 'clicked', header: 'What they clicked', cell: (r) => <ClickedLinks links={r.clicked_links} /> },
  ]

  return (
    <div className="mt-6 space-y-6">
      <ConsoleSection title="Engagement">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <CardDescription>Click rate</CardDescription>
                <CardTitle className="mt-1 text-3xl tabular-nums">{pct(clickRate)}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {ledger.clicked.toLocaleString('en-US')} of {ledger.delivered.toLocaleString('en-US')} delivered
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <CardDescription>CTOR (clicks / opens)</CardDescription>
                <CardTitle className="mt-1 text-3xl tabular-nums">{pct(ctor)}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {ledger.clicked.toLocaleString('en-US')} of {ledger.opened.toLocaleString('en-US')} opened
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <CardDescription>Open rate</CardDescription>
                <CardTitle className="mt-1 text-3xl tabular-nums">{pct(ledger.openRate)}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">MPP-inflated. Auto-opens count here.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <CardDescription>Delivered</CardDescription>
                <CardTitle className="mt-1 text-3xl tabular-nums">{ledger.delivered.toLocaleString('en-US')}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {ledger.bounced.toLocaleString('en-US')} bounced ({pct(bounceRate)})
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            {status === 'sending' ? 'Sending' : 'Sent'} by <span className="font-medium text-foreground">{sentBy ?? '—'}</span> on {fmtDateTime(sentAt)}.
            {' '}{s.sent.toLocaleString('en-US')} sent.
          </p>
        </div>
      </ConsoleSection>

      {brokerRows.length > 0 ? (
        <ConsoleSection title="By broker">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broker</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokerRows.map((b) => (
                <TableRow key={b.broker}>
                  <TableCell className="font-medium text-foreground">
                    {b.broker.charAt(0).toUpperCase() + b.broker.slice(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.recipients.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.delivered.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.clicks.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(b.clickRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ConsoleSection>
      ) : null}

      <ConsoleSection title="Recipients">
        <TableWithMobileCards
          rows={recipients}
          columns={columns}
          getRowKey={(r) => r.id}
          cap={50}
          renderCard={(r) => (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.email}</span>
                {recipientStatusPill(r.status)}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span>{r.open_count.toLocaleString('en-US')} opens</span>
                <span>{r.click_count.toLocaleString('en-US')} clicks</span>
              </div>
              {r.clicked_links && r.clicked_links.length > 0 ? (
                <div className="mt-2">
                  <ClickedLinks links={r.clicked_links} />
                </div>
              ) : null}
            </div>
          )}
          empty={<p>No recipients recorded yet. Engagement appears here as opens and clicks arrive.</p>}
        />
      </ConsoleSection>
    </div>
  )
}
