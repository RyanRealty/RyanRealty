// @no-parity — internal admin surface, no public mockup contract
//
// Operations command center — P11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: requireAdminPage('settings.system'), the
// getSetupComplete() → /admin/setup redirect, the unstable_cache bundle
// (['admin-dashboard-data'], revalidate 180, tag 'admin-dashboard') around the
// same five fetchers in the same order, the DashboardPanel mounts with their
// ids, titles, defaultOpen flags and props, and the six quick links.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> title chrome is gone (the nav names the page), the
// legacy summary-strip card row became the family's typographic numbers strip
// (its component was deleted in this wave once nothing imported it), and the
// ConsoleSection around the quick links became a SectionHead.
//
// "ACTIVE LISTINGS" WAS CUT IN 11E AND IS BACK IN 11F, because the figure is
// now true. 11E could not make it true from what the page read: activeCount was
// getTotalListingsCount(), the sum of geo_snapshot_mv.active_sfr_count over the
// TOP 50 CITIES, so it printed 2,915 (measured 2026-08-08) for an active bucket
// holding 7,658 — and the DashboardSyncPanel below it published that same wrong
// number under the heading "Active" while its OWN status breakdown, eight rows
// further down, printed the right one from getActiveBucketCount().
//
// 11F fixed the source rather than the caption (getAdminSyncCounts): activeCount
// is getActiveBucketCount() and totalListings is getAllListingsCount(). Both are
// plain service-role counts, like every sibling on that panel. Cutting a figure
// is the right move while it is a lie; restoring it is the right move once it
// is not.
//
// 11F ALSO DELETED THE "Notification and alert center" PANEL rather than
// migrating it. Its whole body was a promise: "The notification center will
// show system-generated alerts... Notifications can be delivered in-app, by
// email, or SMS with per-type toggles", under a heading, above "No
// notifications yet. Alert wiring (sync failure, API health, etc.) is coming in
// a follow-up." The alert wiring EXISTS and runs every minute —
// /api/cron/crm-alert-drain in vercel.json, lib/crm/broker-alerts.ts exporting
// queueBrokerAlert / queueBrokerHealthAlert / queueCmaReadyAlert /
// queueReturnVisitAlert, and the whole P8 litmus wake-up path is built on it.
// A panel telling a broker their alerts do not exist yet, while those alerts
// are drained every 60 seconds, is a false claim; re-skinning it would have
// shipped the claim in nicer type.
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
import DashboardPanel from './_components/DashboardPanel'
import DashboardSyncPanel from './_components/DashboardSyncPanel'
import DashboardLeadPanel from './_components/DashboardLeadPanel'
import DashboardGA4Panel from './_components/DashboardGA4Panel'
import DashboardSitePerformancePanel from './_components/DashboardSitePerformancePanel'
import DashboardRevenuePanel from './_components/DashboardRevenuePanel'
import DashboardContentStatusPanel from './_components/DashboardContentStatusPanel'
import DashboardMarketingCommandCenterPanel from './_components/DashboardMarketingCommandCenterPanel'
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

// The five dashboard fetchers hit live third-party APIs (GA4, Meta Graph) and
// exact-count scans — 30-45s uncached per render, which read as
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
      key: 'active',
      label: 'Active listings',
      value: nf.format(syncData.counts.activeCount),
      delta: { direction: 'flat', text: 'every property type' },
      aux: { href: '/admin/listings', label: 'Open listings' },
    },
    {
      key: 'sessions',
      // GA4 only — not product traffic. Primary volume = visitor_sessions (see docs/plans/seo-voice/MEASUREMENT_DUAL_SOURCE.md).
      label: 'GA4 sessions, 30 days (not primary traffic)',
      value: ga4.ok ? nf.format(ga4.sessions) : '—',
      delta: {
        direction: 'flat',
        text: ga4.ok ? `${nf.format(ga4.socialSessions)} from social · FP = visitor_sessions` : 'GA4 offline · use visitor_sessions',
      },
      aux: { href: '/admin/reports/traffic-sources', label: 'Traffic sources' },
    },
    {
      key: 'leadevents',
      label: 'Lead events, 30 days',
      value: ga4.ok ? nf.format(ga4.facebookLeadEvents) : '—',
      delta: { direction: 'flat', text: ga4.ok ? 'from Facebook' : 'GA4 offline' },
      aux: { href: '/admin/reports/lead-flow', label: 'Lead flow' },
    },
    {
      key: 'valuations',
      label: 'Valuation requests',
      value: nf.format(marketingData.website.valuationRequests30d),
      delta: { direction: 'flat', text: 'last 30 days' },
      aux: { href: '/admin/valuations', label: 'Open valuations' },
    },
    {
      key: 'identified',
      label: 'Sessions identified',
      value: identifiedRate,
      delta: {
        direction: 'flat',
        text: `${nf.format(leadData.visitsWithUser)} of ${nf.format(leadData.totalVisits)}, all time`,
      },
      aux: { href: '/admin/visitors/live', label: 'Live visitors' },
    },
    {
      key: 'photos',
      label: 'No hero photo',
      value: nf.format(missingPhoto),
      delta: { direction: 'flat', text: 'active + pending listings' },
    },
  ]

  // overflowX 'clip' is the old <main>'s `overflow-x-clip`, carried over: the
  // open sync panel measures wider than a 375px viewport. Clip contains it here
  // the way it always did, and a descendant's own overflow-x:auto still scrolls.
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

        <DashboardPanel id="marketing" title="Marketing command center (Meta + GA4 + CRM)" defaultOpen={false}>
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
