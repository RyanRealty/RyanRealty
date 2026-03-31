import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSetupComplete } from '@/app/actions/admin-setup'
import {
  getDashboardSyncData,
  getDashboardLeadData,
  getDashboardDataQuality,
} from '@/app/actions/dashboard'
import DashboardPanel from '@/components/admin/DashboardPanel'
import DashboardSyncPanel from '@/components/admin/DashboardSyncPanel'
import DashboardLeadPanel from '@/components/admin/DashboardLeadPanel'
import DashboardGA4Panel from '@/components/admin/DashboardGA4Panel'
import DashboardNotificationsPanel from '@/components/admin/DashboardNotificationsPanel'
import DashboardSitePerformancePanel from '@/components/admin/DashboardSitePerformancePanel'
import DashboardRevenuePanel from '@/components/admin/DashboardRevenuePanel'
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const setupComplete = await getSetupComplete()
  if (!setupComplete) redirect('/admin/setup')

  const [syncData, leadData, dataQuality] = await Promise.all([
    getDashboardSyncData(),
    getDashboardLeadData(),
    getDashboardDataQuality(),
  ])

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Super Admin Command Center</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Single view of system health, sync, leads, and observability. Panel state is saved in your browser.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Date range</span>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Last 30 days</span>
          <Button type="button" className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-border">
            Last 7 days
          </Button>
          <Button type="button" className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-border">
            Today
          </Button>
          <Button type="button" className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-border">
            Custom
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">GA4 and report panels will use this range when wired.</p>
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
            <p className="text-sm text-muted-foreground">Social content pipeline, content performance, and queue health will appear here when the content engine is implemented.</p>
            <p className="text-xs text-muted-foreground">Planned: events detected, items generated, pending review, scheduled, published, reach and engagement by platform.</p>
          </div>
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
          <li><Link href="/admin/place-content" className="text-success hover:underline">Place content</Link></li>
          <li><Link href="/admin/banners" className="text-success hover:underline">Banners</Link></li>
          <li><Link href="/admin/reports" className="text-success hover:underline">Reports</Link></li>
          <li><Link href="/admin/spark-status" className="text-success hover:underline">Spark API status</Link></li>
        </ul>
      </div>
    </main>
  )
}
