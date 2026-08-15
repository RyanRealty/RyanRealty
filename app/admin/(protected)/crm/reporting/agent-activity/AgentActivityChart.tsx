'use client'

import { useMemo, useState } from 'react'
import { AChart, ToolbarCheck, ToolbarSelect } from '@/components/admin/v2'
import { METRIC_LABELS, METRIC_OPTIONS, type MetricKey } from '@/lib/crm/reporting-constants'
import type { TimeSeriesPoint } from '@/lib/data/crm/getAgentActivityReport'
import { formatDate } from '@/lib/format/date'

type Granularity = 'daily' | 'weekly' | 'monthly'

interface Props {
  timeSeries: TimeSeriesPoint[]
  prevTimeSeries: TimeSeriesPoint[]
  prevDateStart: string
  prevDateEnd: string
}

function fmtAxisDate(iso: string): string {
  return formatDate(iso + 'T00:00:00Z', { month: 'short', day: 'numeric' })
}

function fmtLongDate(iso: string): string {
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
      const dow = d.getUTCDay()
      const monday = new Date(d)
      monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
      key = monday.toISOString().slice(0, 10)
    } else {
      key = p.date.slice(0, 7) + '-01'
    }

    if (!buckets.has(key)) {
      buckets.set(key, {
        date: key,
        newLeads: 0,
        calls: 0,
        emails: 0,
        texts: 0,
        notes: 0,
        tasksCompleted: 0,
        appointmentsSet: 0,
        appointments: 0,
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

export function AgentActivityChart({ timeSeries, prevTimeSeries, prevDateStart, prevDateEnd }: Props) {
  const [metric, setMetric] = useState<MetricKey>('newLeads')
  const [compareMetric, setCompareMetric] = useState<string>('none')
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [showPrev, setShowPrev] = useState(false)

  const currentBuckets = useMemo(() => aggregatePoints(timeSeries, granularity), [timeSeries, granularity])
  const prevBuckets = useMemo(() => aggregatePoints(prevTimeSeries, granularity), [prevTimeSeries, granularity])

  const chartData = useMemo(() => {
    const maxLen = showPrev
      ? Math.max(currentBuckets.length, prevBuckets.length)
      : currentBuckets.length

    return Array.from({ length: maxLen }, (_, i) => {
      const cur = currentBuckets[i]
      const prv = prevBuckets[i]
      return {
        date: cur?.date ?? prv?.date ?? '',
        current: (cur?.[metric] ?? 0) as number,
        compare: compareMetric !== 'none' ? ((cur?.[compareMetric as MetricKey] ?? 0) as number) : null,
        previous: showPrev ? ((prv?.[metric] ?? 0) as number) : null,
      }
    })
  }, [currentBuckets, prevBuckets, metric, compareMetric, showPrev])

  const series = useMemo(() => {
    const rows = chartData.filter((d) => d.date)
    const current = {
      name: METRIC_LABELS[metric],
      points: rows.map((d) => ({
        value: d.current,
        tick: fmtAxisDate(d.date),
        label: d.current.toLocaleString('en-US'),
      })),
    }
    const extra: { name: string; points: { value: number; tick: string; label: string }[] }[] = []
    if (compareMetric !== 'none') {
      extra.push({
        name: METRIC_LABELS[compareMetric as MetricKey],
        points: rows.map((d) => ({
          value: d.compare ?? 0,
          tick: fmtAxisDate(d.date),
          label: (d.compare ?? 0).toLocaleString('en-US'),
        })),
      })
    }
    if (showPrev) {
      extra.push({
        name: `${METRIC_LABELS[metric]} (prev.)`,
        points: rows.map((d) => ({
          value: d.previous ?? 0,
          tick: fmtAxisDate(d.date),
          label: (d.previous ?? 0).toLocaleString('en-US'),
        })),
      })
    }
    return [current, ...extra]
  }, [chartData, metric, compareMetric, showPrev])

  const prevRangeLabel = `${fmtLongDate(prevDateStart)} - ${fmtLongDate(prevDateEnd)}`

  return (
    <div className="av2-pane" style={{ marginBottom: 'var(--a-s4)' }}>
      <div className="flex flex-wrap items-center gap-3">
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

        <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          vs
        </span>

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

        <ToolbarSelect
          aria-label="Granularity"
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </ToolbarSelect>

        <div className="ml-auto flex items-center gap-2">
          <ToolbarCheck
            label="Compare to previous period:"
            checked={showPrev}
            onChange={(e) => setShowPrev(e.target.checked)}
          />
          <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>
            {prevRangeLabel}
          </span>
        </div>
      </div>

      <AChart
        id="agent-activity"
        caption={`${METRIC_LABELS[metric]} over the selected period`}
        kind="line"
        series={series}
        emptyReason="No activity in this range."
      />
    </div>
  )
}
