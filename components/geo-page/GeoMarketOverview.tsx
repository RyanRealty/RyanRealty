'use client'

import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { trackEvent } from '@/lib/tracking'

export type GeoMarketStats = {
  medianPrice: number | null
  count: number
  avgDom: number | null
  closedLast12Months: number
}

export type PricePoint = { month: string; medianPrice: number }

type Props = {
  /** e.g. "Bend", "Caldera Springs" */
  placeName: string
  headingId: string
  stats: GeoMarketStats
  priceHistory: PricePoint[]
  /** e.g. /reports/city/Bend */
  fullReportHref: string
  /** e.g. /reports/explore */
  exploreHref?: string
  /** For analytics, e.g. "city_market_stats" */
  trackContext: string
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatMonth(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/**
 * Shared Market Overview for city, community, and neighborhood pages.
 * Four stat cards, optional median price chart, and Full report + Explore CTAs.
 */
export default function GeoMarketOverview({
  placeName,
  headingId,
  stats,
  priceHistory,
  fullReportHref,
  exploreHref = '/reports/explore',
  trackContext,
}: Props) {
  const hasChartData = priceHistory.length >= 2

  return (
    <section className="bg-muted px-4 py-10 sm:px-6 sm:py-12" aria-labelledby={headingId}>
      <div className="mx-auto max-w-7xl">
        <h2 id={headingId} className="text-2xl font-bold tracking-tight text-primary">
          {placeName} Market Overview
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">{formatPrice(stats.medianPrice)}</p>
              <p className="text-sm text-muted-foreground">Median Price</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">{stats.count}</p>
              <p className="text-sm text-muted-foreground">Active Listings</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">
                {stats.avgDom != null && stats.avgDom > 0 ? Math.round(stats.avgDom) : '—'}
              </p>
              <p className="text-sm text-muted-foreground">Avg Days on Market</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">{stats.closedLast12Months}</p>
              <p className="text-sm text-muted-foreground">Homes Sold (12 mo)</p>
            </CardContent>
          </Card>
        </div>
        {hasChartData ? (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-primary">Median price trend</h3>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory.map((p) => ({ ...p, monthLabel: formatMonth(p.month) }))}>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Median']} labelFormatter={formatMonth} />
                  <Line type="monotone" dataKey="medianPrice" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Market data building — check back soon for price trends and sales volume.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            onClick={() => trackEvent('view_market_report', { context: trackContext, place: placeName })}
          >
            <Link href={fullReportHref}>
              Full market report
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            onClick={() => trackEvent('view_market_report', { context: `${trackContext}_explore`, place: placeName })}
          >
            <Link href={exploreHref}>
              Explore market data
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
