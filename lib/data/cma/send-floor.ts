/**
 * The 80% line, read for one CMA (Matt 2026-09-30). The rule lives in
 * lib/cma/send-floor.ts; this reads what it needs: the CMA's origin and
 * recommended price, and the expired listing that points at it.
 *
 * An expired listing's own row is the last list price of record (the same
 * source getCmaProspectAsk reads first). build_summary.subject.last_list_price
 * is the fallback, because most live expired rows never stamped it.
 *
 * Fails closed: a read that errors holds the CMA. Every send path that calls
 * this would rather stop than send on a guess.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { classifyCmaOrigin } from '@/lib/cma/origin'
import { theirPriceFromBuildSummary } from '@/lib/cma/queue-view'
import { expiredSendFloor, type ExpiredSendFloor } from '@/lib/cma/send-floor'

function positive(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) && n > 0 ? n : null
}

function unreadable(what: string): ExpiredSendFloor {
  return {
    held: true,
    ratio: null,
    reason: `Held: ${what}, so the 80% line could not be checked. Nothing sends on a guess (Matt 2026-09-30).`,
  }
}

export async function getCmaSendFloorBySlug(slug: string): Promise<ExpiredSendFloor> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return unreadable('the database is not configured')
  const sb = createServiceClient()
  const safe = String(slug ?? '').trim().toLowerCase()
  const { data: row, error } = await sb
    .from('cmas')
    .select('id, request_source, doc_type, recommended_list, build_summary')
    .eq('slug', safe)
    .maybeSingle()
  if (error) return unreadable(`the CMA row could not be read (${error.message})`)
  if (!row) return unreadable('the CMA row was not found')
  const r = row as {
    id: string
    request_source: string | null
    doc_type: string | null
    recommended_list: number | null
    build_summary: unknown
  }
  const { data: exp, error: expErr } = await sb
    .from('expired_listings')
    .select('list_price, original_list_price')
    .eq('cma_id', String(r.id))
    .limit(1)
  if (expErr) return unreadable(`the expired listing could not be read (${expErr.message})`)
  const expRow = (exp ?? [])[0] as { list_price?: unknown; original_list_price?: unknown } | undefined
  const isExpired = Boolean(expRow) || classifyCmaOrigin(r.request_source, r.doc_type) === 'expired'
  const lastListPrice =
    positive(expRow?.list_price) ?? positive(expRow?.original_list_price) ?? theirPriceFromBuildSummary(r.build_summary, 'expired')
  return expiredSendFloor({ isExpired, price: positive(r.recommended_list), lastListPrice })
}
