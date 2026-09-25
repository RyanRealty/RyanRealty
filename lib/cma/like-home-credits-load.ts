/**
 * On a draft, look up what homes like this one credited the buyer.
 * A signed letter keeps whatever it was built with.
 */

import { getLikeHomeSales } from '@/lib/data/cma/builderReads'
import { likeHomeBounds, likeHomeCredits, type LikeHomeCredit } from '@/lib/cma/like-home-credits'

const LIVE_STATUS = new Set(['draft', 'needs_review'])

type CreditDoc = {
  generatedAtIso?: string | null
  subject?: {
    city?: string | null
    subdivision?: string | null
    yearBuilt?: number | null
    sqft?: number | null
    streetAddress?: string | null
  } | null
  comps?: ReadonlyArray<{ address?: string | null }> | null
}

export async function likeHomeCreditsForDocument(
  doc: CreditDoc,
  status: string | null | undefined,
): Promise<LikeHomeCredit | null> {
  if (!LIVE_STATUS.has((status ?? '').toLowerCase())) return null
  const subject = doc.subject
  const asOf = (doc.generatedAtIso || new Date().toISOString()).slice(0, 10)
  const bounds = likeHomeBounds({
    subdivision: subject?.subdivision,
    yearBuilt: subject?.yearBuilt,
    sqft: subject?.sqft,
    asOf,
  })
  const city = (subject?.city ?? '').trim()
  if (!bounds || !city) return null
  let rows
  try {
    rows = await getLikeHomeSales({
      city,
      subdivisionPrefix: bounds.place,
      sqftLow: bounds.sqftLow,
      sqftHigh: bounds.sqftHigh,
      yearLow: bounds.yearLow,
      yearHigh: bounds.yearHigh,
      fromIso: bounds.from,
      toIso: bounds.to,
    })
  } catch (err) {
    console.error('[like-home-credits]', err)
    return null
  }
  const own = (subject?.streetAddress ?? '').trim().toLowerCase()
  const letterAddrs = new Set(
    (doc.comps ?? [])
      .map((c) => (c.address ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  const mapped = rows
    .map((r) => ({
      address: [r.street_number, r.street_name].filter(Boolean).join(' ').trim(),
      subdivision: r.subdivision,
      yearBuilt: r.year_built,
      sqft: r.sqft == null ? null : Number(r.sqft),
      closeDate: String(r.close_date).slice(0, 10),
      concessionsAmount: r.concessions_amount == null ? null : Number(r.concessions_amount),
      concessionsYn: r.concessions_yn,
    }))
    .filter((r) => {
      if (!r.address) return false
      if (own && r.address.toLowerCase() === own) return false
      if (letterAddrs.size === 0) return false
      const addr = r.address.toLowerCase()
      return [...letterAddrs].some((a) => a === addr || a.includes(addr) || addr.includes(a))
    })
  if (mapped.length === 0) return null
  return likeHomeCredits({
    subdivision: subject?.subdivision,
    yearBuilt: subject?.yearBuilt,
    sqft: subject?.sqft,
    asOf,
    rows: mapped,
  })
}
