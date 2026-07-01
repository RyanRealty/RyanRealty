import { type NextRequest, NextResponse } from 'next/server'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAgentActivityReport,
  type AgentActivityRow,
} from '@/lib/data/crm/getAgentActivityReport'
import {
  ALL_COL_KEYS,
  COL_LABELS,
  parseColsParam,
  type ColKey,
} from '@/lib/crm/reporting-constants'

const COL_TO_ROW: Record<ColKey, keyof AgentActivityRow> = {
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

function escapeCsv(val: string | number): string {
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  // Auth check
  const access = await getCrmAccess()
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const datePreset =
    (sp.get('date') ?? 'this_month') as
      | 'today'
      | 'this_week'
      | 'this_month'
      | 'this_year'
      | 'custom'
  const brokerParam = sp.get('broker')
  const rawCols = sp.get('cols') ?? undefined

  // Broker scope: superusers can filter; restricted brokers see only themselves
  const isSuperuser = access.role === 'superuser'
  let brokerSlug: string | null = null
  if (isSuperuser) {
    brokerSlug = brokerParam && brokerParam !== 'everyone' ? brokerParam : null
  } else {
    brokerSlug = scopeBroker(access)
  }

  const visibleCols = parseColsParam(rawCols)

  const report = await getAgentActivityReport({ brokerSlug, datePreset }).catch(() => null)
  if (!report) {
    return NextResponse.json({ error: 'Report unavailable' }, { status: 500 })
  }

  // Build CSV
  const headerCols: ColKey[] = ALL_COL_KEYS.filter((k) => visibleCols.includes(k))
  const headerRow = ['Name', ...headerCols.map((k) => COL_LABELS[k])].map(escapeCsv).join(',')

  const dataRows = report.rows.map((row) => {
    const cells = [row.brokerName, ...headerCols.map((k) => row[COL_TO_ROW[k]] as number)]
    return cells.map(escapeCsv).join(',')
  })

  const csv = [headerRow, ...dataRows].join('\r\n')

  const filename = `agent-activity-${datePreset}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
