'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { METRIC_OPTIONS, METRIC_LABELS, type MetricKey } from '@/lib/crm/reporting-constants'
import type { TimeSeriesPoint } from '@/lib/data/crm/getAgentActivityReport'

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
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function fmtLongDate(iso: string): string {
  // iso may be a full ISO timestamp (from prevDateStart/prevDateEnd, e.g. "2025-06-30T23:59:59.999Z")
  // OR a date-only string (from chart tooltip labels, e.g. "2025-06-15").
  // Use new Date(iso) directly — appending 'T00:00:00Z' to a string that already
  // has a time component produces an invalid date (the "Invalid Date" bug).
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
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
    <Card className="mb-4">
      <div className="p-4">
        {/* Chart controls row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Metric A */}
          <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-primary" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">vs</span>

          {/* Metric B */}
          <Select value={compareMetric} onValueChange={setCompareMetric}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                None
              </SelectItem>
              {METRIC_OPTIONS.filter((opt) => opt.key !== metric).map((opt) => (
                <SelectItem key={opt.key} value={opt.key} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Granularity */}
          <Select
            value={granularity}
            onValueChange={(v) => setGranularity(v as Granularity)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily" className="text-xs">Daily</SelectItem>
              <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
              <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
            </SelectContent>
          </Select>

          {/* Compare to previous period */}
          <div className="ml-auto flex items-center gap-2">
            <Checkbox
              id="cmp-prev"
              checked={showPrev}
              onCheckedChange={(v) => setShowPrev(!!v)}
            />
            <Label
              htmlFor="cmp-prev"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              Compare to previous period:
            </Label>
            <span className="text-xs text-muted-foreground">{prevRangeLabel}</span>
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
                  <stop offset="5%" stopColor="#102742" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#102742" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="aa-grad-compare" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5b6473" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#5b6473" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="aa-grad-prev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a7b0bf" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#a7b0bf" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={fmtAxisDate}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
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
                stroke="#102742"
                strokeWidth={2}
                fill="url(#aa-grad-current)"
                dot={{ r: 3, fill: '#102742', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#102742' }}
                isAnimationActive={false}
              />

              {/* Compare metric (vs) */}
              {compareMetric !== 'none' && (
                <Area
                  type="monotone"
                  dataKey="compare"
                  name={METRIC_LABELS[compareMetric as MetricKey]}
                  stroke="#5b6473"
                  strokeWidth={2}
                  fill="url(#aa-grad-compare)"
                  dot={{ r: 3, fill: '#5b6473', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#5b6473' }}
                  isAnimationActive={false}
                />
              )}

              {/* Previous period overlay */}
              {showPrev && (
                <Area
                  type="monotone"
                  dataKey="previous"
                  name={`${METRIC_LABELS[metric]} (prev.)`}
                  stroke="#a7b0bf"
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
    </Card>
  )
}
