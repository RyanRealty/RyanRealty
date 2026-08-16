'use client'

/**
 * MarketCoreCharts — tabbed city-scope series on the listing market block.
 * Geometry is V3Chart (lib/charts/plot). Tabs stay client. A tab with fewer
 * than two points is omitted. Zero chartable tabs render nothing.
 */

import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { V3Chart, v3Text } from '@/components/site/v3'
import type { CoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { buildCoreChartTabs, type CoreChartTab } from './core-charts'

export type MarketCoreChartsProps = {
  data: CoreChartSeries | null
  heading?: string
  /**
   * Names the geography charted when it differs from the page subject.
   * A city series is never read as the community's. (§0)
   */
  scopeLabel?: string
  className?: string
}

function chartForTab(tab: CoreChartTab) {
  return {
    caption: v3Text(`${tab.tabLabel}, ${tab.period}`),
    kind: tab.kind === 'bar' ? ('bars' as const) : ('line' as const),
    series: [
      {
        name: v3Text(tab.tabLabel),
        points: tab.rows.map((row) => ({
          value: row.value,
          tick: v3Text(row.label),
          label: v3Text(formatReading(tab, row.value)),
        })),
      },
    ],
  }
}

function formatReading(tab: CoreChartTab, value: number): string {
  if (tab.metric === 'medianClosePrice') {
    return `$${(Math.round(value / 1000) * 1000).toLocaleString('en-US')}`
  }
  if (tab.metric === 'priceCutShare') return `${value.toFixed(1)}%`
  if (tab.metric === 'monthsOfSupply') return tab.latestValue
  if (tab.metric === 'medianDom') return `${Math.round(value)} days`
  if (tab.metric === 'closedVolume') return `${Math.round(value).toLocaleString('en-US')} sold`
  return `${Math.round(value).toLocaleString('en-US')} active`
}

function CoreChartTabStrip({
  tabs,
  active,
  onSelect,
  idBase,
}: {
  tabs: CoreChartTab[]
  active: string
  onSelect: (metric: string) => void
  idBase: string
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    const metric = tabs[next]!.metric
    onSelect(metric)
    refs.current.get(metric)?.focus()
  }
  return (
    <div role="tablist" aria-label="Market metric" className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((t, i) => {
        const selected = t.metric === active
        return (
          <button
            key={t.metric}
            ref={(el) => {
              if (el) refs.current.set(t.metric, el)
              else refs.current.delete(t.metric)
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.metric}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.metric}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.metric)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.tabLabel}
          </button>
        )
      })}
    </div>
  )
}

export function MarketCoreCharts({ data, heading, scopeLabel, className }: MarketCoreChartsProps) {
  const tabs = useMemo(() => buildCoreChartTabs(data), [data])
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  if (tabs.length === 0) return null
  const active = tabs.find((t) => t.metric === activeMetric)?.metric ?? tabs[0]!.metric
  const tab = tabs.find((t) => t.metric === active)!
  const idBase = 'core-charts'
  const chart = chartForTab(tab)

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-6', className)}>
      {heading ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold text-primary">{heading}</h3>
          {scopeLabel ? <span className="text-xs text-muted-foreground">Charted at {scopeLabel} scope</span> : null}
        </div>
      ) : scopeLabel ? (
        <p className="mb-3 text-xs text-muted-foreground">Charted at {scopeLabel} scope</p>
      ) : null}
      <CoreChartTabStrip tabs={tabs} active={active} onSelect={setActiveMetric} idBase={idBase} />
      <div
        role="tabpanel"
        id={`${idBase}-panel-${tab.metric}`}
        aria-labelledby={`${idBase}-tab-${tab.metric}`}
        className="pt-3"
      >
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xl font-bold text-primary">{tab.latestValue}</span>
          <span className="text-xs text-muted-foreground">{tab.latestPeriod}</span>
          {tab.verdictLabel ? (
            <span className="text-xs font-medium text-foreground">{tab.verdictLabel}</span>
          ) : null}
        </div>
        <V3Chart
          id={`${idBase}-${tab.metric}`}
          caption={chart.caption}
          kind={chart.kind}
          series={chart.series}
        />
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {tab.period} · {tab.source}. {tab.metric === 'monthsOfSupply'
            ? 'Months of supply is active inventory divided by average monthly closed sales over the trailing 6 months. Four or less is a seller\'s market, four to six is balanced, six or more is a buyer\'s market.'
            : tab.metric === 'priceCutShare'
              ? 'Share of active listings with at least one price cut.'
              : 'Completed months only.'}
        </p>
      </div>
    </div>
  )
}
