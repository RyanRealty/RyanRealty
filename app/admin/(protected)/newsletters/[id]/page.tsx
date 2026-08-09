// @no-parity — internal admin surface, no public mockup contract
//
// One newsletter issue — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only. This is an ENTITY page
// (ADMIN_UI §3 pattern 5), so the h1 is the issue's subject — content, not
// page-title chrome.
//
// Carried over verbatim: the getCrmAccess() → /admin/access-denied redirect,
// getNewsletter() + notFound(), the isDraft / showStats conditions, the
// server-rendered 'matt' preview, every mounted island and its props
// (NewsletterPreviewPanel, NewsletterScheduleControls, NewsletterDraftActions,
// NewsletterComposeForm, BulkOneOffForm), the five stat reads and their args
// (getNewsletterRecipients limit 500), every metric and its computation
// (clickRate / ctor / bounceRate / pct), the MPP wording, the AUDIENCE_LABELS
// map, the broker-breakdown gating on brokerRows.length, the legacy display
// caps (8 broker rows, 50 recipient rows, 5 clicked links), and every href.
//
// Shape changed, data did not: the KPI card grid became the family's
// typographic numbers strip (each card's sub-line rides along as the figure's
// note), the two shadcn tables became the family's ONE grid, the console panels
// became v2 section heads, and the status pills became state words carrying the
// same status text. The date+time formatter now runs through lib/format/date
// (brand timezone) instead of the server's zone.
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
import { formatDateTime } from '@/lib/format/date'
import {
  EntityTitle,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import NewsletterPreviewPanel from '@/app/admin/(protected)/newsletters/_components/NewsletterPreviewPanel'
import NewsletterScheduleControls from '@/app/admin/(protected)/newsletters/_components/NewsletterScheduleControls'
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

const STATUS_STATE = {
  draft: 'waiting',
  scheduled: 'accent',
  sending: 'accent',
  sent: 'ok',
  failed: 'down',
  canceled: 'waiting',
} as const satisfies Record<NewsletterStatus, AdminState>

/** Legacy display caps, carried over from the tables this grid replaced. */
const BROKER_ROW_CAP = 8
const RECIPIENT_ROW_CAP = 50

function pct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return formatDateTime(iso)
}

const RECIPIENT_STATE = {
  queued: 'waiting',
  sending: 'accent',
  skipped: 'waiting',
  sent: 'waiting',
  delivered: 'accent',
  opened: 'accent',
  clicked: 'ok',
  bounced: 'down',
  complained: 'down',
  failed: 'down',
} as const satisfies Record<NewsletterRecipient['status'], AdminState>

function recipientStatusWord(status: NewsletterRecipient['status']) {
  return <StateWord state={RECIPIENT_STATE[status] ?? 'waiting'}>{status}</StateWord>
}

function ClickedLinks({ links }: { links: NewsletterRecipient['clicked_links'] }) {
  if (!links || links.length === 0) return <span style={{ color: 'var(--a-text-2)' }}>—</span>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {links.slice(0, 5).map((l) => (
        <li
          key={l.url}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--a-text-xs)',
            minWidth: 0,
          }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--a-text)',
            }}
          >
            {l.url}
          </span>
          <span
            style={{ flex: 'none', color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums' }}
          >
            ×{l.count}
          </span>
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
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link
          href="/admin/newsletters"
          style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
        >
          Newsletter
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <EntityTitle>{letter.subject || 'Untitled'}</EntityTitle>
        <StateWord state={STATUS_STATE[letter.status] ?? 'waiting'}>{letter.status}</StateWord>
        {letter.send_paused ? <StateWord state="slow">paused</StateWord> : null}
      </div>

      <SectionHead>Preview</SectionHead>
      <NewsletterPreviewPanel
        id={id}
        initialHtml={preview?.ok ? preview.html ?? null : null}
        initialBroker="matt"
      />

      {letter.status === 'draft' || letter.status === 'scheduled' || letter.status === 'sending' ? (
        <>
          <SectionHead>Approval and delivery</SectionHead>
          <NewsletterScheduleControls
            id={id}
            status={letter.status}
            scheduledAt={letter.scheduled_at}
            sendPaused={Boolean(letter.send_paused)}
          />
          {isDraft ? (
            <div style={{ borderTop: '1px solid var(--a-border)', paddingTop: 16, marginTop: 16 }}>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 'var(--a-text-sm)',
                  color: 'var(--a-text-2)',
                }}
              >
                Or send immediately to active subscribers in{' '}
                <span style={{ fontWeight: 600, color: 'var(--a-text)' }}>
                  {AUDIENCE_LABELS[letter.audience] ?? letter.audience}
                </span>
                . Suppressed contacts are skipped automatically.
              </p>
              <NewsletterDraftActions id={id} />
            </div>
          ) : null}
        </>
      ) : null}

      {showStats ? (
        <StatsSection
          id={id}
          sentBy={letter.sent_by}
          sentAt={letter.sent_at}
          status={letter.status}
        />
      ) : null}

      {isDraft ? (
        <>
          <SectionHead>Edit draft</SectionHead>
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

          <SectionHead>Send this issue to a list (one-off)</SectionHead>
          <BulkOneOffForm id={id} />
        </>
      ) : null}
    </div>
  )
}

async function StatsSection({
  id,
  sentBy,
  sentAt,
  status,
}: {
  id: string
  sentBy: string | null
  sentAt: string | null
  status: string
}) {
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

  const brokerColumns: ReportColumn[] = [
    { key: 'broker', label: 'Broker' },
    { key: 'recipients', label: 'Recipients', numeric: true },
    { key: 'delivered', label: 'Delivered', numeric: true },
    { key: 'clicks', label: 'Clicks', numeric: true },
    { key: 'ctr', label: 'CTR', numeric: true },
  ]
  const shownBrokers = brokerRows.slice(0, BROKER_ROW_CAP)
  const brokerGridRows: ReportGridRow[] = shownBrokers.map((b) => ({
    key: b.broker,
    cells: [
      b.broker.charAt(0).toUpperCase() + b.broker.slice(1),
      b.recipients.toLocaleString('en-US'),
      b.delivered.toLocaleString('en-US'),
      b.clicks.toLocaleString('en-US'),
      pct(b.clickRate),
    ],
  }))

  const recipientColumns: ReportColumn[] = [
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'opens', label: 'Opens', numeric: true },
    { key: 'clicks', label: 'Clicks', numeric: true },
    { key: 'clicked', label: 'What they clicked' },
  ]
  const shownRecipients = recipients.slice(0, RECIPIENT_ROW_CAP)
  const recipientGridRows: ReportGridRow[] = shownRecipients.map((r) => ({
    key: r.id,
    cells: [
      r.email,
      recipientStatusWord(r.status),
      r.open_count.toLocaleString('en-US'),
      r.click_count.toLocaleString('en-US'),
      <ClickedLinks key="clicked" links={r.clicked_links} />,
    ],
  }))

  return (
    <>
      <SectionHead>Engagement</SectionHead>
      <ReportNumbers
        items={[
          {
            key: 'sent',
            label: 'Sent',
            value: ledger.sent.toLocaleString('en-US'),
            delta: { text: 'recipients reached a send', direction: 'flat' },
          },
          {
            key: 'delivered',
            label: 'Delivered',
            value: ledger.delivered.toLocaleString('en-US'),
            delta: {
              text: `${ledger.bounced.toLocaleString('en-US')} bounced (${pct(bounceRate)})`,
              direction: 'flat',
            },
          },
          {
            key: 'click-rate',
            label: 'Click rate',
            value: pct(clickRate),
            delta: {
              text: `${ledger.clicked.toLocaleString('en-US')} clicked · CTOR ${pct(ctor)}`,
              direction: 'flat',
            },
          },
          {
            key: 'open-rate',
            label: 'Open rate',
            value: pct(ledger.openRate),
            delta: { text: 'MPP-inflated. Auto-opens count here.', direction: 'flat' },
          },
          {
            key: 'unsubscribed',
            label: 'Unsubscribed',
            value: unsubs.toLocaleString('en-US'),
            delta: { text: 'recipients opted out since send', direction: 'flat' },
          },
        ]}
      />
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        {status === 'sending' ? 'Sending' : 'Sent'} by{' '}
        <span style={{ fontWeight: 600, color: 'var(--a-text)' }}>{sentBy ?? '—'}</span> on{' '}
        {fmtDateTime(sentAt)}. {s.sent.toLocaleString('en-US')} recipient rows.
      </p>

      {brokerRows.length > 0 ? (
        <>
          <SectionHead>By broker</SectionHead>
          <ReportGrid
            label="Delivery and clicks by broker"
            columns={brokerColumns}
            template="minmax(120px, 1.4fr) repeat(4, minmax(78px, 0.8fr))"
            minWidth={560}
            rows={brokerGridRows}
            empty="No broker sends yet."
          />
          {brokerRows.length > shownBrokers.length ? (
            <p
              style={{
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 12,
              }}
            >
              Showing {shownBrokers.length.toLocaleString('en-US')} of{' '}
              {brokerRows.length.toLocaleString('en-US')}.
            </p>
          ) : null}
        </>
      ) : null}

      <SectionHead>Recipients</SectionHead>
      <ReportGrid
        label="Recipients and their engagement"
        columns={recipientColumns}
        template="minmax(180px, 1.6fr) minmax(92px, 0.7fr) minmax(64px, 0.5fr) minmax(64px, 0.5fr) minmax(180px, 1.6fr)"
        minWidth={720}
        rows={recipientGridRows}
        empty="No recipients recorded yet. Engagement appears here as opens and clicks arrive."
      />
      {recipients.length > shownRecipients.length ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 12,
          }}
        >
          Showing {shownRecipients.length.toLocaleString('en-US')} of{' '}
          {recipients.length.toLocaleString('en-US')}.
        </p>
      ) : null}
    </>
  )
}
