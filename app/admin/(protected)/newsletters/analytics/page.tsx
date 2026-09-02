// @no-parity — internal admin surface, no public mockup contract
//
// Newsletter analytics — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim — and this page's authz is gated by G-NL-12b
// (scripts/check-newsletter-scope.mjs), so none of it may move: the
// getCrmAccess() → /admin/access-denied redirect, scopeBroker(access), the
// `isSuperuser = restrictedSlug === null` test, the selectedBroker resolution
// (a restricted broker's slug comes ONLY from the session; the ?broker= param
// is consulted only when isSuperuser), slugsToShow, the per-broker
// getBrokerNewsletterAnalytics + getBrokerWarmList(slug, 50) reads, the totals
// reduce, ctr/ctor, the warm-list sort (newest engagement first) and its
// 50-row slice, the BrokerFilterSelect mount and its props, the 25-row display
// cap, the /admin/people/[id] hrefs, and the pct()/fmtDate() formatters.
//
// Shape changed, data did not: the KPI tile board became the family's
// typographic numbers strip (same four figures, same formatting), the shadcn
// table + mobile-card pair became the family's ONE grid, and the page title is
// gone — the nav names this page, and the verdict names the scope.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { getBrokerNewsletterAnalytics, getBrokerWarmList } from '@/lib/data'
import {
  ReportGrid,
  ReportNumbers,
  SectionHead,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { BrokerFilterSelect } from './BrokerFilterSelect'
import { formatDate } from '@/lib/format/date'

export const metadata = { title: 'Newsletter analytics | Admin' }
export const dynamic = 'force-dynamic'

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function fmtDate(iso: string): string {
  return formatDate(iso)
}

type WarmRow = { email: string; personId: number | null; clicks: number; lastAt: string }

/** Rows shown in the warm list before the "Showing N of M." line (legacy cap: 25). */
const ROW_CAP = 25

/**
 * Newsletter analytics (spec §9.5 / Phase 8). Role gate:
 *   - a restricted broker (scopeBroker returns a slug) sees ONLY their own
 *     analytics + warm list — the slug is resolved from the SESSION
 *     (getCrmAccess -> scopeBroker), never from `searchParams`, so a
 *     restricted broker cannot widen scope by hand-editing the URL (G-NL-12).
 *   - a superuser (scopeBroker returns null) sees a broker filter and can pick
 *     any broker, or "all brokers" (aggregated across all three).
 */
export default async function NewsletterAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ broker?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const restrictedSlug = scopeBroker(access)
  const { broker: requestedBroker } = await searchParams

  // A restricted broker's slug comes ONLY from the session. A superuser may
  // pick any broker (or 'all') via the query param — that param is never
  // consulted for a restricted broker.
  const isSuperuser = restrictedSlug === null
  const selectedBroker: string | 'all' = isSuperuser
    ? (CRM_BROKERS as readonly string[]).includes(requestedBroker ?? '')
      ? (requestedBroker as string)
      : 'all'
    : restrictedSlug

  const slugsToShow: string[] = selectedBroker === 'all' ? [...CRM_BROKERS] : [selectedBroker]

  const perBroker = await Promise.all(
    slugsToShow.map(async (slug) => {
      const [analytics, warmList] = await Promise.all([
        getBrokerNewsletterAnalytics(slug),
        getBrokerWarmList(slug, 50),
      ])
      return { slug, analytics, warmList }
    }),
  )

  const totals = perBroker.reduce(
    (acc, b) => ({
      recipients: acc.recipients + b.analytics.recipients,
      delivered: acc.delivered + b.analytics.delivered,
      opened: acc.opened + b.analytics.opened,
      clicked: acc.clicked + b.analytics.clicked,
    }),
    { recipients: 0, delivered: 0, opened: 0, clicked: 0 },
  )
  const ctr = totals.delivered > 0 ? totals.clicked / totals.delivered : 0
  const ctor = totals.opened > 0 ? totals.clicked / totals.opened : 0

  const warmList: WarmRow[] = perBroker
    .flatMap((b) => b.warmList)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0))
    .slice(0, 50)

  const columns: ReportColumn[] = [
    { key: 'email', label: 'Email' },
    { key: 'clicks', label: 'Clicks', numeric: true },
    { key: 'lastAt', label: 'Last engaged', numeric: true },
  ]

  const shown = warmList.slice(0, ROW_CAP)
  const gridRows: ReportGridRow[] = shown.map((r) => ({
    key: r.email,
    cells: [
      r.personId ? (
        <Link key="email" href={`/admin/people/${r.personId}`} style={{ color: 'var(--a-accent)' }}>
          {r.email}
        </Link>
      ) : (
        r.email
      ),
      r.clicks.toLocaleString('en-US'),
      fmtDate(r.lastAt),
    ],
  }))

  const heading = isSuperuser
    ? selectedBroker === 'all'
      ? 'All brokers'
      : (CRM_BROKER_DISPLAY[selectedBroker] ?? selectedBroker)
    : (CRM_BROKER_DISPLAY[restrictedSlug] ?? restrictedSlug)

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={totals.delivered === 0 ? 'attention' : 'ok'}>
          {totals.delivered === 0 ? (
            <b>{heading}: nothing delivered yet.</b>
          ) : (
            <b>
              {heading}: {pct(ctr)} click rate on {totals.delivered.toLocaleString('en-US')}{' '}
              delivered.
            </b>
          )}
        </VerdictLine>
      </div>

      {isSuperuser ? (
        <div className="av2-rfilters">
          <BrokerFilterSelect
            brokers={CRM_BROKERS.map((slug) => ({ slug, name: CRM_BROKER_DISPLAY[slug] }))}
            value={selectedBroker}
          />
        </div>
      ) : null}

      <ReportNumbers
        items={[
          { key: 'recipients', label: 'Recipients', value: totals.recipients.toLocaleString('en-US') },
          { key: 'delivered', label: 'Delivered', value: totals.delivered.toLocaleString('en-US') },
          { key: 'ctr', label: 'Click rate', value: pct(ctr) },
          { key: 'ctor', label: 'CTOR', value: pct(ctor) },
        ]}
      />

      <SectionHead>
        Warm list ({warmList.length} recipient{warmList.length === 1 ? '' : 's'})
      </SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
        Recipients who clicked in a newsletter, newest engagement first. Open the CRM card to follow
        up.
      </p>
      <ReportGrid
        label="Warm list"
        columns={columns}
        template="minmax(200px, 2fr) minmax(72px, 0.6fr) minmax(120px, 1fr)"
        minWidth={480}
        rows={gridRows}
        empty="No clicks recorded yet for this scope."
      />
      {warmList.length > shown.length ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 12,
          }}
        >
          Showing {shown.length.toLocaleString('en-US')} of {warmList.length.toLocaleString('en-US')}
          .
        </p>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        The figures above cover every issue this scope has sent, not a date window.
      </p>
    </div>
  )
}
