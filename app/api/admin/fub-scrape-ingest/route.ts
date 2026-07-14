/**
 * TEMPORARY endpoint (2026-07-14) — bridge for recovering the FUB-imported text
 * bodies that exceed FUB's 50-per-contact export cap. The FUB web UI shows the
 * full thread; a browser-side scraper captures each message with its exact
 * <time datetime> (UTC) + body, then POSTs the thread here. This endpoint fills
 * ONLY the still-redacted fub-import sms rows (source='fub-import',
 * payload.contentHidden=true) matched by (person fub id + exact ts). It cannot
 * touch any other data. Token-gated; REMOVE after the 4 heavy threads are done.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const INGEST_TOKEN = 'fub-scrape-2026-07-14-temp-a7f3k9q2'
const ALLOW_ORIGIN = 'https://ryan-realty.followupboss.com'

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', ALLOW_ORIGIN)
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'content-type, x-ingest-token')
  return res
}

export function OPTIONS(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }))
}

export async function POST(req: Request): Promise<NextResponse> {
  if (req.headers.get('x-ingest-token') !== INGEST_TOKEN) {
    return withCors(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
  }
  const body = (await req.json().catch(() => null)) as { fub?: number; msgs?: Array<{ dt: string; dir: string; body: string }> } | null
  const fub = Number(body?.fub)
  const msgs = Array.isArray(body?.msgs) ? body!.msgs : []
  if (!fub || msgs.length === 0) return withCors(NextResponse.json({ error: 'bad payload' }, { status: 400 }))

  const sb = createServiceClient()
  const { data: people } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fub).limit(1)
  const personId = people?.[0]?.id as number | undefined
  if (!personId) return withCors(NextResponse.json({ error: 'person not found' }, { status: 404 }))

  const { data: rows } = await sb
    .from('crm_timeline')
    .select('id, kind, ts, payload')
    .eq('person_id', personId)
    .eq('source', 'fub-import')
    .in('kind', ['sms_in', 'sms_out'])
  const hidden = (rows ?? []).filter((r) => (r.payload as { contentHidden?: unknown })?.contentHidden === true)

  const used = new Set<number>()
  let filled = 0
  for (const m of msgs) {
    if (!m.body) continue
    const t = new Date(m.dt).getTime()
    // exact ts + direction first, then exact ts any direction
    let cand = hidden.find((r) => !used.has(r.id) && new Date(r.ts).getTime() === t && (r.kind === 'sms_in' ? 'in' : 'out') === m.dir)
    if (!cand) cand = hidden.find((r) => !used.has(r.id) && new Date(r.ts).getTime() === t)
    if (!cand) continue
    used.add(cand.id)
    const payload = { ...((cand.payload as Record<string, unknown>) ?? {}) }
    delete payload.contentHidden
    payload.contentRecoveredFromFubScrape = true
    const { error } = await sb.from('crm_timeline').update({ body: m.body, payload }).eq('id', cand.id)
    if (!error) filled++
  }

  return withCors(NextResponse.json({ ok: true, personId, hidden: hidden.length, provided: msgs.length, filled }))
}
