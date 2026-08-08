'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ToolbarSelect, ToolbarCheck } from '@/components/admin/v2'
import { METRIC_OPTIONS, METRIC_LABELS, type MetricKey } from '@/lib/crm/reporting-constants'
import type { TimeSeriesPoint } from '@/lib/data/crm/getAgentActivityReport'
import { formatDate } from '@/lib/format/date'

// ── Types ──────────────────────────────────────────────────────────────────────

type Granularity = 'daily' | 'weekly' | 'monthly'

interface Props {
  timeSeries: TimeSeriesPoint[]
  prevTimeSeries: TimeSeriesPoint[]
  prevDateStart: string
  prevDateEnd: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtAxisDate(iso: string): string {
  return formatDate(iso + 'T00:00:00Z', { month: 'short', day: 'numeric' })
}

function fmtLongDate(iso: string): string {
  // iso may be a full ISO timestamp (from prevDateStart/prevDateEnd, e.g. "2025-06-30T23:59:59.999Z")
  // OR a date-only string (from chart tooltip labels, e.g. "2025-06-15").
  return formatDate(iso, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

type BucketRow = { date: string } & Record<MetricKey, number>

function aggregatePoints(points: TimeSeriesPoint[], granularity: Granularity): BucketRow[] {
  if (granularity === 'daily') {
    return points.map((p) => ({
      date: p.date,
      newLeads: p.newLeads,
      calls: p.calls,
      emails: p.emails,
      texts: p.texts,
      notes: p.notes,
      tasksCompleted: p.tasksCompleted,
      appointmentsSet: p.appointmentsSet,
      appointments: p.appointments,
    }))
  }

  const buckets = new Map<string, BucketRow>()

  for (const p of points) {
    const d = new Date(p.date + 'T00:00:00Z')
    let key: string

    if (granularity === 'weekly') {
      const dow = d.getUTCDay() // 0 = Sunday
      const monday = new Date(d)
      monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
      key = monday.toISOString().slice(0, 10)
    } else {
      key = p.date.slice(0, 7) + '-01'
    }

    if (!buckets.has(key)) {
      buckets.set(key, {
        date: key,
        newLeads: 0, calls: 0, emails: 0, texts: 0,
        notes: 0, tasksCompleted: 0, appointmentsSet: 0, appointments: 0,
      })
    }

    const b = buckets.get(key)!
    b.newLeads += p.newLeads
    b.calls += p.calls
    b.emails += p.emails
    b.texts += p.texts
    b.notes += p.notes
    b.tasksCompleted += p.tasksCompleted
    b.appointmentsSet += p.appointmentsSet
    b.appointments += p.appointments
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentActivityChart({ timeSeries, prevTimeSeries, prevDateStart, prevDateEnd }: Props) {
  const [metric, setMetric] = useState<MetricKey>('newLeads')
  const [compareMetric, setCompareMetric] = useState<string>('none')
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [showPrev, setShowPrev] = useState(false)

  // Chart colors are resolved from the live admin-v2 CSS custom properties at
  // mount rather than hardcoded — recharts SVG presentation attributes don't
  // reliably resolve var(...), so real color strings are read off the
  // document root instead. This is what lets the chart follow the admin's
  // light/dark token swap, which the previous hardcoded navy never did.
  // Until the effect runs the values are '' — recharts renders an empty
  // stroke poorly, so 'currentColor' (inherits .av2-scope's --a-text) is used
  // as the one-frame fallback instead of leaving the strokes blank.
  const [tok, setTok] = useState({
    current: '', compare: '', prev: '', grid: '', axis: '', surface: '', border: '', text: '',
  })
  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    setTok({
      current: s.getPropertyValue('--a-accent').trim(),
      compare: s.getPropertyValue('--a-text-2').trim(),
      prev: s.getPropertyValue('--a-border-strong').trim(),
      grid: s.getPropertyValue('--a-border').trim(),
      axis: s.getPropertyValue('--a-text-2').trim(),
      surface: s.getPropertyValue('--a-surface').trim(),
      border: s.getPropertyValue('--a-border').trim(),
      text: s.getPropertyValue('--a-text').trim(),
    })
  }, [])
  const currentColor = tok.current || 'currentColor'
  const compareColor = tok.compare || 'currentColor'
  const prevColor = tok.prev || 'currentColor'
  const gridColor = tok.grid || 'currentColor'
  const axisColor = tok.axis || 'currentColor'
  const surfaceColor = tok.surface || 'currentColor'
  const borderColor = tok.border || 'currentColor'
  const textColor = tok.text || 'currentColor'

  const currentBuckets = useMemo(() => aggregatePoints(timeSeries, granularity), [timeSeries, granularity])
  const prevBuckets = useMemo(() => aggregatePoints(prevTimeSeries, granularity), [prevTimeSeries, granularity])

  // Merge current + previous by index when comparing periods
  const chartData = useMemo(() => {
    const maxLen = showPrev
      ? Math.max(currentBuckets.length, prevBuckets.length)
      : currentBuckets.length

    return Array.from({ length: maxLen }, (_, i) => {
      const cur = currentBuckets[i]
      const prv = prevBuckets[i]
      return {
        date: cur?.date ?? '',
        current: (cur?.[metric] ?? 0) as number,
        ...(compareMetric !== 'none'
          ? { compare: (cur?.[compareMetric as MetricKey] ?? 0) as number }
          : {}),
        ...(showPrev ? { previous: (prv?.[metric] ?? 0) as number } : {}),
      }
    })
  }, [currentBuckets, prevBuckets, metric, compareMetric, showPrev])

  const prevRangeLabel = `${fmtLongDate(prevDateStart)} - ${fmtLongDate(prevDateEnd)}`

  return (
    <div className="av2-pane" style={{ marginBottom: 'var(--a-s4)' }}>
      {/* Chart controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Metric A */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-sm"
            style={{ background: 'var(--a-accent)' }}
          />
          <ToolbarSelect
            aria-label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </ToolbarSelect>
        </div>

        <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>vs</span>

        {/* Metric B */}
        <ToolbarSelect
          aria-label="Compare metric"
          value={compareMetric}
          onChange={(e) => setCompareMetric(e.target.value)}
        >
          <option value="none">None</option>
          {METRIC_OPTIONS.filter((opt) => opt.key !== metric).map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </ToolbarSelect>

        {/* Granularity */}
        <ToolbarSelect
          aria-label="Granularity"
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </ToolbarSelect>

        {/* Compare to previous period */}
        <div className="ml-auto flex items-center gap-2">
          <ToolbarCheck
            label="Compare to previous period:"
            checked={showPrev}
            onChange={(e) => setShowPrev(e.target.checked)}
          />
          <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>{prevRangeLabel}</span>
        </div>
      </div>

      {/* Area chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
          >
            <defs>
              <linearGradient id="aa-grad-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={currentColor} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="aa-grad-compare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={compareColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={compareColor} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="aa-grad-prev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={prevColor} stopOpacity={0.12} />
                <stop offset="95%" stopColor={prevColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: axisColor }}
              tickFormatter={fmtAxisDate}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: surfaceColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                fontSize: 12,
                color: textColor,
              }}
              labelFormatter={(label) => {
                try { return fmtLongDate(String(label)) } catch { return String(label) }
              }}
              formatter={(val: number, name: string) => [
                val.toLocaleString('en-US'),
                name,
              ]}
            />

            {/* Primary metric series */}
            <Area
              type="monotone"
              dataKey="current"
              name={METRIC_LABELS[metric]}
              stroke={currentColor}
              strokeWidth={2}
              fill="url(#aa-grad-current)"
              dot={{ r: 3, fill: currentColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: currentColor }}
              isAnimationActive={false}
            />

            {/* Compare metric (vs) */}
            {compareMetric !== 'none' && (
              <Area
                type="monotone"
                dataKey="compare"
                name={METRIC_LABELS[compareMetric as MetricKey]}
                stroke={compareColor}
                strokeWidth={2}
                fill="url(#aa-grad-compare)"
                dot={{ r: 3, fill: compareColor, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: compareColor }}
                isAnimationActive={false}
              />
            )}

            {/* Previous period overlay */}
            {showPrev && (
              <Area
                type="monotone"
                dataKey="previous"
                name={`${METRIC_LABELS[metric]} (prev.)`}
                stroke={prevColor}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                fill="url(#aa-grad-prev)"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
