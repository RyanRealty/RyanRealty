// @no-parity — internal admin surface, no public mockup contract
//
// Newsletter subscribers — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getCrmAccess() → /admin/access-denied redirect,
// every query param and its parsing (`page` `q` `status` `segment` `broker`,
// the STATUSES/SEGMENTS allow-lists, PAGE_SIZE = 50), the
// newsletterSubscriberCounts() + listSubscribersWithBroker() reads and their
// args, the totalPages / from / to arithmetic, the pageHref builder (same
// params, same order, same "omit page=1" rule), SEGMENT_LABELS, brokerLabel(),
// every column and the value in it, the SubscriberRowActions props, the
// SubscriberFilters / AddSubscriberForm / BulkEnrollForm mounts, and every href.
//
// Shape changed, data did not: the KPI tile board became the family's
// typographic numbers strip, the shadcn table + mobile-card pair became the
// family's ONE grid (which carries its own phone shape), status pills became
// state words carrying the same status text, the row-actions column now
// carries the header "Actions" where the legacy table left it blank, and the
// page title is gone — the nav names this page.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { newsletterSubscriberCounts, type NewsletterSegment, type SubscriberStatus } from '@/lib/data'
import { listSubscribersWithBroker, type SubscriberWithBroker } from '@/lib/data/newsletter/subscribersAdmin'
import {
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import SubscriberFilters from '@/app/admin/(protected)/newsletters/_components/SubscriberFilters'
import SubscriberRowActions from '@/app/admin/(protected)/newsletters/_components/SubscriberRowActions'
import { AddSubscriberForm } from '../SubscriberForms'
import { BulkEnrollForm } from '../BulkEnrollForm'

export const metadata = { title: 'Subscribers | Newsletter | Admin' }
export const dynamic = 'force-dynamic'

const SEGMENT_LABELS: Record<string, string> = {
  general: 'General',
  buyer: 'Buyer',
  seller: 'Seller',
  'past-client': 'Past client',
}
const STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'complained'])
const SEGMENTS = new Set(['general', 'buyer', 'seller', 'past-client'])

/** Same status→severity mapping the pills carried; the word itself is unchanged. */
const SUBSCRIBER_STATE = {
  active: 'ok',
  unsubscribed: 'waiting',
  bounced: 'down',
  complained: 'down',
} as const satisfies Record<SubscriberWithBroker['status'], AdminState>

function subscriberStatusWord(status: SubscriberWithBroker['status']) {
  return <StateWord state={SUBSCRIBER_STATE[status] ?? 'waiting'}>{status}</StateWord>
}

function brokerLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

const PAGE_SIZE = 50

export default async function NewsletterSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; segment?: string; broker?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const filters = {
    q: sp.q?.trim() || undefined,
    status: sp.status && STATUSES.has(sp.status) ? (sp.status as SubscriberStatus) : undefined,
    segment: sp.segment && SEGMENTS.has(sp.segment) ? (sp.segment as NewsletterSegment) : undefined,
    broker: sp.broker || undefined,
  }

  const [counts, list] = await Promise.all([
    newsletterSubscriberCounts(),
    listSubscribersWithBroker({ ...filters, page, pageSize: PAGE_SIZE }),
  ])

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize))
  const from = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1
  const to = Math.min(list.page * list.pageSize, list.total)

  const pageHref = (p: number) => {
    const next = new URLSearchParams()
    if (filters.q) next.set('q', filters.q)
    if (filters.status) next.set('status', filters.status)
    if (filters.segment) next.set('segment', filters.segment)
    if (filters.broker) next.set('broker', filters.broker)
    if (p > 1) next.set('page', String(p))
    return `/admin/newsletters/subscribers${next.size ? `?${next.toString()}` : ''}`
  }

  const columns: ReportColumn[] = [
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
    { key: 'broker', label: 'Broker' },
    { key: 'segment', label: 'Segment' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'action', label: 'Actions' },
  ]

  const shown = list.rows.slice(0, PAGE_SIZE)
  const gridRows: ReportGridRow[] = shown.map((r) => ({
    key: r.id,
    cells: [
      r.email,
      r.name ?? '—',
      brokerLabel(r.broker),
      SEGMENT_LABELS[r.segment] ?? r.segment,
      subscriberStatusWord(r.status),
      r.source ?? '—',
      <SubscriberRowActions
        key="actions"
        id={r.id}
        email={r.email}
        name={r.name}
        segment={r.segment}
        status={r.status}
        broker={r.broker}
        hasCrmPerson={r.crm_person_id != null}
      />,
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/newsletters" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Newsletter
        </Link>
      </nav>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={counts.active === 0 ? 'attention' : 'ok'}>
          <b>
            {counts.active.toLocaleString('en-US')} active,{' '}
            {counts.unsubscribed.toLocaleString('en-US')} unsubscribed,{' '}
            {counts.total.toLocaleString('en-US')} on file.
          </b>
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'active', label: 'Active', value: counts.active.toLocaleString('en-US') },
          { key: 'unsubscribed', label: 'Unsubscribed', value: counts.unsubscribed.toLocaleString('en-US') },
          { key: 'total', label: 'Total', value: counts.total.toLocaleString('en-US') },
        ]}
      />

      <SectionHead>Add subscriber</SectionHead>
      <AddSubscriberForm />

      <SectionHead>Bulk add subscribers</SectionHead>
      <BulkEnrollForm />

      <SectionHead>Subscriber list</SectionHead>
      <div className="av2-rfilters">
        <SubscriberFilters />
      </div>
      <p
        style={{
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          fontVariantNumeric: 'tabular-nums',
          margin: '0 0 12px',
        }}
      >
        {list.total === 0
          ? 'No subscribers'
          : `${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')} of ${list.total.toLocaleString('en-US')}`}
      </p>

      <ReportGrid
        label="Newsletter subscribers"
        columns={columns}
        template="minmax(190px, 2fr) minmax(110px, 1fr) minmax(78px, 0.7fr) minmax(90px, 0.8fr) minmax(96px, 0.8fr) minmax(96px, 0.9fr) minmax(120px, 1fr)"
        minWidth={940}
        rows={gridRows}
        empty="No subscribers match. Clear the filters, or add one above."
      />

      {totalPages > 1 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 16,
          }}
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span
            style={{
              fontSize: 'var(--a-text-xs)',
              color: 'var(--a-text-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Page {page.toLocaleString('en-US')} of {totalPages.toLocaleString('en-US')}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  )
}
