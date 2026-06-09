/**
 * getUpcomingOpenHouses — upcoming open houses, read from SUPABASE.
 *
 * SOURCE OF TRUTH (verified 2026-05-28):
 *   The data lives in `listings."OpenHouses"` (jsonb), kept fresh by the live
 *   listings delta sync (`_expand=...,OpenHouses`). The standalone
 *   `public.open_houses` table is a separate cache whose sync died on
 *   2026-04-03 (stale, 0 upcoming) — DO NOT read it for upcoming open houses.
 *   At time of writing Supabase carried 610 upcoming open houses in the next
 *   14 days (382 in Bend) across 352 active listings.
 *
 * JSONB SHAPE (per element of listings."OpenHouses"):
 *   { "Date": "MM/DD/YYYY", "StartTime": "2:00 pm", "EndTime": "4:00 pm" }
 *
 * ACCESS RULE (hard-coded here so it can't drift):
 *   1. listings WHERE "StandardStatus"='Active' AND "OpenHouses" is a
 *      non-empty array [AND "City" = <city>].
 *   2. Unnest the jsonb, parse "Date" (MM/DD/YYYY → ISO), keep events whose
 *      date is within [max(dateFrom, today), dateTo].
 *   3. Normalize StartTime/EndTime ("2:00 pm") → "HH:MM:SS" 24h so the value
 *      matches the legacy open_houses table shape the UI expects.
 *   4. Dedup to ONE (soonest) open house per listing so a grid of "homes with
 *      open houses" shows distinct properties, sorted by date then time.
 *
 * Returns the SAME row shape as the legacy getOpenHousesInRange so the
 * downstream action (app/actions/open-houses.ts) and OpenHousesGrid need no
 * change — only the data source moved from the dead table to the live jsonb.
 *
 * Column names are passed BARE to the Supabase client (it quotes the
 * mixed-case RETS columns); never embed literal double-quotes in the strings.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type UpcomingOpenHouseRow = {
  id: string
  open_house_key: string
  listing_key: string
  event_date: string // YYYY-MM-DD
  start_time: string | null // HH:MM:SS (24h)
  end_time: string | null // HH:MM:SS (24h)
  host_agent_name: string | null
  remarks: string | null
  rsvp_count: number
}

type OpenHouseJson = { Date?: string; StartTime?: string; EndTime?: string }

// Ryan Realty's Central Oregon service area. The listings feed is statewide,
// so the no-city (homepage) pull is scoped to these so we never surface a
// Medford or Portland open house on a Central Oregon site.
const SERVICE_AREA_CITIES = [
  'Bend', 'Redmond', 'Sisters', 'La Pine', 'Sunriver', 'Madras',
  'Prineville', 'Culver', 'Terrebonne', 'Tumalo', 'Powell Butte',
]

// "MM/DD/YYYY" → "YYYY-MM-DD" (null on anything else).
function toIsoDate(d: string | undefined): string | null {
  const m = (d ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

// "2:00 pm" → "14:00:00" (null on anything else).
function to24hTime(t: string | undefined): string | null {
  const m = (t ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}:00`
}

async function _getUpcomingOpenHousesUncached(options: {
  dateFromIso: string
  dateToIso: string
  todayIso: string
  city?: string
}): Promise<UpcomingOpenHouseRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const from = options.dateFromIso > options.todayIso ? options.dateFromIso : options.todayIso
  const to = options.dateToIso

  let query = sb
    .from('listings')
    .select('ListingKey, City, OpenHouses')
    .eq('StandardStatus', 'Active')
    .not('OpenHouses', 'is', null)
    .neq('OpenHouses', '[]')
    // Exclude builder spec / model homes. They list "open houses" with
    // standing daily hours, which floods the feed with new-construction
    // inventory instead of real public open houses (Matt directive
    // 2026-05-28). new_construction_yn IS NOT TRUE keeps resale + unflagged.
    .not('new_construction_yn', 'is', true)
    .limit(2000)
  if (options.city?.trim()) query = query.eq('City', options.city.trim())
  else query = query.in('City', SERVICE_AREA_CITIES)

  const { data, error } = await query
  // THROW on a transient DB error so makeResilientCached never caches the empty
  // result (poison-null: one pooler/timeout blip would otherwise blank the
  // "open houses this weekend" grid for the whole 15-min window). Genuine empty → [].
  if (error) throw new Error(`[getUpcomingOpenHouses] ${error.message ?? JSON.stringify(error)}`)

  const soonestByListing = new Map<string, UpcomingOpenHouseRow>()
  for (const rec of (data ?? []) as Array<{ ListingKey?: string; OpenHouses?: OpenHouseJson[] }>) {
    const listingKey = rec.ListingKey
    const ohs = rec.OpenHouses
    if (!listingKey || !Array.isArray(ohs)) continue
    for (const oh of ohs) {
      const eventDate = toIsoDate(oh.Date)
      if (!eventDate || eventDate < from || eventDate > to) continue
      const startTime = to24hTime(oh.StartTime)
      const candidate: UpcomingOpenHouseRow = {
        id: `${listingKey}-${eventDate}-${startTime ?? '00:00:00'}`,
        open_house_key: `${listingKey}-${eventDate}`,
        listing_key: listingKey,
        event_date: eventDate,
        start_time: startTime,
        end_time: to24hTime(oh.EndTime),
        host_agent_name: null,
        remarks: null,
        rsvp_count: 0,
      }
      const existing = soonestByListing.get(listingKey)
      if (
        !existing ||
        candidate.event_date < existing.event_date ||
        (candidate.event_date === existing.event_date &&
          (candidate.start_time ?? '') < (existing.start_time ?? ''))
      ) {
        soonestByListing.set(listingKey, candidate)
      }
    }
  }

  return [...soonestByListing.values()].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date)
    return (a.start_time ?? '').localeCompare(b.start_time ?? '')
  })
}

/**
 * Cached entry point. 15-minute freshness matches the listings sync cadence —
 * open houses get added/edited intraday and we never want a stale weekend.
 */
export const getUpcomingOpenHouses = makeResilientCached(
  _getUpcomingOpenHousesUncached,
  // v3 — bumped alongside the poison-null fix (was unstable_cache, which cached []
  // on a transient error). v2 excluded new-construction spec/model homes; v3 also
  // evicts any v2 entries that may be poisoned.
  ['upcoming-open-houses-v3'],
  { revalidate: CACHE_WINDOWS.marketPulse, tags: [cacheTag.market, 'open-houses'] },
  [],
)
