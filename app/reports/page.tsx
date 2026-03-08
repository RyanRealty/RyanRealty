import Link from 'next/link'
import type { Metadata } from 'next'
import { listMarketReports } from '../actions/market-reports'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Market Reports',
  description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
  alternates: { canonical: `${siteUrl}/reports` },
  openGraph: {
    title: 'Market Reports | Ryan Realty',
    description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
    url: `${siteUrl}/reports`,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Reports | Ryan Realty',
    description: 'Weekly Central Oregon real estate market reports: pending and closed sales by city.',
  },
}

export default async function ReportsIndexPage() {
  const reports = await listMarketReports(30)
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Market reports</h1>
      <p className="mt-2 text-zinc-600">
        Weekly summaries of what happened in the Central Oregon market: homes that went pending and homes that closed, by city.
      </p>
      <p className="mt-4">
        <Link
          href="/reports/explore"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
        >
          Explore market data
          <span aria-hidden>→</span>
        </Link>
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
