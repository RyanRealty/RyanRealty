'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { COL_LABELS, ALL_COL_KEYS, type ColKey } from '@/lib/crm/reporting-constants'
import type { LeadSourcesTotals, TimeSeriesPoint } from '@/lib/data/crm/getLeadSourcesReport'

// ── Lead Sources column set (subset of ALL_COL_KEYS) ─────────────────────────
// No 'initially_assigned', 'currently_assigned', or 'appts_set' — Lead Sources
// report uses the 7-column layout shown in the FUB reference (Screen 5).

export const LS_COL_KEYS: readonly ColKey[] = [
  'new_leads',
  'calls',
  'emails',
  'texts',
  'notes',
  'tasks_completed',
  'appointments',
] as const

const COL_TO_TOTAL: Record<ColKey, keyof LeadSourcesTotals> = {
  new_leads: 'newLeads',
  initially_assigned: 'newLeads',   // not shown; mapping is still required for ColKey union
  currently_assigned: 'newLeads',   // same
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointments',        // not shown; map to appointments as proxy
  appointments: 'appointments',
}

const COL_TO_TS: Record<ColKey, keyof TimeSeriesPoint> = {
  new_leads: 'newLeads',
  initially_assigned: 'newLeads',
  currently_assigned: 'newLeads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface LeadSourcesKpiStripProps {
  totals: LeadSourcesTotals
  previousTotals: LeadSourcesTotals
  timeSeries: TimeSeriesPoint[]
  visibleCols: ColKey[]
  currentBroker: string
  currentDate: string
}

// ── Delta helper ───────────────────────────────────────────────────────────────

function computeDelta(current: number, previous: number): { pct: number; up: boolean } | null {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

// ── Sparkline ──────────────────────────────────────────────────────────────────
// .design-token-lint-ignore — recharts SVG attrs; hex required by recharts API

function Sparkline({ data, id }: { data: number[]; id: string }) {
  const chartData = data.map((v) => ({ v }))
  const gradId = `lsSparkGrad-${id}`
  return (
    <div className="mt-2 h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
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

// ── KPI Tile ───────────────────────────────────────────────────────────────────

interface KpiTileProps {
  id: string
  label: string
  value: number
  previousValue: number
  sparkData: number[]
  auxiliaryHref?: string
  auxiliaryLabel?: string
}

function KpiTile({
  id,
  label,
  value,
  previousValue,
  sparkData,
  auxiliaryHref,
  auxiliaryLabel,
}: KpiTileProps) {
  const delta = computeDelta(value, previousValue)

  return (
    <Card className="min-w-36 shrink-0 p-4">
      {/* Label row */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {auxiliaryHref && auxiliaryLabel ? (
          <Link href={auxiliaryHref} className="shrink-0 text-xs text-primary hover:underline">
            {auxiliaryLabel}
          </Link>
        ) : null}
      </div>

      {/* Large value */}
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {value.toLocaleString('en-US')}
      </p>

      {/* Delta vs previous period */}
      {delta !== null ? (
        <p className={cn('mt-1 text-xs tabular-nums', delta.up ? 'text-success' : 'text-destructive')}>
          {delta.up ? '↑' : '↓'}{' '}
          {delta.up ? `${delta.pct.toFixed(1)}%` : `(${delta.pct.toFixed(1)}%)`}{' '}
          <span className="text-muted-foreground">vs {previousValue.toLocaleString('en-US')}</span>
        </p>
      ) : previousValue === 0 && value > 0 ? (
        <p className="mt-1 text-xs text-success">
          ↑ new <span className="text-muted-foreground">vs 0</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">— <span>vs 0</span></p>
      )}

      {/* Sparkline */}
      <Sparkline data={sparkData} id={id} />
    </Card>
  )
}

// ── Column Picker Tile ────────────────────────────────────────────────────────

interface ColumnPickerProps {
  visibleCols: ColKey[]
  currentBroker: string
  currentDate: string
}

function ColumnPickerTile({ visibleCols, currentBroker, currentDate }: ColumnPickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function toggleCol(key: ColKey, checked: boolean) {
    const next: ColKey[] = checked
      ? ([...visibleCols.filter((c) => c !== key), key] as ColKey[])
      : visibleCols.filter((c) => c !== key)

    const params = new URLSearchParams(searchParams.toString())
    params.set('broker', currentBroker)
    params.set('date', currentDate)
    if (next.length === LS_COL_KEYS.length) {
      params.delete('cols')
    } else {
      params.set('cols', next.join(','))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          className="flex min-w-36 shrink-0 cursor-pointer items-center justify-center border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Add Columns
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <p className="mb-2 text-xs font-semibold text-foreground">Show / hide columns</p>
        <div className="flex flex-col gap-2">
          {LS_COL_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`ls-col-${key}`}
                checked={visibleCols.includes(key)}
                onCheckedChange={(v) => toggleCol(key, !!v)}
              />
              <Label htmlFor={`ls-col-${key}`} className="cursor-pointer text-xs text-foreground">
                {COL_LABELS[key]}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Tile definitions ──────────────────────────────────────────────────────────

const TILE_DEFS: Array<{
  key: ColKey
  label: string
  auxiliaryHref?: string
  auxiliaryLabel?: string
}> = [
  { key: 'new_leads', label: 'New Leads' },
  {
    key: 'calls',
    label: 'Calls',
    auxiliaryHref: '/admin/crm/reporting/calls',
    auxiliaryLabel: 'Call Logs',
  },
  { key: 'emails', label: 'Emails' },
  { key: 'texts', label: 'Texts' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks_completed', label: 'Tasks Completed' },
  { key: 'appointments', label: 'Appointments' },
]

// ── KPI Strip ─────────────────────────────────────────────────────────────────

export function LeadSourcesKpiStrip({
  totals,
  previousTotals,
  timeSeries,
  visibleCols,
  currentBroker,
  currentDate,
}: LeadSourcesKpiStripProps) {
  return (
    <div className="no-scrollbar mb-4 flex gap-3 overflow-x-auto pb-2">
      {TILE_DEFS.filter((def) => visibleCols.includes(def.key)).map((def) => {
        const totalField = COL_TO_TOTAL[def.key]
        const tsField = COL_TO_TS[def.key]
        const sparkData = timeSeries.map((p) => p[tsField] as number)
        return (
          <KpiTile
            key={def.key}
            id={def.key}
            label={def.label}
            value={totals[totalField] as number}
            previousValue={previousTotals[totalField] as number}
            sparkData={sparkData}
            auxiliaryHref={def.auxiliaryHref}
            auxiliaryLabel={def.auxiliaryLabel}
          />
        )
      })}

      <ColumnPickerTile
        visibleCols={visibleCols}
        currentBroker={currentBroker}
        currentDate={currentDate}
      />
    </div>
  )
}
