// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { getBrokerNewsletterAnalytics, getBrokerWarmList } from '@/lib/data'
import { KpiStrip } from '@/components/console/KpiStrip'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { TableWithMobileCards, type TwmcColumn } from '@/components/admin/TableWithMobileCards'
import { Card, CardContent } from '@/components/ui/card'
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
  const selectedBroker: CrmBrokerSlug | 'all' = isSuperuser
    ? (CRM_BROKERS as readonly string[]).includes(requestedBroker ?? '')
      ? (requestedBroker as CrmBrokerSlug)
      : 'all'
    : restrictedSlug

  const slugsToShow: CrmBrokerSlug[] = selectedBroker === 'all' ? [...CRM_BROKERS] : [selectedBroker]

  const perBroker = await Promise.all(
    slugsToShow.map(async (slug) => ({
      slug,
      analytics: await getBrokerNewsletterAnalytics(slug),
      warmList: await getBrokerWarmList(slug, 50),
    })),
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

  const kpiItems = [
    { label: 'Recipients', value: totals.recipients.toLocaleString('en-US') },
    { label: 'Delivered', value: totals.delivered.toLocaleString('en-US') },
    { label: 'Click rate', value: pct(ctr) },
    { label: 'CTOR', value: pct(ctor) },
  ]

  const columns: TwmcColumn<WarmRow>[] = [
    {
      key: 'email',
      header: 'Email',
      cell: (r) =>
        r.personId ? (
          <Link href={`/admin/crm/${r.personId}`} className="font-medium text-foreground hover:underline">
            {r.email}
          </Link>
        ) : (
          <span className="text-foreground">{r.email}</span>
        ),
    },
    { key: 'clicks', header: 'Clicks', className: 'tabular-nums', cell: (r) => <span>{r.clicks.toLocaleString('en-US')}</span> },
    { key: 'lastAt', header: 'Last engaged', className: 'tabular-nums', cell: (r) => <span className="text-muted-foreground">{fmtDate(r.lastAt)}</span> },
  ]

  const heading = isSuperuser
    ? selectedBroker === 'all'
      ? 'All brokers'
      : CRM_BROKER_DISPLAY[selectedBroker]
    : CRM_BROKER_DISPLAY[restrictedSlug]

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Newsletter analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {heading}. Delivery and engagement across every issue, and the warm list for follow-up.
          </p>
        </div>
        {isSuperuser ? (
          <BrokerFilterSelect
            brokers={CRM_BROKERS.map((slug) => ({ slug, name: CRM_BROKER_DISPLAY[slug] }))}
            value={selectedBroker}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <KpiStrip items={kpiItems} />
      </div>

      <div className="mt-8">
        <ConsoleSection
          title="Warm list"
          count={`(${warmList.length} recipient${warmList.length === 1 ? '' : 's'})`}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Recipients who clicked in a newsletter, newest engagement first. Open the CRM card to follow up.
          </p>
          <TableWithMobileCards
            rows={warmList}
            columns={columns}
            getRowKey={(r) => r.email}
            cap={25}
            renderCard={(r) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    {r.personId ? (
                      <Link href={`/admin/crm/${r.personId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">
                        {r.email}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.email}</span>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.clicks} clicks</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{fmtDate(r.lastAt)}</div>
                </CardContent>
              </Card>
            )}
            empty={<p>No clicks recorded yet for this scope.</p>}
          />
        </ConsoleSection>
      </div>
    </main>
  )
}
