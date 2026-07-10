/**
 * /api/cron/crm-geo-resolve — keep every contact's geo columns filled from the
 * signals we already hold, so nobody goes geo-invisible again.
 *
 * The 2026-07-10 backfill closed an 8,246-contact gap (contacts with no
 * neighborhood_slug and no subdivision were invisible to community smart lists
 * and neighborhood default subscriptions). This nightly run keeps the gap
 * closed for NEW contacts: all resolution logic lives server-side in ONE place
 * — the crm_geo_backfill_candidates() RPC (migration 20260710190000) — shared
 * with scripts/crm-geo-backfill.mjs and the crm-e2e-verify coverage check, so
 * the three can never drift. The RPC is fill-only: it never returns a value
 * for a column the contact already has.
 *
 * This route is G1-exempt (app/api/** skips the DAL-boundary gate); the writes
 * are targeted per-row UPDATEs of the 4 geo columns only.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (isValidCronAuth).
 * Schedule: vercel.json — daily at 09:10 UTC (01:10 Pacific, quiet hours).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidCronAuth } from '@/lib/auth/cron-auth'
import registry from '@/data/resort-communities.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Candidate = {
  person_id: number
  fill_neighborhood_slug: string | null
  fill_subdivision: string | null
  fill_source: string
}

const RESORT = new Map(registry.communities.map((c) => [c.slug, c.is_resort === true]))
const PAGE = 1000

export async function GET(request: Request) {
  if (!isValidCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET?.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const sb = createServiceClient()

  const candidates: Candidate[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .rpc('crm_geo_backfill_candidates')
      .range(from, from + PAGE - 1)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    candidates.push(...((data ?? []) as Candidate[]))
    if (!data || data.length < PAGE) break
  }

  let written = 0
  const bySource: Record<string, number> = {}
  const errors: string[] = []
  const CONC = 20
  for (let i = 0; i < candidates.length; i += CONC) {
    await Promise.all(
      candidates.slice(i, i + CONC).map(async (c) => {
        const patch: Record<string, unknown> = {}
        if (c.fill_neighborhood_slug) {
          patch.neighborhood_slug = c.fill_neighborhood_slug
          patch.neighborhood_source = c.fill_source
          patch.is_resort = RESORT.get(c.fill_neighborhood_slug) === true
        }
        if (c.fill_subdivision) patch.subdivision = c.fill_subdivision
        const { error } = await sb.from('crm_people').update(patch).eq('id', c.person_id)
        if (error) {
          if (errors.length < 5) errors.push(`id=${c.person_id}: ${error.message}`)
          return
        }
        written += 1
        bySource[c.fill_source] = (bySource[c.fill_source] ?? 0) + 1
      }),
    )
  }

  return NextResponse.json({
    ok: errors.length === 0,
    candidates: candidates.length,
    written,
    by_source: bySource,
    errors,
    duration_ms: Date.now() - startMs,
  })
}
