// @no-parity — internal admin surface, no public mockup contract
//
// Operations command center — P11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: requireAdminPage('settings.system'), the
// getSetupComplete() → /admin/setup redirect, the unstable_cache bundle
// (['admin-dashboard-data'], revalidate 180, tag 'admin-dashboard') around the
// same five fetchers in the same order, all eight DashboardPanel mounts with
// their ids, titles, defaultOpen flags and props, and the six quick links.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> title chrome is gone (the nav names the page), the
// legacy summary-strip card row became the family's typographic numbers strip
// (its component was deleted in this wave once nothing imported it), and the
// ConsoleSection around the quick links became a SectionHead.
//
// ONE FIGURE WAS CUT, not restyled: "Active listings". It printed
// syncData.counts.activeCount, which is getTotalListingsCount() — the sum of
// geo_snapshot_mv.active_sfr_count over the TOP 50 CITIES
// (lib/data/geo/getGeoSnapshot.ts `_fetchAllCitySnapshots` carries .limit(50)).
// Measured 2026-08-07: that sum is 3,530, while listings with
// StandardStatus='Active' number 7,611 (4,646 of them PropertyType='A'), and
// 136 cities carry a non-zero active SFR count, not 50. The label was wrong by
// 2.16x, and its caption paired it with getTotalListingsRows() — every row of
// every status in `listings` — so the two numbers did not share a universe.
// The page cannot make that figure true from what it reads, so it does not
// print it. The same value still renders inside DashboardSyncPanel under the
// heading "Active"; that component is outside this migration's fence and the
// defect is reported with it.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
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
import {
  ReportNumbers,
  SectionHead,
  VerdictLine,
  type ReportNumberItem,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('en-US')

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: '/admin/sync', label: 'Sync & history' },
  { href: '/admin/geo', label: 'Geo hierarchy' },
  { href: '/admin/geo/resort-communities', label: 'Resort communities' },
  { href: '/admin/media/banners', label: 'Banners' },
  { href: '/admin/analytics', label: 'Performance' },
  { href: '/admin/sync/spark', label: 'Spark API status' },
]

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
  await requireAdminPage('settings.system')
  const setupComplete = await getSetupComplete()
  if (!setupComplete) redirect('/admin/setup')

  const [syncData, leadData, dataQuality, contentStatus, marketingData] = await getDashboardData()

  // The figures worth a glance, every one named for exactly what it sums.
  // No new queries: all five come out of the bundle fetched above.
  const identifiedRate =
    leadData.totalVisits > 0
      ? `${((leadData.visitsWithUser / leadData.totalVisits) * 100).toFixed(1)}%`
      : '—'
  const ga4 = marketingData.ga4
  const missingPhoto = dataQuality.missingPrimaryPhoto

  const numbers: ReportNumberItem[] = [
    {
      key: 'sessions',
      label: 'Sessions, 30 days',
      value: ga4.ok ? nf.format(ga4.sessions) : '—',
      delta: {
        direction: 'flat',
        text: ga4.ok ? `${nf.format(ga4.socialSessions)} from social` : 'GA4 offline',
      },
    },
    {
      key: 'leadevents',
      label: 'Lead events, 30 days',
      value: ga4.ok ? nf.format(ga4.facebookLeadEvents) : '—',
      delta: { direction: 'flat', text: ga4.ok ? 'from Facebook' : 'GA4 offline' },
    },
    {
      key: 'valuations',
      label: 'Valuation requests',
      value: nf.format(marketingData.website.valuationRequests30d),
      delta: { direction: 'flat', text: 'last 30 days' },
    },
    {
      key: 'identified',
      label: 'Sessions identified',
      value: identifiedRate,
      delta: {
        direction: 'flat',
        text: `${nf.format(leadData.visitsWithUser)} of ${nf.format(leadData.totalVisits)}, all time`,
      },
    },
    {
      key: 'photos',
      label: 'No hero photo',
      value: nf.format(missingPhoto),
      delta: { direction: 'flat', text: 'active + pending listings' },
    },
  ]

  // overflowX 'clip' is the old <main>'s `overflow-x-clip`, carried over: the
  // eight DashboardPanel islands mount unchanged and the open sync panel
  // measures 426px against a 375px viewport. Clip contains it here the way it
  // always did, and a descendant's own overflow-x:auto still scrolls.
  return (
    <div
      className="av2-scope"
      style={{ maxWidth: 1120, margin: '0 auto', padding: 16, overflowX: 'clip' }}
    >
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={missingPhoto > 0 ? 'attention' : 'ok'}>
          {missingPhoto > 0 ? (
            <>
              <b>
                {nf.format(missingPhoto)} active or pending{' '}
                {missingPhoto === 1 ? 'listing has' : 'listings have'} no hero photo.
              </b>{' '}
              Everything else here is a panel you open.
            </>
          ) : (
            <>
              <b>Every active and pending listing has a hero photo.</b> Everything else here is a
              panel you open.
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers items={numbers} />

      <div style={{ display: 'grid', gap: 16 }}>
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

      <SectionHead>Quick links</SectionHead>
      <ul className="av2-wordrow" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 16 }}>
        {QUICK_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-sm)' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
