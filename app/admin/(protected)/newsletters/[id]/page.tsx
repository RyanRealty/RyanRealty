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
import type { NewsletterStatus } from '@/lib/data/newsletter'
import { countUnsubscribedRecipients } from '@/lib/data/newsletter/tracking'
import { renderNewsletterPreview } from '@/lib/newsletter/preview'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import NewsletterPreviewPanel from '@/components/admin/newsletter/NewsletterPreviewPanel'
import NewsletterScheduleControls from '@/components/admin/newsletter/NewsletterScheduleControls'
import NewsletterComposeForm from '../NewsletterComposeForm'
import NewsletterDraftActions from '../NewsletterDraftActions'
import BulkOneOffForm from '../BulkOneOffForm'

export const metadata = { title: 'Newsletter | Admin' }
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All subscribers',
  'segment:buyer': 'Buyers',
  'segment:seller': 'Sellers',
  'segment:past-client': 'Past clients',
}

const STATUS_TONE = {
  draft: 'neutral',
  scheduled: 'info',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
  canceled: 'neutral',
} as const satisfies Record<NewsletterStatus, 'neutral' | 'info' | 'success' | 'danger'>

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function recipientStatusPill(status: NewsletterRecipient['status']) {
  const tone = ({
    queued: 'neutral',
    sending: 'info',
    skipped: 'neutral',
    sent: 'neutral',
    delivered: 'info',
    opened: 'info',
    clicked: 'success',
    bounced: 'danger',
    complained: 'danger',
    failed: 'danger',
  } as const)[status] ?? 'neutral'
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
  const showStats = letter.status === 'sending' || letter.status === 'sent' || letter.status === 'failed'

  // Server-render the initial preview (Matt's identity) so the page opens on
  // the rendered newsletter, never raw HTML.
  const preview = letter.body_html ? await renderNewsletterPreview(id, 'matt') : null

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/newsletters" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to Newsletter</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{letter.subject || 'Untitled'}</h1>
        <StatusPill tone={STATUS_TONE[letter.status] ?? 'neutral'} label={letter.status} />
        {letter.send_paused ? <StatusPill tone="warning" label="paused" /> : null}
      </div>

      <div className="mt-6 space-y-6">
        <ConsoleSection title="Preview">
          <NewsletterPreviewPanel id={id} initialHtml={preview?.ok ? preview.html ?? null : null} initialBroker="matt" />
        </ConsoleSection>

        {letter.status === 'draft' || letter.status === 'scheduled' || letter.status === 'sending' ? (
          <ConsoleSection title="Approval and delivery">
            <div className="space-y-4">
              <NewsletterScheduleControls
                id={id}
                status={letter.status}
                scheduledAt={letter.scheduled_at}
                sendPaused={Boolean(letter.send_paused)}
              />
              {isDraft ? (
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Or send immediately to active subscribers in{' '}
                    <span className="font-medium text-foreground">{AUDIENCE_LABELS[letter.audience] ?? letter.audience}</span>.
                    Suppressed contacts are skipped automatically.
                  </p>
                  <NewsletterDraftActions id={id} />
                </div>
              ) : null}
            </div>
          </ConsoleSection>
        ) : null}

        {showStats ? <StatsSection id={id} sentBy={letter.sent_by} sentAt={letter.sent_at} status={letter.status} /> : null}

        {isDraft ? (
          <>
            <ConsoleSection title="Edit draft">
              <NewsletterComposeForm
                id={id}
                editOnly
                initial={{
                  subject: letter.subject,
                  preview_text: letter.preview_text,
                  audience: letter.audience,
                  body_html: letter.body_html,
                  body_text: letter.body_text,
                }}
              />
            </ConsoleSection>

            <ConsoleSection title="Send this issue to a list (one-off)">
              <BulkOneOffForm id={id} />
            </ConsoleSection>
          </>
        ) : null}
      </div>
    </main>
  )
}

async function StatsSection({ id, sentBy, sentAt, status }: { id: string; sentBy: string | null; sentAt: string | null; status: string }) {
  const [s, ledger, unsubs, brokerRows, recipients] = await Promise.all([
    getNewsletterStats(id),
    getNewsletterStatsFromLedger(id),
    countUnsubscribedRecipients(id),
    getNewsletterBrokerBreakdown(id),
    getNewsletterRecipients(id, { limit: 500 }),
  ])

  // Lead with the metrics that survive Apple Mail Privacy Protection (MPP),
  // which auto-opens every mail and inflates the open rate. Click rate and CTOR
  // are the honest engagement signals; open rate is labeled MPP-inflated.
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

  const kpis: Array<{ label: string; value: string; sub: string }> = [
    { label: 'Sent', value: ledger.sent.toLocaleString('en-US'), sub: 'recipients reached a send' },
    { label: 'Delivered', value: ledger.delivered.toLocaleString('en-US'), sub: `${ledger.bounced.toLocaleString('en-US')} bounced (${pct(bounceRate)})` },
    { label: 'Click rate', value: pct(clickRate), sub: `${ledger.clicked.toLocaleString('en-US')} clicked · CTOR ${pct(ctor)}` },
    { label: 'Open rate', value: pct(ledger.openRate), sub: 'MPP-inflated. Auto-opens count here.' },
    { label: 'Unsubscribed', value: unsubs.toLocaleString('en-US'), sub: 'recipients opted out since send' },
  ]

  return (
    <>
      <ConsoleSection title="Engagement">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="pt-5">
                  <CardDescription>{k.label}</CardDescription>
                  <CardTitle className="mt-1 text-3xl tabular-nums">{k.value}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === 'sending' ? 'Sending' : 'Sent'} by <span className="font-medium text-foreground">{sentBy ?? '—'}</span> on {fmtDateTime(sentAt)}.
            {' '}{s.sent.toLocaleString('en-US')} recipient rows.
          </p>
        </div>
      </ConsoleSection>

      {brokerRows.length > 0 ? (
        <ConsoleSection title="By broker">
          <TableWithMobileCards
            rows={brokerRows}
            columns={[
              { key: 'broker', header: 'Broker', cell: (b) => <span className="font-medium text-foreground">{b.broker.charAt(0).toUpperCase() + b.broker.slice(1)}</span> },
              { key: 'recipients', header: 'Recipients', className: 'text-right tabular-nums', cell: (b) => <span>{b.recipients.toLocaleString('en-US')}</span> },
              { key: 'delivered', header: 'Delivered', className: 'text-right tabular-nums', cell: (b) => <span>{b.delivered.toLocaleString('en-US')}</span> },
              { key: 'clicks', header: 'Clicks', className: 'text-right tabular-nums', cell: (b) => <span>{b.clicks.toLocaleString('en-US')}</span> },
              { key: 'ctr', header: 'CTR', className: 'text-right tabular-nums', cell: (b) => <span>{pct(b.clickRate)}</span> },
            ]}
            getRowKey={(b) => b.broker}
            empty={<p className="text-sm text-muted-foreground">No broker sends yet.</p>}
            renderCard={(b) => (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{b.broker.charAt(0).toUpperCase() + b.broker.slice(1)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{pct(b.clickRate)} CTR</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>{b.recipients.toLocaleString('en-US')} recipients</span>
                  <span>{b.delivered.toLocaleString('en-US')} delivered</span>
                  <span>{b.clicks.toLocaleString('en-US')} clicks</span>
                </div>
              </div>
            )}
          />
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
    </>
  )
}
