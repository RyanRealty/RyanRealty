'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { trackEvent } from '@/lib/tracking'
import {
  buildYtdComparisonRows,
  getAvailableYears,
  summarizeInterpretation,
  type YearSeriesPoint,
} from '@/lib/report-year-compare'

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
  salesHistory?: YearSeriesPoint[]
  /** e.g. /reports/city/Bend */
  fullReportHref: string
  /** Year-to-date report for this place (reports/explore?city=X&start=YTD&end=today). When set, shown as primary CTA. */
  ytdReportHref?: string | null
  /** e.g. /reports/explore */
  exploreHref?: string
  /** For analytics, e.g. "city_market_stats" */
  trackContext: string
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
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
  salesHistory = [],
  fullReportHref,
  ytdReportHref,
  exploreHref = '/reports/explore',
  trackContext,
}: Props) {
  const fallbackSeries = priceHistory.map((point) => ({
    period_start: `${point.month}-01`,
    sold_count: 0,
    median_price: point.medianPrice,
  }))
  const series = salesHistory.length > 0 ? salesHistory : fallbackSeries
  const availableYears = useMemo(() => getAvailableYears(series), [series])
  const currentYear = availableYears[0] ?? new Date().getUTCFullYear()
  const [compareYears, setCompareYears] = useState<number[]>(
    availableYears.filter((year) => year !== currentYear).slice(0, 3)
  )
  const chartYears = [currentYear, ...compareYears.filter((year) => year !== currentYear)].slice(0, 4)
  const monthCap = new Date().getUTCMonth() + 1
  const comparisonRows = useMemo(
    () => buildYtdComparisonRows(series, chartYears, monthCap),
    [series, chartYears, monthCap]
  )
  const hasChartData = comparisonRows.length >= 2
  const interpretation = useMemo(
    () => summarizeInterpretation(comparisonRows, currentYear, chartYears.filter((year) => year !== currentYear)),
    [comparisonRows, currentYear, chartYears]
  )
  const showYtd = Boolean(ytdReportHref)

  const updateCompareYear = (slot: number, value: string) => {
    const parsed = Number(value)
    setCompareYears((prev) => {
      const next = [...prev]
      if (!Number.isFinite(parsed)) return next
      next[slot] = parsed
      return Array.from(new Set(next)).filter((year) => year !== currentYear).slice(0, 3)
    })
  }

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
            <h3 className="text-lg font-semibold text-primary">Sales year comparison</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare year to date performance with up to three prior years.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((slot) => (
                <div key={slot} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Compare year {slot + 1}</Label>
                  <Select
                    value={String(compareYears[slot] ?? '')}
                    onValueChange={(value) => updateCompareYear(slot, value)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears
                        .filter((year) => year !== currentYear)
                        .map((year) => (
                          <SelectItem key={`cmp-${slot}-${year}`} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {chartYears.map((year, index) => (
                <Badge key={`legend-${year}`} variant={index === 0 ? 'soft-hot' : 'soft-neutral'}>
                  {index === 0 ? `${year} YTD` : String(year)}
                </Badge>
              ))}
            </div>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonRows}>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="sales" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [v, 'Sales']} />
                  {chartYears.map((year, index) => (
                    <Line
                      key={`sales-${year}`}
                      yAxisId="sales"
                      type="monotone"
                      dataKey={`sales_${year}`}
                      stroke={index === 0 ? 'var(--primary)' : 'var(--muted-foreground)'}
                      strokeWidth={index === 0 ? 2.5 : 1.8}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-primary">Median price year comparison</h3>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonRows}>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="price" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Median price']} />
                  {chartYears.map((year, index) => (
                    <Line
                      key={`price-${year}`}
                      yAxisId="price"
                      type="monotone"
                      dataKey={`price_${year}`}
                      stroke={index === 0 ? 'var(--accent)' : 'var(--muted-foreground)'}
                      strokeWidth={index === 0 ? 2.5 : 1.8}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-foreground">{interpretation}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Index notes: Sales index represents closed sales count by month. Price index represents monthly median sold price.
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {showYtd && (
            <Button
              asChild
              onClick={() => trackEvent('view_market_report', { context: `${trackContext}_ytd`, place: placeName })}
            >
              <Link href={ytdReportHref!}>
                Year-to-date report
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant={showYtd ? 'outline' : 'default'}
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
