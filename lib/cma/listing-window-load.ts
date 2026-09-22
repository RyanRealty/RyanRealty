/**
 * Read the closes for one listing window and pick the market story.
 *
 * A stored move wins, so a letter keeps the figures it was signed with.
 * A draft with nothing stored is measured on the way to the page, which is
 * how a letter built before this existed can show it without a price rebuild.
 * Anything already finalized or delivered is left alone.
 */

import { getCmaCityClosedDuring } from '@/lib/data/cma/builderReads'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import {
  chooseListingMarket,
  closesFromRows,
  withSqftMedian,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'

const LIVE_STATUS = new Set(['draft', 'needs_review'])

export function readListingMarket(value: unknown): ListingMarketMove | null {
  if (!value || typeof value !== 'object') return null
  const m = value as ListingMarketMove
  if (m.priceMove !== 'rose' && m.priceMove !== 'fell' && m.priceMove !== 'held flat') return null
  if (typeof m.place !== 'string' || !m.place.trim()) return null
  if (!m.early || !m.late) return null
  if (!(m.early.median > 0) || !(m.late.median > 0)) return null
  if (!(m.early.n > 0) || !(m.late.n > 0)) return null
  return m
}

export async function loadListingWindowMarket(input: {
  city: string | null | undefined
  subdivision: string | null | undefined
  sqft: number | null | undefined
  latitude: number | null | undefined
  longitude: number | null | undefined
  listDate: string | null | undefined
  offDate: string | null | undefined
  asOf: string
}): Promise<ListingMarketMove | null> {
  const listDate = String(input.listDate ?? '').slice(0, 10)
  const offDate = String(input.offDate ?? '').slice(0, 10)
  const city = (input.city ?? '').trim()
  if (!city || !/^\d{4}-\d{2}-\d{2}$/.test(listDate) || !/^\d{4}-\d{2}-\d{2}$/.test(offDate)) return null
  if (offDate <= listDate) return null
  let rows
  try {
    rows = await getCmaCityClosedDuring(city, listDate, offDate)
  } catch (err) {
    console.error('[listing-window-market]', err)
    return null
  }
  if (rows.length === 0) return null
  const slug = resolveMarketArea(input.latitude ?? null, input.longitude ?? null)
  const move = chooseListingMarket({
    listDate,
    offDate,
    subjectSqft: input.sqft ?? null,
    subdivision: input.subdivision ?? null,
    neighborhoodSlug: slug,
    neighborhoodName: marketAreaName(slug),
    city,
    rows: closesFromRows(rows),
  })
  if (!move) return null
  return { ...move, asOf: input.asOf.slice(0, 10) }
}

type MarketDoc = {
  subject?: {
    city?: string | null
    subdivision?: string | null
    sqft?: number | null
    latitude?: number | null
    longitude?: number | null
    lastListDate?: string | null
  } | null
  expiredAudit?: {
    finalCycle?: { listDate?: string | null; offMarketDate?: string | null } | null
  } | null
  listingMarket?: unknown
}

async function measureDocument(doc: MarketDoc): Promise<ListingMarketMove | null> {
  const cycle = doc.expiredAudit?.finalCycle
  return loadListingWindowMarket({
    city: doc.subject?.city,
    subdivision: doc.subject?.subdivision,
    sqft: doc.subject?.sqft,
    latitude: doc.subject?.latitude,
    longitude: doc.subject?.longitude,
    listDate: cycle?.listDate ?? doc.subject?.lastListDate,
    offDate: cycle?.offMarketDate,
    asOf: new Date().toISOString().slice(0, 10),
  })
}

/**
 * Stored dollars win. A draft that was measured before the size was kept
 * gets the median square feet attached when a fresh read still matches
 * those dollars, so the sentence can explain a rise beside a lower rate.
 */
export async function listingMarketForDocument(
  doc: MarketDoc,
  status: string | null | undefined,
): Promise<ListingMarketMove | null> {
  const stored = readListingMarket(doc.listingMarket)
  const live = LIVE_STATUS.has((status ?? '').toLowerCase())
  if (!stored) return live ? measureDocument(doc) : null
  if (!live) return stored
  if (stored.early.sqftMedian != null && stored.late.sqftMedian != null) return stored
  const fresh = await measureDocument(doc)
  return fresh ? withSqftMedian(stored, fresh) : stored
}
