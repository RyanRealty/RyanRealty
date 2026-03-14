'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'
import SalesReportCard from '@/components/reports/SalesReportCard'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import type { SalesReportCardData } from '@/app/actions/market-reports'

type ReportItem = { slug: string; title: string; period_start: string; period_end: string }

type Props = { reports: ReportItem[]; salesCards: SalesReportCardData[] }

export default function ReportsIndexContent({ reports, salesCards }: Props) {
  return (
    <>
      <TilesSlider
        title="Sales reports by city"
        subtitle="Pre-built reports for each city: this week, last week, last month, and last year. No waiting — view or download anytime."
        titleId="sales-reports-heading"
      >
        {salesCards.map((card) => (
          <TilesSliderItem key={`${card.city}-${card.periodSlug}`}>
            <SalesReportCard card={card} />
          </TilesSliderItem>
        ))}
      </TilesSlider>

      <h2 className="mt-16 text-2xl font-bold text-primary sm:text-3xl">
        Weekly market reports
      </h2>
      <Link
        href="/reports/explore"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-accent/90"
        onClick={() => trackEvent('view_market_report', { context: 'reports_index_explore' })}
      >
        Explore market data
        <span aria-hidden>→</span>
      </Link>
      {reports.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No weekly reports yet. Weekly summaries are generated on a schedule.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {reports.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/reports/${r.slug}`}
                className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/20"
                onClick={() => trackEvent('view_market_report', { context: 'reports_index_weekly', slug: r.slug, title: r.title })}
              >
                <span className="font-semibold text-primary">{r.title}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {r.period_start} – {r.period_end}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
