import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getSetupComplete } from '@/app/actions/admin-setup'
import {
  getDashboardSyncData,
  getDashboardLeadData,
  getDashboardDataQuality,
  getDashboardContentStatus,
  getDashboardMarketingData,
} from '@/app/actions/dashboard'
import DashboardPanel from '@/components/admin/DashboardPanel'
import DashboardSyncPanel from '@/components/admin/DashboardSyncPanel'
import DashboardLeadPanel from '@/components/admin/DashboardLeadPanel'
import DashboardGA4Panel from '@/components/admin/DashboardGA4Panel'
import DashboardNotificationsPanel from '@/components/admin/DashboardNotificationsPanel'
import DashboardSitePerformancePanel from '@/components/admin/DashboardSitePerformancePanel'
import DashboardRevenuePanel from '@/components/admin/DashboardRevenuePanel'
import DashboardContentStatusPanel from '@/components/admin/DashboardContentStatusPanel'
import DashboardMarketingCommandCenterPanel from '@/components/admin/DashboardMarketingCommandCenterPanel'
import DashboardSummaryStrip, { type SummaryStat } from '@/components/admin/DashboardSummaryStrip'

export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('en-US')

// The five dashboard fetchers hit live third-party APIs (GA4, Meta Graph, FUB
// fallback) and exact-count scans — 30-45s uncached per render, which read as
// "admin is down" on a phone. All five are service-role + Matt-scoped (no
// cookies inside), so the bundle is globally cacheable. unstable_cache serves
// stale while revalidating: only a cold start ever pays the full fetch.
const getDashboardData = unstable_cache(
  async () =>
    Promise.all([
      getDashboardSyncData(),
      getDashboardLeadData(),
      getDashboardDataQuality(),
      getDashboardContentStatus(),
      getDashboardMarketingData(),
    ]),
  ['admin-dashboard-data'],
  { revalidate: 180, tags: ['admin-dashboard'] }
)

export default async function AdminDashboardPage() {
  const setupComplete = await getSetupComplete()
  if (!setupComplete) redirect('/admin/setup')

  const [syncData, leadData, dataQuality, contentStatus, marketingData] = await getDashboardData()

  // Glanceable summary — the six operations numbers worth a glance, derived
  // entirely from data already fetched above. No new queries. A null value
  // renders a muted em-dash rather than leaving a hole.
  const identifiedRate =
    leadData.totalVisits > 0
      ? `${((leadData.visitsWithUser / leadData.totalVisits) * 100).toFixed(1)}%`
      : null
  const summaryStats: SummaryStat[] = [
    {
      label: 'Active listings',
      value: nf.format(syncData.counts.activeCount),
      caption: `${nf.format(syncData.counts.totalListings)} total`,
      tone: 'success',
    },
    {
      label: 'Sessions 30d',
      value: marketingData.ga4.ok ? nf.format(marketingData.ga4.sessions) : null,
      caption: marketingData.ga4.ok ? `${nf.format(marketingData.ga4.socialSessions)} social` : 'GA4 offline',
    },
    {
      label: 'Lead events 30d',
      value: marketingData.ga4.ok ? nf.format(marketingData.ga4.facebookLeadEvents) : null,
      caption: 'from Facebook',
    },
    {
      label: 'Valuation reqs',
      value: nf.format(marketingData.website.valuationRequests30d),
      caption: '30 days',
    },
    {
      label: 'Identified',
      value: identifiedRate,
      caption: `${nf.format(leadData.visitsWithUser)} of ${nf.format(leadData.totalVisits)}`,
    },
    {
      label: 'Photos missing',
      value: nf.format(dataQuality.missingPrimaryPhoto),
      caption: 'active, no primary',
      tone: dataQuality.missingPrimaryPhoto > 0 ? 'warning' : 'default',
    },
  ]

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Operations command center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System health, sync, leads, and growth at a glance. Open a section for the detail.
        </p>
      </header>

      <section aria-label="Key metrics" className="mt-6">
        <DashboardSummaryStrip stats={summaryStats} />
      </section>

      <div className="mt-8 space-y-4 sm:space-y-6">
        <DashboardPanel id="sync" title="Sync operations and database health" defaultOpen={true}>
          <DashboardSyncPanel
            history={syncData.history}
            cursor={syncData.cursor}
            counts={syncData.counts}
            breakdown={syncData.breakdown}
            historyTableStatus={syncData.historyTableStatus}
            dataQuality={dataQuality}
          />
        </DashboardPanel>

        <DashboardPanel id="marketing" title="Marketing command center (Meta + GA4 + FUB)" defaultOpen={false}>
          <DashboardMarketingCommandCenterPanel data={marketingData} />
        </DashboardPanel>

        <DashboardPanel id="ga4" title="Google Analytics (GA4) deep integration" defaultOpen={false}>
          <DashboardGA4Panel />
        </DashboardPanel>

        <DashboardPanel id="lead" title="Lead and contact intelligence" defaultOpen={false}>
          <DashboardLeadPanel data={leadData} />
        </DashboardPanel>

        <DashboardPanel id="content" title="Content status" defaultOpen={false}>
          <DashboardContentStatusPanel data={contentStatus.data} error={contentStatus.error} />
        </DashboardPanel>

        <DashboardPanel id="notifications" title="Notification and alert center" defaultOpen={false}>
          <DashboardNotificationsPanel />
        </DashboardPanel>

        <DashboardPanel id="siteperf" title="Site performance and technical health" defaultOpen={false}>
          <DashboardSitePerformancePanel />
        </DashboardPanel>

        <DashboardPanel id="financial" title="Financial and business metrics (Super Admin only)" defaultOpen={false}>
          <DashboardRevenuePanel />
        </DashboardPanel>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-muted p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Quick links</h2>
        <ul className="mt-2 flex flex-wrap gap-4 text-sm">
          <li><Link href="/admin/sync" className="text-success hover:underline">Sync & history</Link></li>
          <li><Link href="/admin/geo" className="text-success hover:underline">Geo hierarchy</Link></li>
          <li><Link href="/admin/resort-communities" className="text-success hover:underline">Resort communities</Link></li>
          <li><Link href="/admin/banners" className="text-success hover:underline">Banners</Link></li>
          <li><Link href="/admin/reports" className="text-success hover:underline">Reports</Link></li>
          <li><Link href="/admin/spark-status" className="text-success hover:underline">Spark API status</Link></li>
        </ul>
      </div>
    </main>
  )
}
