/**
 * Read the closes for one listing window and pick the market story.
 *
 * A stored move wins, so a letter keeps the figures it was signed with.
 * A draft with nothing stored is measured on the way to the page, which is
 * how a letter built before this existed can show it without a price rebuild.
 * Anything already finalized or delivered is left alone.
 */

import { getCmaCityClosedDuring } from '@/lib/data/cma/builderReads'
import { compPoolPropertySubType, letterProductNoun, marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import {
  chooseListingMarket,
  closesFromRows,
  readListingMarketMove,
  withSqftMedian,
  type ListingMarketClose,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { zonedDateKey } from '@/lib/format/date'

const LIVE_STATUS = new Set(['draft', 'needs_review'])

export function readListingMarket(value: unknown): ListingMarketMove | null {
  return readListingMarketMove(value)
}

/** What the listing-window read is measured over: the subject's own place, size and type. */
export type ListingWindowInput = {
  city: string | null | undefined
  subdivision: string | null | undefined
  sqft: number | null | undefined
  latitude: number | null | undefined
  longitude: number | null | undefined
  listDate: string | null | undefined
  offDate: string | null | undefined
  asOf: string
  areaKind?: string | null
  areaName?: string | null
  propertySubType?: string | null
}

/**
 * The city's closes inside one listing window, read once.
 *
 * The build reads these BEFORE pricing, so the exclusive-pocket date gate
 * (Matt 2026-10-08, "Down only if local fell") and the local page are measured
 * off one read by one function (measureListingWindowMarket), never two.
 */
export type ListingWindowCloses = {
  listDate: string
  offDate: string
  city: string
  rows: ListingMarketClose[]
}

/** The window's dates, or null when there is no dated window to read over. */
export function listingWindowDates(
  input: Pick<ListingWindowInput, 'city' | 'listDate' | 'offDate'>,
): { listDate: string; offDate: string; city: string } | null {
  const listDate = String(input.listDate ?? '').slice(0, 10)
  const offDate = String(input.offDate ?? '').slice(0, 10)
  const city = (input.city ?? '').trim()
  if (!city || !/^\d{4}-\d{2}-\d{2}$/.test(listDate) || !/^\d{4}-\d{2}-\d{2}$/.test(offDate)) return null
  if (offDate <= listDate) return null
  return { listDate, offDate, city }
}

/**
 * Read the closes. Null when there is no dated window, when the read fails, or
 * when the window held no closes at all; the local page prints no chart then.
 */
export async function loadListingWindowCloses(
  input: Pick<ListingWindowInput, 'city' | 'listDate' | 'offDate' | 'propertySubType'>,
): Promise<ListingWindowCloses | null> {
  const window = listingWindowDates(input)
  if (!window) return null
  let rows
  try {
    rows = await getCmaCityClosedDuring(
      window.city,
      window.listDate,
      window.offDate,
      compPoolPropertySubType(input.propertySubType ?? null),
    )
  } catch (err) {
    console.error('[listing-window-market]', err)
    return null
  }
  if (rows.length === 0) return null
  return { ...window, rows: closesFromRows(rows) }
}

/**
 * The local page's move, off closes already read. Pure: the same closes and
 * the same sales area always give the same move.
 */
export function measureListingWindowMarket(
  closes: ListingWindowCloses | null,
  input: Omit<ListingWindowInput, 'city' | 'listDate' | 'offDate'>,
): ListingMarketMove | null {
  if (!closes || closes.rows.length === 0) return null
  const slug = resolveMarketArea(input.latitude ?? null, input.longitude ?? null)
  const kind = input.areaKind ?? null
  const subdivision =
    kind === 'subdivision' || kind === 'subdivisions'
      ? (input.areaName ?? input.subdivision ?? null)
      : (input.subdivision ?? null)
  const move = chooseListingMarket({
    listDate: closes.listDate,
    offDate: closes.offDate,
    subjectSqft: input.sqft ?? null,
    subdivision,
    neighborhoodSlug: slug,
    neighborhoodName: marketAreaName(slug),
    city: closes.city,
    rows: closes.rows,
    areaKind: kind,
    propertySubType: input.propertySubType ?? null,
  })
  if (!move) return null
  const productNoun = letterProductNoun(input.propertySubType)
  return { ...move, asOf: input.asOf.slice(0, 10), ...(productNoun ? { productNoun } : {}) }
}

export async function loadListingWindowMarket(input: ListingWindowInput): Promise<ListingMarketMove | null> {
  return measureListingWindowMarket(await loadListingWindowCloses(input), input)
}

type MarketDoc = {
  subject?: {
    city?: string | null
    subdivision?: string | null
    sqft?: number | null
    latitude?: number | null
    longitude?: number | null
    lastListDate?: string | null
    propertySubType?: string | null
  } | null
  compArea?: { kind?: string | null; names?: readonly string[] | null } | null
  expiredAudit?: {
    finalCycle?: { listDate?: string | null; offMarketDate?: string | null } | null
  } | null
  listingMarket?: unknown
  /** The stored pricing; only `timeAdjustment.localGate` is read here. */
  pricing?: { timeAdjustment?: { basis?: unknown; localGate?: unknown } | null } | null
}

async function measureDocument(doc: MarketDoc, readBudgetMs?: number): Promise<ListingMarketMove | null> {
  const cycle = doc.expiredAudit?.finalCycle
  const read = loadListingWindowMarket({
    city: doc.subject?.city,
    subdivision: doc.subject?.subdivision,
    sqft: doc.subject?.sqft,
    latitude: doc.subject?.latitude,
    longitude: doc.subject?.longitude,
    listDate: cycle?.listDate ?? doc.subject?.lastListDate,
    offDate: cycle?.offMarketDate,
    // The letter's calendar day (Pacific), not the UTC slice: an evening build
    // is still today's letter (reader review 2026-10-08, "Measured 2026-10-08"
    // on a letter dated October 7).
    asOf: zonedDateKey(new Date()),
    areaKind: doc.compArea?.kind ?? null,
    areaName: doc.compArea?.names?.[0] ?? null,
    propertySubType: doc.subject?.propertySubType ?? null,
  })
  // No budget: wait for the read, same as the PDF / print path. A budget is
  // only the admin Open-report serve, and a timeout returns null so a stored
  // move above still wins.
  if (readBudgetMs == null) return read
  return withTimeoutFallback(read, null, readBudgetMs, 'cma.listingMarket')
}

/**
 * Stored dollars win. A draft that was measured before the size was kept
 * gets the median square feet attached when a fresh read still matches
 * those dollars, so the sentence can explain a rise beside a lower rate.
 *
 * `readBudgetMs` is optional. Omit it (print / PDF) and a slow read runs to
 * completion. The admin document serve passes a budget so Open report cannot
 * sit on a blank tab.
 */
export async function listingMarketForDocument(
  doc: MarketDoc,
  status: string | null | undefined,
  readBudgetMs?: number,
): Promise<ListingMarketMove | null> {
  const stored = readListingMarket(doc.listingMarket)
  const live = LIVE_STATUS.has((status ?? '').toLowerCase())
  // A letter whose pocket date move was gated on its local read (Matt
  // 2026-10-08, "Down only if local fell") was measured before it was priced.
  // When that read printed nothing, a fresh read here could print a fall the
  // price was not moved for, so the page stays as the build left it.
  if (!stored && doc.pricing?.timeAdjustment?.localGate != null) return null
  if (!stored) return live ? measureDocument(doc, readBudgetMs) : null
  if (!live) return stored
  if (stored.early.sqftMedian != null && stored.late.sqftMedian != null) return stored
  const fresh = await measureDocument(doc, readBudgetMs)
  return fresh ? withSqftMedian(stored, fresh) : stored
}
