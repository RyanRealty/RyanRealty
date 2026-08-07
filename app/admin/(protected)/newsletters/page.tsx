// @no-parity — internal admin surface, no public mockup contract
//
// Newsletter index — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the requireAdminPage('content.marketing') guard, the
// getCrmAccess() → /admin/access-denied redirect, listNewsletters(50) +
// newsletterSubscriberCounts(), the sent-count computation, the AUDIENCE_LABELS
// map and audienceLabel(), every column and the value in it, the 20-row display
// cap and its "Showing N of M." line, the GenerateDraftButton mount, and every
// href on the page.
//
// Shape changed, data did not: the KPI tile board became the family's
// typographic numbers strip (same three figures, same formatting), the shadcn
// table + mobile-card pair became the family's ONE grid (which carries its own
// phone shape), status pills became state words carrying the same status text,
// and the page title is gone — the nav names this page. The date formatter now
// runs through lib/format/date (brand timezone) instead of the server's zone.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { listNewsletters, newsletterSubscriberCounts, type NewsletterRow } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
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
import { GenerateDraftButton } from './GenerateDraftButton'

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

/** Same status→severity mapping the pills carried; the word itself is unchanged. */
const STATUS_STATE = {
  draft: 'waiting',
  scheduled: 'accent',
  sending: 'accent',
  sent: 'ok',
  failed: 'down',
  canceled: 'waiting',
} as const satisfies Record<NewsletterRow['status'], AdminState>

function statusWord(status: NewsletterRow['status']) {
  return <StateWord state={STATUS_STATE[status] ?? 'waiting'}>{status}</StateWord>
}

/** Rows shown on the index before the "Showing N of M." line (legacy cap: 20). */
const ROW_CAP = 20

export default async function NewslettersPage() {
  await requireAdminPage('content.marketing')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const [letters, counts] = await Promise.all([listNewsletters(50), newsletterSubscriberCounts()])
  const sentCount = letters.filter((l) => l.status === 'sent').length
  const failedCount = letters.filter((l) => l.status === 'failed').length

  const columns: ReportColumn[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'status', label: 'Status' },
    { key: 'audience', label: 'Audience' },
    { key: 'sent_by', label: 'Sent by' },
    { key: 'sent', label: 'Sent', numeric: true },
    { key: 'sent_at', label: 'Date', numeric: true },
  ]

  const shown = letters.slice(0, ROW_CAP)
  const gridRows: ReportGridRow[] = shown.map((r) => ({
    key: r.id,
    cells: [
      <Link key="subject" href={`/admin/newsletters/${r.id}`} style={{ color: 'var(--a-accent)' }}>
        {r.subject || 'Untitled'}
      </Link>,
      statusWord(r.status),
      audienceLabel(r.audience),
      r.sent_by ?? '—',
      r.status === 'draft'
        ? '—'
        : `${r.sent_count.toLocaleString('en-US')} of ${r.recipient_count.toLocaleString('en-US')}`,
      r.status === 'scheduled' ? `Scheduled ${formatDate(r.scheduled_at)}` : formatDate(r.sent_at),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={failedCount > 0 ? 'attention' : 'ok'}>
          <b>{counts.active.toLocaleString('en-US')} active subscribers.</b>{' '}
          {sentCount.toLocaleString('en-US')} of the {letters.length.toLocaleString('en-US')} newest
          issues sent
          {failedCount > 0 ? `, ${failedCount.toLocaleString('en-US')} failed` : ''}.
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ margin: '0 0 18px' }}>
        <Link href="/admin/newsletters/new" className="av2-btn" style={{ textDecoration: 'none' }}>
          Compose newsletter
        </Link>
        <GenerateDraftButton />
        <Link
          href="/admin/newsletters/analytics"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none' }}
        >
          Broker analytics
        </Link>
        <Link
          href="/admin/newsletters/subscribers"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none' }}
        >
          Manage subscribers
        </Link>
      </div>

      <ReportNumbers
        items={[
          { key: 'active', label: 'Active subscribers', value: counts.active.toLocaleString('en-US') },
          { key: 'total', label: 'Total subscribers', value: counts.total.toLocaleString('en-US') },
          { key: 'sent', label: 'Newsletters sent', value: sentCount.toLocaleString('en-US') },
        ]}
      />

      <SectionHead>Newsletters</SectionHead>
      <ReportGrid
        label="Newsletters"
        columns={columns}
        template="minmax(170px, 2fr) minmax(84px, 0.7fr) minmax(104px, 1fr) minmax(84px, 0.7fr) minmax(104px, 0.9fr) minmax(116px, 1fr)"
        minWidth={760}
        rows={gridRows}
        empty={
          <>
            No newsletters yet.{' '}
            <Link href="/admin/newsletters/new" style={{ color: 'var(--a-accent)' }}>
              Compose your first newsletter
            </Link>
            .
          </>
        }
      />
      {letters.length > shown.length ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 12,
          }}
        >
          Showing {shown.length.toLocaleString('en-US')} of {letters.length.toLocaleString('en-US')}.
        </p>
      ) : null}
    </div>
  )
}
