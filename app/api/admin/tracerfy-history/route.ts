/**
 * Admin tool: probe Tracerfy's history/queue endpoints to see if past instant
 * traces are recoverable without re-paying for them.
 *
 * GET /api/admin/tracerfy-history?probe=queues  — list all queues
 * GET /api/admin/tracerfy-history?probe=queue&id=123  — single queue detail
 * GET /api/admin/tracerfy-history?probe=traces  — undocumented; try common patterns
 *
 * Auth: Bearer $CRON_SECRET.
 *
 * Background: the original enrichment dropped persons[].full_name from each
 * Tracerfy response during synthesis. We're trying to recover those names
 * without re-charging the API (5 credits per lookup × 124 = $14.70).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.TRACERFY_API_KEY?.trim()
  const base = process.env.TRACERFY_API_BASE?.trim() ?? 'https://tracerfy.com/v1/api'
  if (!key) return NextResponse.json({ error: 'TRACERFY_API_KEY missing' }, { status: 500 })

  const url = new URL(request.url)
  const probe = url.searchParams.get('probe') ?? 'queues'
  const id = url.searchParams.get('id')
  const page = url.searchParams.get('page') ?? '1'

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  }

  try {
    if (probe === 'queues') {
      const r = await fetch(`${base}/queues/?page=${page}`, { headers, cache: 'no-store' })
      const text = await r.text()
      let json: unknown = null
      try { json = JSON.parse(text) } catch {}
      return NextResponse.json({
        endpoint: `${base}/queues/?page=${page}`,
        status: r.status,
        ok: r.ok,
        body: json ?? text.slice(0, 2000),
        headers_total: r.headers.get('x-total-count'),
        headers_link: r.headers.get('link'),
      })
    }
    if (probe === 'queue' && id) {
      const r = await fetch(`${base}/queue/${id}`, { headers, cache: 'no-store' })
      const text = await r.text()
      let json: unknown = null
      try { json = JSON.parse(text) } catch {}
      return NextResponse.json({
        endpoint: `${base}/queue/${id}`,
        status: r.status,
        ok: r.ok,
        body: json ?? text.slice(0, 2000),
      })
    }
    if (probe === 'traces') {
      // Try common patterns for instant-trace history that aren't in the public docs
      const candidates = [
        `${base}/trace/`,
        `${base}/traces/`,
        `${base}/trace/list/`,
        `${base}/trace/history/`,
        `${base}/my-traces/`,
        `${base}/instant-trace/`,
      ]
      const results: Array<{ url: string; status: number; body: unknown }> = []
      for (const c of candidates) {
        const r = await fetch(c, { headers, cache: 'no-store' })
        const text = await r.text()
        let json: unknown = null
        try { json = JSON.parse(text) } catch {}
        results.push({
          url: c,
          status: r.status,
          body: typeof json === 'object' ? json : text.slice(0, 200),
        })
      }
      return NextResponse.json({ probe: 'traces', candidates: results })
    }
    return NextResponse.json({ error: 'unknown probe', allowed: ['queues', 'queue', 'traces'] }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
