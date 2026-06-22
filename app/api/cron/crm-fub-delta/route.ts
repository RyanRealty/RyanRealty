/**
 * CRM ↔ FUB delta sync — the parallel-run safety net (blueprint §7).
 *
 * Every 30 minutes: pull every FUB person whose `updated` timestamp moved since
 * the last cursor and re-mirror them into crm_people + crm_contact_points.
 * Catches mutations made directly in the FUB UI (Matt working a lead on his
 * phone) and anything the real-time dual-write hooks missed.
 *
 * Cursor lives in crm_imports (source='fub-delta', latest row), seeded from the
 * initial full import's cursor.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { upsertCrmMirrorPerson } from '@/lib/crm/mirror'
import { getFubApiKey } from '@/lib/crm/fub-env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const FUB_BASE = 'https://api.followupboss.com/v1'
const PAGE_LIMIT = 100
const MAX_PAGES_PER_RUN = 30 // 3,000 people per run is far beyond any real 30-min delta

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startMs = Date.now()
  const apiKey = getFubApiKey()?.trim()
  if (!apiKey) return NextResponse.json({ ok: false, error: 'FOLLOWUPBOSS_API_KEY missing' }, { status: 500 })

  const headers: HeadersInit = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
    'X-System': 'RyanRealtyPlatform',
    Accept: 'application/json',
  }
  const sb = createServiceClient()

  // Resolve cursor: latest delta row, else the full import's cursor, else 48h back.
  let since: string | null = null
  const { data: cursorRows } = await sb
    .from('crm_imports')
    .select('source,cursor')
    .in('source', ['fub-delta', 'fub-full'])
    .order('id', { ascending: false })
    .limit(5)
  for (const row of cursorRows ?? []) {
    const c = (row.cursor ?? {}) as { people_synced_at?: string }
    if (c.people_synced_at) { since = c.people_synced_at; break }
  }
  if (!since) since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const runStartedAt = new Date().toISOString()
  let synced = 0
  let pages = 0
  let next: string | null = null
  let error: string | null = null

  try {
    for (; pages < MAX_PAGES_PER_RUN; pages++) {
      const params = new URLSearchParams({
        fields: 'allFields',
        limit: String(PAGE_LIMIT),
        sort: 'updated',
        updatedAfter: since,
      })
      if (next) params.set('next', next)
      const res = await fetch(`${FUB_BASE}/people?${params}`, { headers, next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`FUB people delta HTTP ${res.status}`)
      const data = (await res.json()) as {
        people?: Array<Record<string, unknown> & { id: number }>
        _metadata?: { next?: string }
      }
      const people = data.people ?? []
      if (!people.length) break
      for (const p of people) {
        await upsertCrmMirrorPerson(p)
        synced++
      }
      next = data._metadata?.next ?? null
      if (!next) break
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  await sb.from('crm_imports').insert({
    source: 'fub-delta',
    started_at: runStartedAt,
    finished_at: new Date().toISOString(),
    status: error ? 'failed' : 'done',
    counts: { people: synced, pages },
    // Only advance the cursor on clean runs so a failed run retries its window.
    cursor: error ? { people_synced_at: since } : { people_synced_at: runStartedAt },
    notes: error,
  })

  return NextResponse.json({
    ok: !error,
    synced,
    pages,
    since,
    error: error ?? undefined,
    duration_ms: Date.now() - startMs,
  }, { status: error ? 500 : 200 })
}
