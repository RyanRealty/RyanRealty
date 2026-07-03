// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { listNewsletters, newsletterSubscriberCounts, type NewsletterRow } from '@/lib/data'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'

export const metadata = { title: 'Newsletter | Admin' }
export const dynamic = 'force-dynamic'

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All subscribers',
  'segment:buyer': 'Buyers',
  'segment:seller': 'Sellers',
  'segment:past-client': 'Past clients',
}
function audienceLabel(a: string): string {
  return AUDIENCE_LABELS[a] ?? a
}

function statusPill(status: NewsletterRow['status']) {
  const tone = ({ draft: 'neutral', sending: 'info', sent: 'success', failed: 'danger' } as const)[status]
  return <StatusPill tone={tone} label={status} />
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function NewslettersPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const [letters, counts] = await Promise.all([listNewsletters(50), newsletterSubscriberCounts()])
  const sentCount = letters.filter((l) => l.status === 'sent').length

  const kpiItems = [
    { label: 'Active subscribers', value: counts.active.toLocaleString('en-US') },
    { label: 'Total subscribers', value: counts.total.toLocaleString('en-US') },
    { label: 'Newsletters sent', value: sentCount.toLocaleString('en-US') },
  ]

  const columns: TwmcColumn<NewsletterRow>[] = [
    {
      key: 'subject',
      header: 'Subject',
      cell: (r) => (
        <Link href={`/admin/newsletters/${r.id}`} className="font-medium text-foreground hover:underline">
          {r.subject || 'Untitled'}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => statusPill(r.status) },
    { key: 'audience', header: 'Audience', cell: (r) => <span className="text-muted-foreground">{audienceLabel(r.audience)}</span> },
    { key: 'sent_by', header: 'Sent by', cell: (r) => <span className="text-muted-foreground">{r.sent_by ?? '—'}</span> },
    {
      key: 'sent',
      header: 'Sent',
      className: 'tabular-nums',
      cell: (r) => (r.status === 'draft' ? <span className="text-muted-foreground">—</span> : <span>{r.sent_count.toLocaleString('en-US')} of {r.recipient_count.toLocaleString('en-US')}</span>),
    },
    { key: 'sent_at', header: 'Sent', className: 'tabular-nums', cell: (r) => <span className="text-muted-foreground">{fmtDate(r.sent_at)}</span> },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compose, send, and measure newsletters across the subscriber list.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/newsletters/analytics">Broker analytics</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/newsletters/new">Compose newsletter</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <KpiStrip items={kpiItems} />
      </div>

      <div className="mt-8">
        <ConsoleSection
          title="Newsletters"
          action={
            <Link href="/admin/newsletters/subscribers" className="text-sm font-medium text-foreground hover:underline">
              Manage subscribers →
            </Link>
          }
        >
          <TableWithMobileCards
            rows={letters}
            columns={columns}
            getRowKey={(r) => r.id}
            cap={20}
            renderCard={(r) => (
              <Link
                href={`/admin/newsletters/${r.id}`}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.subject || 'Untitled'}</span>
                  {statusPill(r.status)}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>{audienceLabel(r.audience)}</span>
                  {r.status !== 'draft' ? <span>{r.sent_count.toLocaleString('en-US')} of {r.recipient_count.toLocaleString('en-US')} sent</span> : null}
                  <span>{fmtDate(r.sent_at)}</span>
                </div>
              </Link>
            )}
            empty={
              <div className="space-y-2">
                <p>No newsletters yet.</p>
                <Button asChild size="sm">
                  <Link href="/admin/newsletters/new">Compose your first newsletter</Link>
                </Button>
              </div>
            }
          />
        </ConsoleSection>
      </div>
    </main>
  )
}
