import Link from 'next/link'
import {
  getDashboardSyncData,
  getDashboardLeadData,
  getDashboardDataQuality,
} from '../actions/dashboard'
import DashboardPanel from '../../components/admin/DashboardPanel'
import DashboardSyncPanel from '../../components/admin/DashboardSyncPanel'
import DashboardLeadPanel from '../../components/admin/DashboardLeadPanel'
import DashboardGA4Panel from '../../components/admin/DashboardGA4Panel'
import DashboardNotificationsPanel from '../../components/admin/DashboardNotificationsPanel'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [syncData, leadData, dataQuality] = await Promise.all([
    getDashboardSyncData(),
    getDashboardLeadData(),
    getDashboardDataQuality(),
  ])

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Super Admin Command Center</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Single view of system health, sync, leads, and observability. Panel state is saved in your browser.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-zinc-600">Date range</span>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">Last 30 days</span>
          <button type="button" className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
            Last 7 days
          </button>
          <button type="button" className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
            Today
          </button>
          <button type="button" className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
            Custom
          </button>
        </div>
        <p className="text-xs text-zinc-500">GA4 and report panels will use this range when wired.</p>
      </div>

      <div className="mt-8 space-y-6">
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

        <DashboardPanel id="ga4" title="Google Analytics (GA4) deep integration" defaultOpen={true}>
          <DashboardGA4Panel />
        </DashboardPanel>

        <DashboardPanel id="lead" title="Lead and contact intelligence" defaultOpen={true}>
          <DashboardLeadPanel data={leadData} />
        </DashboardPanel>

        <DashboardPanel id="notifications" title="Notification and alert center" defaultOpen={false}>
          <DashboardNotificationsPanel />
        </DashboardPanel>

        <DashboardPanel id="content" title="Content engine performance" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-sm text-zinc-600">Social content pipeline, content performance, and queue health will appear here when the content engine is implemented.</p>
            <p className="text-xs text-zinc-500">Planned: events detected, items generated, pending review, scheduled, published, reach and engagement by platform.</p>
          </div>
        </DashboardPanel>

        <DashboardPanel id="siteperf" title="Site performance and technical health" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-sm text-zinc-600">Core Web Vitals (Search Console API), page index status, sitemap health, uptime, error log, and CDN metrics.</p>
            <p className="text-xs text-zinc-500">Requires Search Console API and optional uptime monitoring integration.</p>
          </div>
        </DashboardPanel>

        <DashboardPanel id="financial" title="Financial and business metrics (Super Admin only)" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-sm text-zinc-600">Manually maintained: platform costs, listings under management, lead-to-close pipeline. Not auto-populated from integrations.</p>
          </div>
        </DashboardPanel>
      </div>

      <div className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-700">Quick links</h2>
        <ul className="mt-2 flex flex-wrap gap-4 text-sm">
          <li><Link href="/admin/sync" className="text-emerald-700 hover:underline">Sync & history</Link></li>
          <li><Link href="/admin/geo" className="text-emerald-700 hover:underline">Geo hierarchy</Link></li>
          <li><Link href="/admin/resort-communities" className="text-emerald-700 hover:underline">Resort communities</Link></li>
          <li><Link href="/admin/banners" className="text-emerald-700 hover:underline">Banners</Link></li>
          <li><Link href="/admin/reports" className="text-emerald-700 hover:underline">Reports</Link></li>
          <li><Link href="/admin/spark-status" className="text-emerald-700 hover:underline">Spark API status</Link></li>
        </ul>
      </div>
    </main>
  )
}
