// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getNewsletter,
  getNewsletterStats,
  getNewsletterRecipients,
  type NewsletterRecipient,
} from '@/lib/data'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'
import NewsletterComposeForm from '../NewsletterComposeForm'
import NewsletterDraftActions from '../NewsletterDraftActions'

export const metadata = { title: 'Newsletter | Admin' }
export const dynamic = 'force-dynamic'

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
    </div>
  )
}

async function StatsView({ id, sentBy, sentAt, status }: { id: string; sentBy: string | null; sentAt: string | null; status: string }) {
  const [s, recipients] = await Promise.all([
    getNewsletterStats(id),
    getNewsletterRecipients(id, { limit: 500 }),
  ])

  const kpiItems = [
    { label: 'Delivery rate', value: pct(s.deliveryRate) },
    { label: 'Open rate', value: pct(s.openRate) },
    { label: 'Click rate', value: pct(s.clickRate) },
    { label: 'Sent', value: s.sent.toLocaleString('en-US') },
    { label: 'Delivered', value: s.delivered.toLocaleString('en-US') },
    { label: 'Opened', value: s.opened.toLocaleString('en-US') },
  ]

  const columns: TwmcColumn<NewsletterRecipient>[] = [
    { key: 'email', header: 'Email', cell: (r) => <span className="font-medium text-foreground">{r.email}</span> },
    { key: 'status', header: 'Status', cell: (r) => recipientStatusPill(r.status) },
    { key: 'opens', header: 'Opens', className: 'tabular-nums', cell: (r) => <span>{r.open_count.toLocaleString('en-US')}</span> },
    { key: 'clicks', header: 'Clicks', className: 'tabular-nums', cell: (r) => <span>{r.click_count.toLocaleString('en-US')}</span> },
    { key: 'clicked', header: 'What they clicked', cell: (r) => <ClickedLinks links={r.clicked_links} /> },
  ]

  return (
    <div className="mt-6 space-y-6">
      <ConsoleSection title="Delivery stats">
        <div className="space-y-3">
          <KpiStrip items={kpiItems} />
          <p className="text-sm text-muted-foreground">
            {status === 'sending' ? 'Sending' : 'Sent'} by <span className="font-medium text-foreground">{sentBy ?? '—'}</span> on {fmtDateTime(sentAt)}.
            {' '}{s.clicked.toLocaleString('en-US')} clicked.
          </p>
        </div>
      </ConsoleSection>

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
