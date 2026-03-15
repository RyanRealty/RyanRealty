'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import type { BeaconReportData } from '@/app/actions/beacon-report'
import { cn } from '@/lib/utils'

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

const CHART_COLORS = {
  value: 'var(--primary)',
  sold: 'var(--primary)',
  median_price: 'var(--chart-1)',
  median_dom: 'var(--chart-2)',
  listings: 'var(--chart-2)',
  count: 'var(--accent)',
}

type Props = {
  data: BeaconReportData
  className?: string
}

export default function BeaconReportCarousel({ data, className }: Props) {
  const { periodStart, periodEnd, metricsByCity, priceBandsSample, priceBandsSampleCity, timeseriesSample, timeseriesSampleCity } = data

  const soldChartData = metricsByCity.map(({ city, metrics }) => ({
    city,
    sold: metrics.sold_count,
    fullName: city,
  }))

  const soldChartConfig = {
    sold: {
      label: 'Sold (7 days)',
      color: CHART_COLORS.sold,
    },
    fullName: { label: 'City' },
  } satisfies ChartConfig

  const medianPriceChartData = metricsByCity.map(({ city, metrics }) => ({
    city,
    median_price: metrics.median_price,
    fullName: city,
  }))

  const medianPriceChartConfig = {
    median_price: {
      label: 'Median price',
      color: CHART_COLORS.median_price,
    },
    fullName: { label: 'City' },
  } satisfies ChartConfig

  const domChartData = metricsByCity.map(({ city, metrics }) => ({
    city,
    median_dom: metrics.median_dom ?? 0,
    fullName: city,
  }))

  const domChartConfig = {
    median_dom: {
      label: 'Median DOM',
      color: CHART_COLORS.median_dom,
    },
    fullName: { label: 'City' },
  } satisfies ChartConfig

  const listingsChartData = metricsByCity.map(({ city, metrics }) => ({
    city,
    listings: metrics.current_listings,
    fullName: city,
  }))

  const listingsChartConfig = {
    listings: {
      label: 'Active listings',
      color: CHART_COLORS.listings,
    },
    fullName: { label: 'City' },
  } satisfies ChartConfig

  const priceBandsData =
    priceBandsSample?.sales_by_band?.map((b) => ({
      band: b.band,
      count: b.cnt,
      name: b.band,
    })) ?? []

  const priceBandsConfig = {
    count: {
      label: 'Sales',
      color: CHART_COLORS.count,
    },
    band: { label: 'Price band' },
  } satisfies ChartConfig

  const timeseriesChartData =
    timeseriesSample?.map((p) => ({
      month: p.period_start,
      medianPrice: p.median_price ?? 0,
      monthLabel: p.month_label,
    })) ?? []

  const timeseriesChartConfig = {
    medianPrice: {
      label: 'Median price',
      color: CHART_COLORS.median_price,
    },
    monthLabel: { label: 'Month' },
  } satisfies ChartConfig

  const periodLabel = `${periodStart} – ${periodEnd}`

  const chartWrapperClass = 'min-h-[200px] w-full rounded-lg bg-muted/20 ring-1 ring-border/40 p-3'

  const tiles = [
    {
      id: 'sold',
      title: 'Sold (last 7 days)',
      subtitle: periodLabel,
      children: (
        <ChartContainer config={soldChartConfig} className={chartWrapperClass}>
          <BarChart accessibilityLayer data={soldChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="city"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sold" fill="var(--color-sold)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      ),
    },
    {
      id: 'median-price',
      title: 'Median price (7 days)',
      subtitle: periodLabel,
      children: (
        <ChartContainer config={medianPriceChartConfig} className={chartWrapperClass}>
          <BarChart accessibilityLayer data={medianPriceChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="city"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={() => ''}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={44}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => (typeof v === 'number' ? [formatPrice(v), 'Median price'] : [v, ''])}
                />
              }
            />
            <Bar dataKey="median_price" fill="var(--color-median_price)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      ),
    },
    {
      id: 'dom',
      title: 'Median days on market',
      subtitle: periodLabel,
      children: (
        <ChartContainer config={domChartConfig} className={chartWrapperClass}>
          <BarChart accessibilityLayer data={domChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="city"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="median_dom" fill="var(--color-median_dom)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      ),
    },
    {
      id: 'listings',
      title: 'Active listings',
      subtitle: 'Current inventory by city',
      children: (
        <ChartContainer config={listingsChartConfig} className={chartWrapperClass}>
          <BarChart accessibilityLayer data={listingsChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="city"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="listings" fill="var(--color-listings)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      ),
    },
    ...(priceBandsData.length > 0
      ? [
          {
            id: 'price-bands',
            title: `Price bands — ${priceBandsSampleCity ?? 'Sales'}`,
            subtitle: periodLabel,
            children: (
              <ChartContainer config={priceBandsConfig} className={chartWrapperClass}>
                <BarChart accessibilityLayer data={priceBandsData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="band"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                    interval={0}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ),
          },
        ]
      : []),
    ...(timeseriesChartData.length > 0
      ? [
          {
            id: 'trend',
            title: `Median price trend — ${timeseriesSampleCity ?? ''}`,
            subtitle: 'Last 4 months',
            children: (
              <ChartContainer config={timeseriesChartConfig} className={chartWrapperClass}>
                <LineChart
                  accessibilityLayer
                  data={timeseriesChartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    width={44}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelKey="monthLabel"
                        formatter={(v) => (typeof v === 'number' ? [formatPrice(v), 'Median price'] : [v, ''])}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="medianPrice"
                    stroke="var(--color-medianPrice)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ),
          },
        ]
      : []),
  ]

  if (tiles.length === 0) return null

  return (
    <TooltipProvider delayDuration={300}>
      <section
        className={cn(
          'w-full border-y border-border/50 bg-gradient-to-b from-muted/30 via-background to-muted/20',
          'relative overflow-hidden',
          className
        )}
        aria-labelledby="beacon-report-heading"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-md border-primary/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              7-day window
            </Badge>
            <Badge variant="secondary" className="rounded-md px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Live data
            </Badge>
          </div>
          <h2
            id="beacon-report-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Market pulse
          </h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Real-time beacon metrics across Central Oregon. Scroll for sold volume, median price, days on market, inventory, and trends.
          </p>
          <Separator className="mt-6 bg-border/60" />

          <div className="relative mt-8">
            <Carousel
              opts={{ align: 'start', loop: false }}
              className="w-full"
            >
              <CarouselContent className="-ml-3 sm:-ml-5">
                {tiles.map((tile) => (
                  <CarouselItem key={tile.id} className="pl-3 sm:pl-5 md:basis-1/2 xl:basis-1/3">
                    <Link
                      href="/reports"
                      className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                    >
                      <Card
                        className={cn(
                          'overflow-hidden border border-border/60 bg-card/95 shadow-sm backdrop-blur-sm',
                          'transition-all duration-200 hover:border-primary/20 hover:shadow-md'
                        )}
                      >
                        <CardHeader className="border-l-2 border-primary/80 bg-muted/5 pl-4 pr-4 pt-4">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">
                            {tile.title}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{tile.subtitle}</p>
                        </CardHeader>
                        <CardContent className="pb-5 pt-3">{tile.children}</CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CarouselPrevious
                    variant="outline"
                    size="icon"
                    className="left-2 h-9 w-9 rounded-full border-border/80 bg-background/95 shadow-lg backdrop-blur-sm sm:left-4"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">Previous</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CarouselNext
                    variant="outline"
                    size="icon"
                    className="right-2 h-9 w-9 rounded-full border-border/80 bg-background/95 shadow-lg backdrop-blur-sm sm:right-4"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">Next</TooltipContent>
              </Tooltip>
            </Carousel>
          </div>

          <div className="mt-10 flex justify-center">
            <Button variant="outline" size="default" className="group rounded-lg" asChild>
              <Link href="/reports/explore" className="gap-2">
                Explore full reports
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </TooltipProvider>
  )
}
