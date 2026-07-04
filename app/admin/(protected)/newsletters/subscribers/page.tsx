// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  listNewsletterSubscribers,
  newsletterSubscriberCounts,
  type NewsletterSubscriber,
} from '@/lib/data'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'
import { AddSubscriberForm, SubscriberStatusToggle } from '../SubscriberForms'
import { BulkEnrollForm } from '../BulkEnrollForm'

export const metadata = { title: 'Subscribers | Newsletter | Admin' }
export const dynamic = 'force-dynamic'

const SEGMENT_LABELS: Record<string, string> = {
  general: 'General',
  buyer: 'Buyer',
  seller: 'Seller',
  'past-client': 'Past client',
}

function subscriberStatusPill(status: NewsletterSubscriber['status']) {
  const tone = ({
    active: 'success',
    unsubscribed: 'neutral',
    bounced: 'danger',
    complained: 'danger',
  } as const)[status]
  return <StatusPill tone={tone} label={status} />
}

const PAGE_SIZE = 50

export default async function NewsletterSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)

  const [counts, list] = await Promise.all([
    newsletterSubscriberCounts(),
    listNewsletterSubscribers({ page, pageSize: PAGE_SIZE }),
  ])

  const kpiItems = [
    { label: 'Active', value: counts.active.toLocaleString('en-US') },
    { label: 'Unsubscribed', value: counts.unsubscribed.toLocaleString('en-US') },
    { label: 'Total', value: counts.total.toLocaleString('en-US') },
  ]

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize))
  const from = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1
  const to = Math.min(list.page * list.pageSize, list.total)

  const columns: TwmcColumn<NewsletterSubscriber>[] = [
    { key: 'email', header: 'Email', cell: (r) => <span className="font-medium text-foreground">{r.email}</span> },
    { key: 'name', header: 'Name', cell: (r) => <span className="text-muted-foreground">{r.name ?? '—'}</span> },
    { key: 'segment', header: 'Segment', cell: (r) => <span className="text-muted-foreground">{SEGMENT_LABELS[r.segment] ?? r.segment}</span> },
    { key: 'status', header: 'Status', cell: (r) => subscriberStatusPill(r.status) },
    { key: 'source', header: 'Source', cell: (r) => <span className="text-muted-foreground">{r.source ?? '—'}</span> },
    { key: 'action', header: '', className: 'text-right', cell: (r) => <SubscriberStatusToggle id={r.id} status={r.status} /> },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/newsletters" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to Newsletter</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Subscribers</h1>
      <p className="mt-1 text-sm text-muted-foreground">The newsletter list. Add subscribers, or remove and re-add them.</p>

      <div className="mt-6">
        <KpiStrip items={kpiItems} />
      </div>

      <ConsoleSection title="Add subscriber" className="mt-6">
        <AddSubscriberForm />
      </ConsoleSection>

      <ConsoleSection title="Bulk add subscribers" className="mt-6">
        <BulkEnrollForm />
      </ConsoleSection>

      <div className="mt-8">
        <ConsoleSection
          title="Subscriber list"
          action={
            <p className="text-xs text-muted-foreground tabular-nums">
              {list.total === 0 ? 'No subscribers' : `${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')} of ${list.total.toLocaleString('en-US')}`}
            </p>
          }
        >
          <TableWithMobileCards
            rows={list.rows}
            columns={columns}
            getRowKey={(r) => r.id}
            cap={PAGE_SIZE}
            renderCard={(r) => (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.email}</span>
                  {subscriberStatusPill(r.status)}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{r.name ?? 'No name'}</span>
                  <span>{SEGMENT_LABELS[r.segment] ?? r.segment}</span>
                  <span>{r.source ?? '—'}</span>
                </div>
                <div className="mt-2">
                  <SubscriberStatusToggle id={r.id} status={r.status} />
                </div>
              </div>
            )}
            empty={<p>No subscribers yet. Add one above, or they arrive from the site signup form.</p>}
          />

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/newsletters/subscribers?page=${page - 1}`}>← Previous</Link>
                </Button>
              ) : <span />}
              <span className="text-xs text-muted-foreground tabular-nums">Page {page.toLocaleString('en-US')} of {totalPages.toLocaleString('en-US')}</span>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/newsletters/subscribers?page=${page + 1}`}>Next →</Link>
                </Button>
              ) : <span />}
            </div>
          ) : null}
        </ConsoleSection>
      </div>
    </main>
  )
}
