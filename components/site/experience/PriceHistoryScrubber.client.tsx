/**
 * PriceHistoryScrubber.client -- client island for the scrubbable price chart.
 *
 * Recharts AreaChart with mouse/touch scrub support. On scrub, a large
 * tabular readout above the chart updates to show the hovered month + median.
 *
 * Engagement: fires `chart_scrub` module_interact event on first scrub.
 *
 * CLAUDE.md §0: data must be from market_stats_cache via getPriceHistory().
 * This component never aggregates raw listings -- it only renders pre-verified
 * market_stats_cache rows passed in as props.
 */
// brand-voice:exempt -- pure UI component
'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DisplayHeading } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

function formatMonthLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'America/Los_Angeles' })
  } catch {
    return iso.slice(0, 7)
  }
}

function formatMonthFull(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Los_Angeles' })
  } catch {
    return iso.slice(0, 7)
  }
}

function formatPriceFull(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const rounded = Math.round(n / 1000) * 1000
  return `$${rounded.toLocaleString('en-US')}`
}

function formatPriceCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}k`
}

type ChartDatum = {
  period: string
  periodFull: string
  median: number | null
  rawIso: string
}

type Props = {
  data: ReadonlyArray<PriceHistoryPoint>
  sectionId?: string
  height?: number
}

export default function PriceHistoryScrubberClient({ data, sectionId = 'price-scrubber', height = 240 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { trackInteract } = useEngagementTracking(sectionId, { ref, pageType: 'geo', position: 4 })

  const chartData: ChartDatum[] = data.map((p) => ({
    period: formatMonthLabel(p.periodStart),
    periodFull: formatMonthFull(p.periodStart),
    median: p.medianSalePrice ?? null,
    rawIso: p.periodStart,
  }))

  // Latest data point as default readout
  const latest = chartData.at(-1)
  const [readout, setReadout] = useState<{ period: string; median: number | null } | null>(
    latest ? { period: latest.periodFull, median: latest.median } : null,
  )
  const hasTracked = useRef(false)

  // y-axis range
  const medians = chartData.map((d) => d.median).filter((n): n is number => n != null && Number.isFinite(n))
  const dataMin = medians.length ? Math.min(...medians) : 0
  const dataMax = medians.length ? Math.max(...medians) : 0
  const pad = Math.max((dataMax - dataMin) * 0.18, 25000)
  const yLo = Math.max(0, Math.floor((dataMin - pad) / 25000) * 25000)
  const yHi = Math.ceil((dataMax + pad) / 25000) * 25000

  const handleMouseMove = useCallback(
    (chartState: { activePayload?: Array<{ payload: ChartDatum }> }) => {
      if (!chartState?.activePayload?.[0]) return
      const p = chartState.activePayload[0].payload
      setReadout({ period: p.periodFull, median: p.median })
      if (!hasTracked.current) {
        hasTracked.current = true
        trackInteract('chart_scrub')
      }
    },
    [trackInteract],
  )

  const handleMouseLeave = useCallback(() => {
    if (latest) {
      setReadout({ period: latest.periodFull, median: latest.median })
    }
  }, [latest])

  return (
    <div ref={ref}>
      {/* Large tabular readout */}
      <div className="mb-4 flex items-baseline gap-4 flex-wrap">
        <DisplayHeading
          as="div"
          className="tabular-nums text-foreground leading-none"
          style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', letterSpacing: '-0.02em' }}
        >
          {readout?.median != null ? formatPriceFull(readout.median) : '—'}
        </DisplayHeading>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Median sale price
          </span>
          <span className="text-sm text-muted-foreground">
            {readout?.period ?? ''}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm cursor-crosshair select-none touch-pan-y">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
            onMouseMove={handleMouseMove as (state: unknown) => void}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="rrScrubberFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#102742" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#102742" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(16,39,66,0.07)" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: 'rgb(16 39 66 / 0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(16,39,66,0.10)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yLo, yHi]}
              tickFormatter={(v) => formatPriceCompact(v as number)}
              tick={{ fill: 'rgb(16 39 66 / 0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              content={() => null}
              cursor={{ stroke: 'rgba(16,39,66,0.22)', strokeWidth: 1.5 }}
            />
            <Area
              type="linear"
              dataKey="median"
              stroke="#102742"
              strokeWidth={2}
              fill="url(#rrScrubberFill)"
              dot={false}
              activeDot={{ r: 4, stroke: '#102742', strokeWidth: 2, fill: '#ffffff' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground text-right">
        Drag to scrub. Source: Oregon MLS via Ryan Realty.
      </p>
    </div>
  )
}
