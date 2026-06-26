/**
 * GET /api/admin/crm/export
 *
 * Downloads a CSV of the caller's current filtered contact set.
 * Respects q / stage / broker / tag query params — the SAME filter bag and
 * query approach listCrmPeople uses — so the export always matches the list.
 *
 * Auth: requires a valid admin session (getCrmAccess). A restricted broker's
 * export is scoped to their own book via scopeBroker.
 */

import { NextRequest } from 'next/server'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { createServiceClient } from '@/lib/supabase/service'

const CRM_EXPORT_SELECT =
  'id,name,stage,source,assigned_broker,tags,emails,phones,fub_created_at'

/** Quote a CSV cell value: wrap in double quotes and escape inner quotes. */
function csvCell(v: string | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',') + '\r\n'
}

const HEADERS = ['Name', 'Email', 'Phone', 'Stage', 'Agent', 'Tags', 'Source', 'Created']

type PersonRow = {
  id: number
  name: string | null
  stage: string
  source: string | null
  assigned_broker: string | null
  tags: string[]
  emails: Array<{ value?: string; isPrimary?: boolean | number }>
  phones: Array<{ value?: string; isPrimary?: boolean | number }>
  fub_created_at: string | null
}

function primaryContact(
  items: Array<{ value?: string; isPrimary?: boolean | number }> | null,
): string {
  if (!items?.length) return ''
  const primary = items.find((i) => i.isPrimary)
  return (primary ?? items[0])?.value ?? ''
}

export async function GET(req: NextRequest) {
  const access = await getCrmAccess()
  if (!access) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() || undefined
  const stage = sp.get('stage') || undefined
  const tag = sp.get('tag') || undefined

  // Broker scope: a restricted broker is clamped to their own book.
  // A superuser respects the explicit ?broker= param (or no clamp).
  const brokerScope = scopeBroker(access)
  const effectiveBroker = brokerScope ?? (sp.get('broker') || undefined)

  const sb = createServiceClient()

  // Build the query the same way listCrmPeople does (proven working, filter-for-filter).
  let query = sb
    .from('crm_people')
    .select(CRM_EXPORT_SELECT)
    .eq('deleted', false)

  if (stage) query = query.eq('stage', stage)
  if (tag) query = query.overlaps('tags', [tag])
  if (effectiveBroker) query = query.eq('assigned_broker', effectiveBroker)

  // q: name ilike (matches listCrmPeople's non-email / non-phone branch)
  if (q) query = query.ilike('name', `%${q}%`)

  // Safety ceiling — real book is ~18K; 50K covers any realistic export.
  query = query
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('fub_created_at', { ascending: false, nullsFirst: false })
    .range(0, 49_999)

  const { data, error } = await query

  if (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 })
  }

  const rows = (data ?? []) as unknown as PersonRow[]

  const lines: string[] = [csvRow(HEADERS)]
  for (const p of rows) {
    lines.push(
      csvRow([
        p.name ?? '',
        primaryContact(p.emails),
        primaryContact(p.phones),
        p.stage,
        p.assigned_broker ?? '',
        (p.tags ?? []).join('; '),
        p.source ?? '',
        p.fub_created_at ? p.fub_created_at.slice(0, 10) : '',
      ]),
    )
  }

  const csv = lines.join('')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `crm-contacts-${date}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
