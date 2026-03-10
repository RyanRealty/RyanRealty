import Link from 'next/link'
import { getReportCities } from '../../../actions/reports'

export default async function AdminMarketReportPage() {
  const { cities } = await getReportCities()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Market Report Generator</h1>
      <p className="mt-2 text-zinc-600">
        Select an area and time period. Stats are pre-computed by the reporting/compute-market-stats job (after sync and daily at 2 AM).
      </p>
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900">Cities</h2>
        <ul className="mt-2 space-y-1">
          {cities.map((city) => (
            <li key={city}>
              <Link
                href={`/reports/city/${encodeURIComponent(city)}`}
                className="text-[var(--brand-navy)] hover:underline"
              >
                {city}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-8 text-sm text-zinc-500">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
