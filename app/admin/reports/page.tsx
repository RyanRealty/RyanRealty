import Link from 'next/link'
import { getReportCities } from '../../actions/reports'
import { generateWeeklyMarketReport } from '../../actions/generate-market-report'
import GenerateReportButton from './GenerateReportButton'
import CityReportSection from './CityReportSection'

export default async function AdminReportsPage() {
  const { cities } = await getReportCities()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Reports</h1>
      <h2 className="mt-8 text-xl font-semibold text-zinc-900">Weekly market report</h2>
      <p className="mt-2 text-zinc-600">
        Generate the weekly market report (last Sunday–Saturday). Lists homes that went pending and closed, by city. Report gets an AI-generated image and is shareable. Cron can call <code className="rounded bg-zinc-100 px-1">GET /api/cron/market-report</code> with <code className="rounded bg-zinc-100 px-1">Authorization: Bearer CRON_SECRET</code> (e.g. Saturday morning).
      </p>
      <div className="mt-6">
        <GenerateReportButton generateAction={generateWeeklyMarketReport} />
      </div>
      <CityReportSection cities={cities} />
      <p className="mt-10 text-sm text-zinc-500">
        <Link href="/admin/sync" className="underline hover:no-underline">Back to Sync</Link>
      </p>
    </main>
  )
}
