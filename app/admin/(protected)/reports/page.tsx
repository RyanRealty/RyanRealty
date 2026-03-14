import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import GenerateReportButton from './GenerateReportButton'
import CityReportSection from './CityReportSection'

export default async function AdminReportsPage() {
  const { cities } = await getReportCities()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      <h2 className="mt-8 text-xl font-semibold text-foreground">Weekly market report</h2>
      <p className="mt-2 text-muted-foreground">
        Generate the weekly market report (last Sunday–Saturday). Lists homes that went pending and closed, by city. Report gets an AI-generated image and is shareable. Cron can call <code className="rounded bg-muted px-1">GET /api/cron/market-report</code> with <code className="rounded bg-muted px-1">Authorization: Bearer CRON_SECRET</code> (e.g. Saturday morning).
      </p>
      <div className="mt-6">
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </div>
      <CityReportSection cities={cities} />
      <h2 className="mt-8 text-xl font-semibold text-foreground">Report generator</h2>
      <ul className="mt-2 space-y-1">
        <li><Link href="/admin/reports/custom" className="text-primary hover:underline">Custom report builder</Link> — Any location, any date range, all sales data (metrics, price bands, time series, pending/closed)</li>
        <li><Link href="/admin/reports/market" className="text-primary hover:underline">Market report by area</Link></li>
        <li><Link href="/admin/reports/brokers" className="text-primary hover:underline">Broker performance</Link></li>
        <li><Link href="/admin/reports/leads" className="text-primary hover:underline">Lead analytics</Link></li>
      </ul>
      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin/sync" className="underline hover:no-underline">Back to Sync</Link>
      </p>
    </main>
  )
}
