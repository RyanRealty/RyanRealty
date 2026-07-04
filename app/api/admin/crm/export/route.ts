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

/**
 * §15.4 full export ("Export all columns" checked): first/last name, every
 * email/phone/address, price, timeframe, lender, background, custom fields.
 */
const CRM_EXPORT_SELECT_ALL =
  'id,name,first_name,last_name,stage,source,assigned_broker,tags,emails,phones,addresses,price,timeframe,lender_name,background,custom,fub_created_at,last_activity_at'

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
  let stage = sp.get('stage') || undefined
  const tag = sp.get('tag') || undefined
  // §15: an active saved view exports its saved filter bag (same resolution
  // listCrmPeople applies: explicit URL params override the view's).
  const viewId = Number(sp.get('view'))
  let viewTags: string[] | undefined
  // §15: export the explicitly SELECTED people (ids=1,2,3) and/or all columns (all=1).
  const allColumns = sp.get('all') === '1'
  const ids = (sp.get('ids') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 10_000)

  // Broker scope: a restricted broker is clamped to their own book.
  // A superuser respects the explicit ?broker= param (or no clamp; 'all' = no clamp).
  const brokerScope = scopeBroker(access)
  const requestedBroker = sp.get('broker')
  const effectiveBroker = brokerScope ?? ((requestedBroker && requestedBroker !== 'all') ? requestedBroker : undefined)

  const sb = createServiceClient()

  if (Number.isInteger(viewId) && viewId > 0) {
    const { data: view } = await sb
      .from('crm_saved_views')
      .select('filter')
      .eq('id', viewId)
      .maybeSingle()
    const f = (view?.filter ?? {}) as { stage?: string; tagsAny?: string[] }
    if (!stage && f.stage) stage = f.stage
    if (!tag && f.tagsAny?.length) viewTags = f.tagsAny
  }

  type FullPersonRow = PersonRow & {
    first_name: string | null
    last_name: string | null
    addresses: Array<{ street?: string; city?: string; state?: string; code?: string }> | null
    price: number | null
    timeframe: string | null
    lender_name: string | null
    background: string | null
    custom: Record<string, unknown> | null
    last_activity_at: string | null
  }

  // Fetch ONE page of the filtered set. Rebuilt per page (a PostgREST builder is
  // single-use) so the export streams instead of materializing up to 50K wide
  // rows + the whole CSV string in memory at once (OOM audit finding).
  const cols = allColumns ? CRM_EXPORT_SELECT_ALL : CRM_EXPORT_SELECT
  function pageQuery(offset: number, limit: number) {
    let query = sb.from('crm_people').select(cols).eq('deleted', false)
    if (ids.length > 0) query = query.in('id', ids)
    if (stage) query = query.eq('stage', stage)
    if (tag) query = query.overlaps('tags', [tag])
    else if (viewTags?.length) query = query.overlaps('tags', viewTags)
    if (effectiveBroker) query = query.eq('assigned_broker', effectiveBroker)
    if (q) query = query.ilike('name', `%${q}%`)
    return query
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('fub_created_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)
  }

  const allValues = (items: Array<{ value?: string }> | null): string =>
    (items ?? []).map((i) => i?.value).filter(Boolean).join('; ')
  const fmtAddress = (a: { street?: string; city?: string; state?: string; code?: string }): string =>
    [a.street, a.city, a.state, a.code].filter(Boolean).join(', ')

  const headers = allColumns
    ? ['Name', 'First Name', 'Last Name', 'Emails', 'Phones', 'Addresses', 'Stage', 'Agent',
       'Tags', 'Source', 'Price', 'Timeframe', 'Lender', 'Background', 'Custom Fields',
       'Created', 'Last Activity']
    : HEADERS

  function formatRow(p: FullPersonRow): string {
    if (allColumns) {
      return csvRow([
        p.name ?? '', p.first_name ?? '', p.last_name ?? '',
        allValues(p.emails), allValues(p.phones),
        (p.addresses ?? []).map(fmtAddress).filter(Boolean).join('; '),
        p.stage, p.assigned_broker ?? '', (p.tags ?? []).join('; '), p.source ?? '',
        p.price != null ? String(p.price) : '', p.timeframe ?? '', p.lender_name ?? '',
        p.background ?? '',
        p.custom && Object.keys(p.custom).length > 0 ? JSON.stringify(p.custom) : '',
        p.fub_created_at ? p.fub_created_at.slice(0, 10) : '',
        p.last_activity_at ? p.last_activity_at.slice(0, 10) : '',
      ])
    }
    return csvRow([
      p.name ?? '', primaryContact(p.emails), primaryContact(p.phones), p.stage,
      p.assigned_broker ?? '', (p.tags ?? []).join('; '), p.source ?? '',
      p.fub_created_at ? p.fub_created_at.slice(0, 10) : '',
    ])
  }

  const PAGE = 1000
  const MAX_ROWS = 50_000 // safety ceiling; real book is ~18K
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(csvRow(headers)))
      for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
        const { data, error } = await pageQuery(offset, PAGE)
        if (error) {
          // Header + rows so far already flushed; surface the error as a trailing
          // CSV comment rather than a torn download with no signal.
          controller.enqueue(encoder.encode(`# export error after ${offset} rows: ${error.message}\r\n`))
          break
        }
        const rows = (data ?? []) as unknown as FullPersonRow[]
        if (rows.length === 0) break
        let block = ''
        for (const p of rows) block += formatRow(p)
        controller.enqueue(encoder.encode(block))
        if (rows.length < PAGE) break
      }
      controller.close()
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  const filename = `crm-contacts-${date}.csv`
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
