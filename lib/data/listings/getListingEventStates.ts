import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ListingEventSource } from '@/lib/alerts/event-detection'

/**
 * getListingEventStatesByKeys — lightweight per-listing event-state lookup for
 * the typed-event alert engine (app/actions/saved-search-alerts.ts).
 *
 * The search cache serves tile rows without the event-history columns, and the
 * search MV serves ON-MARKET rows only — so sold/pending classification of a
 * previously-notified key that left the match set, and price-change deltas for
 * current matches, both need a direct (indexed, key-list) read of `listings`.
 * This is a point lookup by key list, not an aggregate — the §7 "use the
 * cache" rule targets aggregation, and the DAL boundary is honored by living
 * here.
 *
 * Keys are the alert engine's canonical listing keys (ListNumber preferred,
 * ListingKey fallback), so the lookup matches on EITHER column. supabase-js
 * handles bare mixed-case column names (never embed double quotes in these
 * strings — PostgREST would treat them as part of the name).
 */

const CARD_AND_EVENT_COLS =
  'ListingKey, ListNumber, StandardStatus, ListPrice, CloseDate, OpenHouses, ' +
  'StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, ' +
  'BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, ' +
  'last_price_change_date, last_price_change_amount, last_price_change_pct, ' +
  'pending_timestamp, back_on_market_timestamp, status_change_timestamp'

type RawEventRow = {
  ListingKey: string | null
  ListNumber: string | null
  StandardStatus: string | null
  ListPrice: number | null
  CloseDate: string | null
  OpenHouses: Array<{ Date?: string }> | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  last_price_change_date: string | null
  last_price_change_amount: number | null
  last_price_change_pct: number | null
  pending_timestamp: string | null
  back_on_market_timestamp: string | null
  status_change_timestamp: string | null
}

/** Card fields for rendering a departed (sold/pending) listing in the email. */
export type ListingEventCardFields = {
  streetNumber: string | null
  streetName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  subdivisionName: string | null
  photoUrl: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  listNumber: string | null
  rawListingKey: string | null
}

export type ListingEventState = ListingEventSource & { card: ListingEventCardFields }

/** True when any open house entry has a date that is today or later. */
function hasUpcomingOpenHouse(openHouses: Array<{ Date?: string }> | null, now: Date): boolean {
  if (!Array.isArray(openHouses)) return false
  const floor = now.getTime() - 24 * 60 * 60 * 1000
  return openHouses.some((oh) => {
    const ms = oh?.Date ? Date.parse(oh.Date) : NaN
    return Number.isFinite(ms) && ms >= floor
  })
}

const SAFE_KEY = /^[A-Za-z0-9_-]+$/
const CHUNK = 100

function toState(row: RawEventRow, canonicalKey: string, now: Date): ListingEventState {
  return {
    listingKey: canonicalKey,
    standardStatus: row.StandardStatus,
    listPrice: row.ListPrice != null ? Number(row.ListPrice) : null,
    closeDate: row.CloseDate,
    lastPriceChangeDate: row.last_price_change_date,
    lastPriceChangeAmount:
      row.last_price_change_amount != null ? Number(row.last_price_change_amount) : null,
    lastPriceChangePct:
      row.last_price_change_pct != null ? Number(row.last_price_change_pct) : null,
    pendingTimestamp: row.pending_timestamp,
    backOnMarketTimestamp: row.back_on_market_timestamp,
    statusChangeTimestamp: row.status_change_timestamp,
    hasOpenHouse: hasUpcomingOpenHouse(row.OpenHouses, now),
    card: {
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      city: row.City,
      state: row.State,
      postalCode: row.PostalCode,
      subdivisionName: row.SubdivisionName,
      photoUrl: row.PhotoURL,
      beds: row.BedroomsTotal != null ? Number(row.BedroomsTotal) : null,
      baths: row.BathroomsTotal != null ? Number(row.BathroomsTotal) : null,
      sqft: row.TotalLivingAreaSqFt != null ? Number(row.TotalLivingAreaSqFt) : null,
      listNumber: row.ListNumber,
      rawListingKey: row.ListingKey,
    },
  }
}

/**
 * Resolve event states for a list of canonical alert keys. Returns a map
 * keyed by the CANONICAL key passed in (a row matching on either ListNumber
 * or ListingKey resolves both spellings). Missing keys are simply absent —
 * the caller treats them as unresolvable (fail-soft, never throws).
 */
export async function getListingEventStatesByKeys(
  keys: string[],
  now: Date = new Date(),
): Promise<Map<string, ListingEventState>> {
  const out = new Map<string, ListingEventState>()
  const clean = [...new Set(keys.map((k) => (k ?? '').trim()).filter((k) => k && SAFE_KEY.test(k)))]
  if (clean.length === 0) return out

  const supabase = createServiceClient()
  try {
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK)
      const list = chunk.join(',')
      const { data, error } = await supabase
        .from('listings')
        .select(CARD_AND_EVENT_COLS)
        .or(`ListNumber.in.(${list}),ListingKey.in.(${list})`)
      if (error) {
        console.error('[getListingEventStatesByKeys]', error.message)
        continue
      }
      const wanted = new Set(chunk)
      // The concatenated select string defeats supabase-js's template parser
      // (it infers GenericStringError[]), so the row shape is asserted here.
      for (const raw of (data ?? []) as unknown as RawEventRow[]) {
        const byNumber = (raw.ListNumber ?? '').trim()
        const byKey = (raw.ListingKey ?? '').trim()
        const canonical = wanted.has(byNumber) ? byNumber : wanted.has(byKey) ? byKey : null
        if (!canonical || out.has(canonical)) continue
        out.set(canonical, toState(raw, canonical, now))
      }
    }
  } catch (err) {
    console.error(
      '[getListingEventStatesByKeys]',
      err instanceof Error ? err.message : String(err),
    )
  }
  return out
}
