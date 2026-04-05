'use client'

import { useRef, useState, useEffect } from 'react'
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'
import type { CityReport, MarketReportData } from '@/app/actions/market-report-types'
import { cn } from '@/lib/utils'

const SCROLL_THRESHOLD = 4

function formatPeriodLabel(start: string, end: string): string {
  const parseYmdLocal = (value: string): Date | null => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    const parsed = new Date(y, mo, d)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  try {
    const s = parseYmdLocal(start)
    const e = parseYmdLocal(end)
    if (!s || !e) return `${start} – ${end}`
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } catch {
    return `${start} – ${end}`
  }
}

function buildExploreHref(city: string, periodStart: string, periodEnd: string): string {
  const params = new URLSearchParams()
  params.set('city', city)
  params.set('start', periodStart)
  params.set('end', periodEnd)
  return `/reports/explore?${params.toString()}`
}

const CHART_COLORS = {
  median_price: 'var(--chart-1)',
  sold_count: 'var(--primary)',
}

/**
 * Mini line chart for a city: median price or sold count over time (YTD months). Falls back to a single-metric display if no timeseries.
 */
function CityMiniChart({ city }: { city: CityReport }) {
  const series = city.timeseries && city.timeseries.length > 0
    ? [...city.timeseries].reverse().map((p) => ({
        month: p.month_label,
        median_price: p.median_price ?? 0,
        sold_count: p.sold_count ?? 0,
      }))
    : []

  if (series.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center px-2">
        <p className="text-center text-sm text-primary-foreground/90">
          {city.metrics.sold_count} sales YTD
        </p>
      </div>
    )
  }

  const config = {
    median_price: { label: 'Median price', color: CHART_COLORS.median_price },
    sold_count: { label: 'Sales', color: CHART_COLORS.sold_count },
    month: { label: 'Month' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="min-h-[100px] w-full">
      <LineChart
        data={series}
        margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} strokeDasharray="2 2" className="stroke-primary-foreground/15" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: 'var(--primary-foreground)' }}
        />
        <YAxis
          yAxisId="price"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 9, fill: 'var(--primary-foreground)' }}
          tickFormatter={(v) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`)}
          width={32}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) =>
                typeof v === 'number' && v > 1000
                  ? [`$${Number(v).toLocaleString()}`, 'Median price']
                  : [v, 'Sales']
              }
            />
          }
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="median_price"
          stroke="var(--color-median_price)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

type Props = {
  data: MarketReportData
  className?: string
}

export default function MarketPulseCarousel({ data, className }: Props) {
  const { periodStart, periodEnd, metricsByCity } = data
  const periodLabel = formatPeriodLabel(periodStart, periodEnd)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(maxScroll > SCROLL_THRESHOLD && el.scrollLeft > SCROLL_THRESHOLD)
    setCanScrollRight(maxScroll > SCROLL_THRESHOLD && el.scrollLeft < maxScroll - SCROLL_THRESHOLD)
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    const step = el.clientWidth * 0.85
    el.scrollBy({ left: direction === 'right' ? step : -step, behavior: 'smooth' })
    setTimeout(updateScrollState, 350)
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => ro.disconnect()
  }, [metricsByCity.length])

  if (metricsByCity.length === 0) return null

  return (
    <section
        className={cn('w-full bg-card px-4 py-16 sm:px-6 sm:py-20', className)}
        aria-labelledby="housing-market-report-heading"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md border-primary/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              Year to date
            </Badge>
            <Badge variant="secondary" className="rounded-md px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Residential only
            </Badge>
          </div>
          <h2
            id="housing-market-report-heading"
            className="mt-3 text-2xl text-primary sm:text-3xl"
          >
            Housing Market Report
          </h2>
          <p className="mt-2 text-muted-foreground">
            Residential home sales by city. Click a card to open the report generator with that city and year-to-date range.
          </p>

          <div className="relative group/slider mt-6">
            <Button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-r from-foreground/40 to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
              aria-label="Scroll left"
            >
              <span className="rounded-full bg-card/90 p-2 shadow-md">
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5 text-foreground" />
              </span>
            </Button>
            <Button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-l from-foreground/40 to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
              aria-label="Scroll right"
            >
              <span className="rounded-full bg-card/90 p-2 shadow-md">
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-foreground" />
              </span>
            </Button>
            <div
              ref={scrollRef}
              onScroll={updateScrollState}
              className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar [scroll-snap-type:x_mandatory]"
            >
              {metricsByCity.map((city) => {
                const exploreHref = buildExploreHref(city.city, periodStart, periodEnd)
                return (
                  <div
                    key={city.city}
                    className="shrink-0 scroll-snap-align-start w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <Link
                        href={exploreHref}
                        className={cn(
                          'block overflow-hidden rounded-xl border border-border bg-card shadow-sm',
                          'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                        )}
                      >
                        <div
                          className={cn(
                            'relative px-4 pt-4 pb-3 text-primary-foreground',
                            !city.heroImageUrl && 'bg-primary'
                          )}
                          style={
                            city.heroImageUrl
                              ? {
                                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 100%), url(${city.heroImageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/90">
                                {city.city.toUpperCase()}
                              </p>
                              <p className="mt-1 text-lg font-bold tracking-tight">
                                Market Reports
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Top {metricsByCity.findIndex((m) => m.city === city.city) + 1}
                              </Badge>
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20"
                                aria-hidden
                              >
                                <HugeiconsIcon icon={ArrowUp01Icon} className="h-4 w-4" />
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-primary-foreground/85">
                            {periodLabel}
                          </p>
                          <div className="mt-3 h-[100px] [&_.recharts-cartesian-axis-tick_text]:fill-primary-foreground [&_.recharts-cartesian-grid_line]:stroke-primary-foreground/20 [&_.recharts-line]:stroke-primary-foreground/90 [&_.recharts-curve]:stroke-primary-foreground/90">
                            <CityMiniChart city={city} />
                          </div>
                        </div>
                        <div className="border-t border-border bg-card px-4 py-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Sold {city.metrics.sold_count.toLocaleString()}</Badge>
                            <Badge variant="outline">
                              Median {city.metrics.median_price > 0 ? `$${Math.round(city.metrics.median_price).toLocaleString()}` : '—'}
                            </Badge>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                            View full report
                            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            New sales data is added as listings close.
                          </p>
                        </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button variant="outline" size="default" className="group" asChild>
              <Link href="/reports/explore" className="gap-2">
                Explore full reports
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
  )
}
