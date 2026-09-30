/**
 * The 80% line, read for one CMA (Matt 2026-09-30). The rule lives in
 * lib/cma/send-floor.ts; this reads what it needs: the CMA's origin and
 * recommended price, and the expired listing it belongs to.
 *
 * Which expired listing. The same three ways the send rail finds the owner
 * (lib/data/prospecting/cma-send-prospect.ts): the caller's own prospect (a
 * prospecting intro passes its kind and list price), an expired row pointing
 * at this CMA by cma_id, or an expired row for this CMA's MLS listing key. A
 * broker-built second version at the same address is therefore still an
 * expired CMA when it goes to that owner.
 *
 * The last list price of record is the expired row's (the same source
 * getCmaProspectAsk reads first); build_summary.subject.last_list_price is the
 * fallback, because most live expired rows never stamped it.
 *
 * Fails closed, and says so. A read that errors holds the CMA with
 * `unreadable: true`, so a caller that can retry (the drip) leaves the owner
 * queued instead of dropping them, and nothing sends on a guess.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { classifyCmaOrigin, type CmaOrigin } from '@/lib/cma/origin'
import { theirPriceFromBuildSummary } from '@/lib/cma/queue-view'
import { expiredSendFloor, type ExpiredSendFloor } from '@/lib/cma/send-floor'

export type CmaSendFloorRead = ExpiredSendFloor & { unreadable?: true }

/** Origins where the owner asked for the valuation themselves. */
const OWNER_ASKED: ReadonlySet<CmaOrigin> = new Set<CmaOrigin>(['seller-valuation', 'place-page', 'lead-form'])

function positive(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return v != null && Number.isFinite(n) && n > 0 ? n : null
}

function unreadable(what: string): CmaSendFloorRead {
  return {
    held: true,
    ratio: null,
    unreadable: true,
    reason: `The 80% line could not be checked because ${what}. Nothing sends on a guess (Matt 2026-09-30). Try again shortly.`,
  }
}

export async function getCmaSendFloorBySlug(
  slug: string,
  context?: {
    /** The prospect this send is for, when the caller is a prospecting intro. */
    prospectKind?: 'expired' | 'fsbo' | null
    /** That prospect's last list price. */
    lastListPrice?: number | null
  },
): Promise<CmaSendFloorRead> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return unreadable('the database is not configured')
  const sb = createServiceClient()
  const safe = String(slug ?? '').trim().toLowerCase()
  const { data: row, error } = await sb
    .from('cmas')
    .select('id, request_source, doc_type, recommended_list, build_summary, subject_listing_key')
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
    subject_listing_key: string | null
  }
  const origin = classifyCmaOrigin(r.request_source, r.doc_type)

  const { data: linked, error: linkErr } = await sb
    .from('expired_listings')
    .select('list_price, original_list_price')
    .eq('cma_id', String(r.id))
    .limit(1)
  if (linkErr) return unreadable(`the expired listing could not be read (${linkErr.message})`)
  let expRow = (linked ?? [])[0] as { list_price?: unknown; original_list_price?: unknown } | undefined

  // A version no expired row points at, for an address whose MLS listing did
  // expire: a broker-built or legacy version still goes to that owner. Only a
  // valuation the owner asked for themselves is not cold outreach.
  const listingKey = String(r.subject_listing_key ?? '').trim()
  if (!expRow && listingKey && !OWNER_ASKED.has(origin)) {
    const { data: byKey, error: keyErr } = await sb
      .from('expired_listings')
      .select('list_price, original_list_price')
      .eq('listing_key', listingKey)
      .limit(1)
    if (keyErr) return unreadable(`the expired listing could not be read (${keyErr.message})`)
    expRow = (byKey ?? [])[0] as typeof expRow
  }

  const isExpired = context?.prospectKind === 'expired' || Boolean(expRow) || origin === 'expired'
  const lastListPrice =
    (context?.prospectKind === 'expired' ? positive(context.lastListPrice) : null) ??
    positive(expRow?.list_price) ??
    positive(expRow?.original_list_price) ??
    theirPriceFromBuildSummary(r.build_summary, 'expired')
  return expiredSendFloor({ isExpired, price: positive(r.recommended_list), lastListPrice })
}
