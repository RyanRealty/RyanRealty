'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  OverviewTotals,
  OverviewTimeSeriesPoint,
} from '@/lib/data/crm/getOverviewReport'

// ── Props ─────────────────────────────────────────────────────────────────────

interface OverviewKpiStripProps {
  totals: OverviewTotals
  previousTotals: OverviewTotals
  timeSeries: OverviewTimeSeriesPoint[]
}

// ── Delta helper ──────────────────────────────────────────────────────────────

function computeDelta(
  current: number,
  previous: number,
): { pct: number; up: boolean } | null {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, id }: { data: number[]; id: string }) {
  const chartData = data.map((v) => ({ v }))
  const gradId = `overviewSparkGrad-${id}`
  return (
    <div className="mt-2 h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* .design-token-lint-ignore — recharts SVG attrs; hex required by recharts API */}
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#102742" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#102742" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="#102742"
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

interface KpiTileProps {
  id: string
  label: string
  value: number
  previousValue: number
  sparkData: number[]
}

function KpiTile({ id, label, value, previousValue, sparkData }: KpiTileProps) {
  const delta = computeDelta(value, previousValue)

  return (
    <Card className="min-w-36 shrink-0 p-4">
      {/* Label */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      {/* Large value */}
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {value.toLocaleString('en-US')}
      </p>

      {/* Delta vs previous period */}
      {delta !== null ? (
        <p
          className={cn(
            'mt-1 text-xs tabular-nums',
            delta.up ? 'text-success' : 'text-destructive',
          )}
        >
          {delta.up ? '↑' : '↓'}{' '}
          {delta.up
            ? `${delta.pct.toFixed(1)}%`
            : `(${delta.pct.toFixed(1)}%)`}{' '}
          <span className="text-muted-foreground">
            vs {previousValue.toLocaleString('en-US')}
          </span>
        </p>
      ) : previousValue === 0 && value > 0 ? (
        <p className="mt-1 text-xs text-success">
          ↑ new <span className="text-muted-foreground">vs 0</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          — <span>vs 0</span>
        </p>
      )}

      {/* Sparkline */}
      <Sparkline data={sparkData} id={id} />
    </Card>
  )
}

// ── Tile definitions (7 fixed metrics — no column picker on Overview) ─────────

type TileDef = {
  key: keyof OverviewTotals
  label: string
  tsKey: keyof OverviewTimeSeriesPoint
}

const TILE_DEFS: TileDef[] = [
  { key: 'newLeads',       label: 'New Leads',         tsKey: 'newLeads' },
  { key: 'calls',          label: 'Calls',              tsKey: 'calls' },
  { key: 'emails',         label: 'Emails',             tsKey: 'emails' },
  { key: 'texts',          label: 'Texts',              tsKey: 'texts' },
  { key: 'notes',          label: 'Notes',              tsKey: 'notes' },
  { key: 'tasksCompleted', label: 'Tasks Completed',    tsKey: 'tasksCompleted' },
  { key: 'appointments',   label: 'Appointments',       tsKey: 'appointments' },
]

// ── KPI Strip ─────────────────────────────────────────────────────────────────

export function OverviewKpiStrip({
  totals,
  previousTotals,
  timeSeries,
}: OverviewKpiStripProps) {
  return (
    <div className="no-scrollbar mb-8 flex gap-3 overflow-x-auto pb-2">
      {TILE_DEFS.map((def) => {
        const sparkData = timeSeries.map((p) => p[def.tsKey] as number)
        return (
          <KpiTile
            key={def.key}
            id={def.key}
            label={def.label}
            value={totals[def.key]}
            previousValue={previousTotals[def.key]}
            sparkData={sparkData}
          />
        )
      })}
    </div>
  )
}
