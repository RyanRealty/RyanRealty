// @no-parity — internal admin surface
/**
 * Overview's seven top-line figures.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * The seven metrics, their order, the delta computation, and the sparkline series
 * are carried over verbatim — only the shell changed: shadcn Cards in a
 * sideways-scrolling strip became typographic figures that wrap (ADMIN_UI: "data
 * is typographic", "KPIs never open a screen", and a strip that scrolls sideways
 * by default is a failed design). The recharts sparkline became a plain polyline
 * drawn from the same series, so the file no longer needs a client boundary or a
 * hard-coded brand hex.
 */
import { ReportNumbers, type ReportNumberItem } from '@/components/admin/v2'
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

// ── Delta helper (verbatim from the legacy strip) ─────────────────────────────

function computeDelta(
  current: number,
  previous: number,
): { pct: number; up: boolean } | null {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), up: pct >= 0 }
}

/** The same three delta cases the legacy tile rendered, as text + direction. */
export function deltaLine(
  value: number,
  previousValue: number,
): ReportNumberItem['delta'] {
  const delta = computeDelta(value, previousValue)
  if (delta !== null) {
    return {
      direction: delta.up ? 'up' : 'down',
      text: `${delta.up ? '↑' : '↓'} ${
        delta.up ? `${delta.pct.toFixed(1)}%` : `(${delta.pct.toFixed(1)}%)`
      } vs ${previousValue.toLocaleString('en-US')}`,
    }
  }
  if (previousValue === 0 && value > 0) {
    return { direction: 'up', text: '↑ new vs 0' }
  }
  return { direction: 'flat', text: '— vs 0' }
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

// ── Strip ─────────────────────────────────────────────────────────────────────

export function OverviewKpiStrip({
  totals,
  previousTotals,
  timeSeries,
}: OverviewKpiStripProps) {
  const items: ReportNumberItem[] = TILE_DEFS.map((def) => ({
    key: String(def.key),
    label: def.label,
    value: totals[def.key].toLocaleString('en-US'),
    delta: deltaLine(totals[def.key], previousTotals[def.key]),
    spark: timeSeries.map((p) => p[def.tsKey] as number),
  }))

  return <ReportNumbers items={items} />
}
