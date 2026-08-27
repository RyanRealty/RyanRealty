/**
 * The open-house section, shared by the three place grains.
 *
 * WHY THIS EXISTS. D94 — the interactive open-houses rail — was a Matt
 * directive. It rendered through KbOpenHouses.client.tsx, and that component was
 * deleted in the 2026-08-26 place-family migration as part of the "orphan
 * cascade": a cap-driven deletion, made while PUBLIC_UI section 3 still capped a
 * page at four of the six patterns. The parity notes recorded the reasoning as
 * "the open-houses surface is /open-houses/[city]; the closing Quiet keeps the
 * door" — which is a door, not the section. Matt killed the cap on 2026-08-27
 * and asked for the deleted sections back, so the section returns.
 *
 * IT RETURNS AS A LEDGER, NOT AS THE OLD RAIL. The KB version was a horizontal
 * strip where clicking a card promoted it into a lead panel. On the barrel the
 * pattern for "a scannable list of real rows, each row a door" is Ledger, and
 * that is what an open-house list is: a date, an address, a price, one action.
 * The promote-into-lead interaction was the rail's answer to having no room; a
 * Ledger row IS the door, so the interaction has nothing left to do.
 *
 * ONE READ, THREE GRAINS. Open houses are recorded per listing and scoped by
 * CITY — there is no neighborhood or community open-house feed, which is the
 * honest reason the KB community page's rail was mislabelled (D93: a city-scoped
 * feed under a community's name). So the eyebrow always names the CITY the feed
 * is actually scoped to, whatever page it sits on, and the door goes to that
 * city's own open-houses node.
 */
import { getListingTiles, getHeroPhotosByListingKeys, getUpcomingOpenHouses } from '@/lib/data'
import { assembleOpenHouses, type OpenHouseListing } from '@/app/open-houses/_v3/oh-listings'
import { openHouseWhen } from '@/app/open-houses/_v3/oh-when'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { pacificTodayIso, addIsoDays } from '@/app/open-houses/_v3/oh-constants'
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'

/** The window the rail always showed: today plus six days. */
const WINDOW_DAYS = 6

/**
 * Upcoming open houses for a city, joined to their listings. Returns [] on any
 * miss — an empty section is absent, never a zero (PUBLIC_UI section 3).
 */
export async function readCityOpenHouses(
  cityName: string | null | undefined,
  limit = 6,
): Promise<OpenHouseListing[]> {
  const city = cityName?.trim()
  if (!city) return []
  const todayIso = pacificTodayIso()
  const rows = await getUpcomingOpenHouses({
    dateFromIso: todayIso,
    dateToIso: addIsoDays(todayIso, WINDOW_DAYS),
    todayIso,
    city,
  }).catch(() => [])
  if (rows.length === 0) return []

  const listingKeys = [...new Set(rows.map((r) => r.listing_key))]
  if (listingKeys.length === 0) return []
  const [tiles, heroes] = await Promise.all([
    getListingTiles({ listingKeys: listingKeys.slice(0, 5000), status: 'all', limit: 500 }).catch(() => []),
    getHeroPhotosByListingKeys(listingKeys).catch(() => new Map<string, string>()),
  ])
  return assembleOpenHouses(rows, tiles, heroes, { city }).slice(0, limit)
}

/**
 * Open houses as Ledger rows. The ask goes through formatPublishedAsk, so a
 * fractional-interest listing is labelled as a share rather than read as the
 * price of the whole home (section 0).
 */
export function openHouseRows(items: readonly OpenHouseListing[]): V3LedgerFigureRow[] {
  return items.flatMap((oh) => {
    const address = (oh.unparsedAddress
      ?? [oh.streetNumber, oh.streetName, oh.streetSuffix].filter(Boolean).join(' '))?.trim()
    if (!address || !oh.href) return []
    const when = openHouseWhen(oh.eventDate, oh.startTime, oh.endTime)
    const specs = [
      oh.beds != null ? `${oh.beds} bd` : null,
      oh.baths != null ? `${oh.baths} ba` : null,
      oh.sqft != null ? `${oh.sqft.toLocaleString('en-US')} sqft` : null,
    ].filter(Boolean).join(' · ')
    // The MLS writes literal 'N/A' into SubdivisionName when a listing has no
    // subdivision. Printing it puts the string N/A on a broker's page under a
    // live-MLS trace, which is a published value nobody measured (section 0).
    // Absent means absent.
    const sub = oh.subdivisionName?.trim()
    const subdivision = sub && !/^(n\/?a|none|unknown|tbd)$/i.test(sub) ? sub : null
    // A fractional ask never prints unlabelled: the share kind rides the detail
    // line, so "$925,000" beside a quarter-share is read as the share it is and
    // not as the price of the whole dwelling (section 0, the Camp Sherman rule).
    const shareKind = publishListingShareKind({
      propertySubType: oh.propertySubType,
      subdivisionName: oh.subdivisionName,
      city: oh.city,
      listNumber: oh.listNumber,
    })
    const detail = [subdivision, specs, shareKind].filter(Boolean).join(' · ')
    return [
      {
        id: oh.id,
        href: oh.href,
        when: v3Text(when || 'This week'),
        what: v3Text(address),
        ...(detail ? { detail: v3Text(detail) } : {}),
        value: v3Text(formatPublishedAsk(oh.listPrice) ?? 'Price on request'),
        ...(oh.photoUrl?.trim() ? { media: { src: oh.photoUrl.trim() } } : {}),
      },
    ]
  })
}

/** The trace under the section. Names the feed and the window it covers. */
export const OPEN_HOUSE_TRACE =
  'Open houses scheduled in the next 7 days, live from the MLS through Oregon Data Share'
