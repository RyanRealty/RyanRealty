/**
 * Which prospect row does a CMA send belong to?
 *
 * The CMA send rail (lib/cma/send.ts) has to know, before an email leaves,
 * whether the recipient is an owner we already track as a prospect, so it can
 * claim that owner's email slot and refuse a second first contact. This is the
 * read that answers it. Two ways in, in order:
 *
 *   1. The link the build stamped: `expired_listings.cma_id` or
 *      `fsbo_listings.cma_id` equals this CMA's id. Same lookup as
 *      `findProspectForCmaSlug` in ./drip-queue.
 *   2. The orphan. A second `cmas` row for the same house (a rebuild, a `--vN`
 *      version, a manual build) is not the row the prospect points at, so
 *      step 1 misses it. It still carries the MLS `subject_listing_key`, and
 *      that equals `expired_listings.listing_key` (unique, index
 *      expired_listings_listing_key_uniq), so it lands on the same owner. An
 *      FSBO row has no MLS key, so an FSBO orphan is only reachable through the
 *      cma_id link.
 *
 * The fallback keys on the house, not on who the CMA is addressed to. That is
 * the point: a duplicate first contact is the same mistake whichever route
 * built the second CMA. It does not look at the CMA's origin; the caller does.
 * The lease (lib/cma/prospect-send-claim.ts) never claims for an asked origin,
 * so a valuation an owner requested for a home that is also in the expired
 * queue resolves here but is not held to the cold one-first-contact rule.
 *
 * One deliberate difference from `findProspectForCmaSlug`: that helper turns a
 * database error into `null`, which is right for a page that can live without
 * the answer and wrong for a send. Here a failed read THROWS. "No prospect row"
 * (null) and "could not tell" (throw) are different facts, and the send rail
 * refuses on the second one instead of mailing an owner it could not check.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { ProspectKind } from './types'

export type CmaSendProspect = {
  kind: ProspectKind
  /** The key the claim RPCs take: expired -> listing_key, fsbo -> fsbo_url. */
  id: string
  /** How the row was found. `listing_key` means the orphan path. */
  via: 'cma_id' | 'listing_key'
}

/** The owner's prospect row for a CMA send, or null when no prospect row is in play. Throws when the read fails. */
export async function resolveProspectForCmaSend(slug: string): Promise<CmaSendProspect | null> {
  const sb = createServiceClient()

  const { data: cma, error: cmaError } = await sb
    .from('cmas')
    .select('id, subject_listing_key')
    .eq('slug', slug)
    .maybeSingle()
  if (cmaError) throw new Error(`cmas read failed: ${cmaError.message}`)
  if (!cma) return null
  const cmaId = String(cma.id)

  const { data: expiredLinked, error: expiredLinkedError } = await sb
    .from('expired_listings')
    .select('listing_key')
    .eq('cma_id', cmaId)
    .limit(1)
    .maybeSingle()
  if (expiredLinkedError) throw new Error(`expired_listings cma_id read failed: ${expiredLinkedError.message}`)
  if (expiredLinked?.listing_key) {
    return { kind: 'expired', id: String(expiredLinked.listing_key), via: 'cma_id' }
  }

  const { data: fsboLinked, error: fsboLinkedError } = await sb
    .from('fsbo_listings')
    .select('fsbo_url')
    .eq('cma_id', cmaId)
    .limit(1)
    .maybeSingle()
  if (fsboLinkedError) throw new Error(`fsbo_listings cma_id read failed: ${fsboLinkedError.message}`)
  if (fsboLinked?.fsbo_url) {
    return { kind: 'fsbo', id: String(fsboLinked.fsbo_url), via: 'cma_id' }
  }

  const listingKey = typeof cma.subject_listing_key === 'string' ? cma.subject_listing_key.trim() : ''
  if (!listingKey) return null
  const { data: byKey, error: byKeyError } = await sb
    .from('expired_listings')
    .select('listing_key')
    // @canonical-key — cmas.subject_listing_key is the listings row's RETS
    // ListingKey (lib/cma/subject.ts), and expired_listings.listing_key is that
    // same key copied at detection time: a key-to-key self-lookup, no ListNumber.
    .eq('listing_key', listingKey)
    .limit(1)
    .maybeSingle()
  if (byKeyError) throw new Error(`expired_listings listing_key read failed: ${byKeyError.message}`)
  if (byKey?.listing_key) {
    return { kind: 'expired', id: String(byKey.listing_key), via: 'listing_key' }
  }

  return null
}
