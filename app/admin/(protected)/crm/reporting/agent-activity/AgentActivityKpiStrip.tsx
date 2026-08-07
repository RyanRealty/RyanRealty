'use client'

/**
 * Agent Activity's figures for the period, plus the column picker.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Carried over verbatim: the ten metric definitions, COL_TO_TOTAL, COL_TO_TS
 * (including the two documented V1 series approximations), the delta maths, the
 * Calls → Call Logs auxiliary link, and toggleCol()'s ?cols contract — same
 * ordering rule (a re-checked column moves to the end), same "drop ?cols when
 * all ten are on", same four params, same router.push target.
 *
 * What changed is shell only: shadcn Cards in a sideways-scrolling strip became
 * typographic figures that wrap, the recharts sparkline became a plain polyline
 * off the same series (no client chart lib, no brand hex), and the popover of
 * checkboxes became a folded disclosure of v2 filter chips — the locked bar bans
 * a wall of pills on the page, not a picker behind a control.
 */
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FilterChip, ReportNumbers, type ReportNumberItem } from '@/components/admin/v2'
import {
  ALL_COL_KEYS,
  COL_LABELS,
  type ColKey,
} from '@/lib/crm/reporting-constants'
import type {
  AgentActivityTotals,
  TimeSeriesPoint,
} from '@/lib/data/crm/getAgentActivityReport'

// ── Props ──────────────────────────────────────────────────────────────────────

interface AgentActivityKpiStripProps {
  totals: AgentActivityTotals
  previousTotals: AgentActivityTotals
  timeSeries: TimeSeriesPoint[]
  visibleCols: ColKey[]
  currentBroker: string
  currentDate: string
  currentView: string
}

// ── Field mappings ─────────────────────────────────────────────────────────────

const COL_TO_TOTAL: Record<ColKey, keyof AgentActivityTotals> = {
  new_leads: 'newLeads',
  initially_assigned: 'initiallyAssignedLeads',
  currently_assigned: 'currentlyAssignedLeads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

const COL_TO_TS: Record<ColKey, keyof TimeSeriesPoint> = {
  new_leads: 'newLeads',
  initially_assigned: 'newLeads',   // V1 approximation: same series as newLeads
  currently_assigned: 'newLeads',   // V1 approximation: same series
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

// ── Delta helper ───────────────────────────────────────────────────────────────

function computeDelta(
  current: number,
  previous: number,
): { pct: number; up: boolean } | null {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

function deltaLine(value: number, previousValue: number): ReportNumberItem['delta'] {
  const delta = computeDelta(value, previousValue)
  if (delta !== null) {
    return {
      direction: delta.up ? 'up' : 'down',
      text: `${delta.up ? '↑' : '↓'} ${
        delta.up ? `${delta.pct.toFixed(1)}%` : `(${delta.pct.toFixed(1)}%)`
      } vs ${previousValue.toLocaleString('en-US')}`,
    }
  }
  if (previousValue === 0 && value > 0) return { direction: 'up', text: '↑ new vs 0' }
  return { direction: 'flat', text: '— vs 0' }
}

// ── Tile definitions ──────────────────────────────────────────────────────────

const TILE_DEFS: Array<{
  key: ColKey
  label: string
  auxiliaryHref?: string
  auxiliaryLabel?: string
}> = [
  { key: 'new_leads', label: 'New Leads' },
  { key: 'initially_assigned', label: 'Initially Assigned Leads' },
  { key: 'currently_assigned', label: 'Currently Assigned Leads' },
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
  { key: 'appts_set', label: 'Appointments Set' },
  { key: 'appointments', label: 'Appointments' },
]

// ── Strip ─────────────────────────────────────────────────────────────────────

export function AgentActivityKpiStrip({
  totals,
  previousTotals,
  timeSeries,
  visibleCols,
  currentBroker,
  currentDate,
  currentView,
}: AgentActivityKpiStripProps) {
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
    params.set('view', currentView)
    if (next.length === ALL_COL_KEYS.length) {
      params.delete('cols')
    } else {
      params.set('cols', next.join(','))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const items: ReportNumberItem[] = TILE_DEFS.filter((def) =>
    visibleCols.includes(def.key),
  ).map((def) => {
    const totalField = COL_TO_TOTAL[def.key]
    const tsField = COL_TO_TS[def.key]
    return {
      key: def.key,
      label: def.label,
      value: (totals[totalField] as number).toLocaleString('en-US'),
      delta: deltaLine(totals[totalField] as number, previousTotals[totalField] as number),
      spark: timeSeries.map((p) => p[tsField] as number),
      aux:
        def.auxiliaryHref && def.auxiliaryLabel
          ? { href: def.auxiliaryHref, label: def.auxiliaryLabel }
          : undefined,
    }
  })

  return (
    <>
      <ReportNumbers items={items} />

      <details className="av2-rcols">
        <summary>
          Columns — {visibleCols.length} of {ALL_COL_KEYS.length} shown
        </summary>
        <div className="av2-rcols__body">
          {ALL_COL_KEYS.map((key) => {
            const on = visibleCols.includes(key)
            return (
              <FilterChip
                key={key}
                pressed={on}
                onClick={() => toggleCol(key, !on)}
              >
                {COL_LABELS[key]}
              </FilterChip>
            )
          })}
        </div>
      </details>
    </>
  )
}
