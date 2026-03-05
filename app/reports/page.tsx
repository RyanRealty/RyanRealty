import Link from 'next/link'
import { listMarketReports } from '../actions/market-reports'

export const metadata = {
  title: 'Market Reports',
  description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
}

export default async function ReportsIndexPage() {
  const reports = await listMarketReports(30)
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Market reports</h1>
      <p className="mt-2 text-zinc-600">
        Weekly summaries of what happened in the Central Oregon market: homes that went pending and homes that closed, by city.
      </p>
      {reports.length === 0 ? (
        <p className="mt-8 text-zinc-500">No reports yet. Reports are generated weekly (e.g. Saturday morning).</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {reports.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/reports/${r.slug}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
              >
                <span className="font-medium text-zinc-900">{r.title}</span>
                <span className="ml-2 text-sm text-zinc-500">
                  {r.period_start} – {r.period_end}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
