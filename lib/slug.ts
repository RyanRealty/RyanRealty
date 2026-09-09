import { publishStreetNumber } from '@/lib/listing/publish-street-line'

/**
 * Normalize display names to URL- and storage-safe keys.
 * Used for banner entity_key and storage paths so web and mobile share the same URLs.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

/** Display label for a subdivision. "Out of area; see remarks" (or similar) → "See homes nearby". */
export function getSubdivisionDisplayName(name: string | null | undefined): string {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return name?.trim() ?? ''
  if (n === 'out of area; see remarks' || n === 'out of area, see remarks') return 'See homes nearby'
  return (name ?? '').trim()
}

/**
 * Sentinel subdivision values the MLS uses to mean "no subdivision" — they must
 * never render as if they were a real community name (e.g. "Bend, OR 97703 ·
 * N/A"). Covers the literal "N/A" string, "None"/"Unknown" placeholders, and the
 * `***`-masked private-field convention.
 *
 * Single source of truth — used by the price strip address line, similar-listing
 * card city lines, and the JSON-LD builder so every surface agrees.
 */
export function displaySubdivision(name: string | null | undefined): string | null {
  const raw = (name ?? '').trim()
  if (!raw) return null
  if (raw.startsWith('***')) return null
  const n = raw.toLowerCase()
  if (n === 'n/a' || n === 'na' || n === 'none' || n === 'unknown' || n === 'n/a.') return null
  return raw
}

/** Entity key for a city (e.g. "Bend" -> "bend"). */
export function cityEntityKey(city: string): string {
  return slugify(city)
}

/** Canonical city listings path (e.g. "Bend" -> "/homes-for-sale/bend"). */
export function cityPagePath(city: string): string {
  return homesForSalePath(city)
}

/** Canonical neighborhood page path (e.g. "bend", "larkspur" -> "/cities/bend/larkspur"). */
export function neighborhoodPagePath(citySlug: string, neighborhoodSlug: string): string {
  return `/cities/${slugify(citySlug)}/${slugify(neighborhoodSlug)}`
}

/**
 * SEO-friendly path for browsing homes for sale by place.
 * Use for all "homes for sale in [city]" or "homes for sale in [community]" links and canonicals.
 * - No args: /homes-for-sale (main search)
 * - City only: /homes-for-sale/bend
 * - City + subdivision: /homes-for-sale/bend/sunriver
 */
export function homesForSalePath(city?: string | null, subdivision?: string | null): string {
  if (!city?.trim()) return '/homes-for-sale'
  const citySlug = cityEntityKey(city)
  if (!subdivision?.trim()) return `/homes-for-sale/${citySlug}`
  return `/homes-for-sale/${citySlug}/${slugify(subdivision)}`
}

/** Canonical subdivision/community listings path with optional neighborhood segment. */
export function subdivisionListingsPath(
  city?: string | null,
  subdivision?: string | null,
  neighborhood?: string | null
): string {
  if (!city?.trim() || !subdivision?.trim()) return homesForSalePath(city ?? null, subdivision ?? null)
  const citySlug = cityEntityKey(city)
  const subdivisionSlug = slugify(subdivision)
  const neighborhoodSlug = neighborhood?.trim() ? slugify(neighborhood) : ''
  if (!neighborhoodSlug || neighborhoodSlug === subdivisionSlug) {
    return `/homes-for-sale/${citySlug}/${subdivisionSlug}`
  }
  return `/homes-for-sale/${citySlug}/${neighborhoodSlug}/${subdivisionSlug}`
}

/** Canonical browse hub for all listings search/navigation. */
export function listingsBrowsePath(): string {
  return '/homes-for-sale'
}

/** Canonical team page path. */
export function teamPath(slug?: string | null): string {
  if (!slug?.trim()) return '/team'
  return `/team/${encodeURIComponent(slug.trim())}`
}

/** Canonical home valuation path. */
export function valuationPath(): string {
  return '/sell/valuation'
}

/**
 * Canonical city > neighborhood path — the ONLY sanctioned 2-segment /cities
 * URL. The /cities/[slug]/[neighborhoodSlug] route resolves ONLY neighborhoods-
 * table slugs; any other second segment 404s. The sitemap emits neighborhood
 * URLs exclusively through this named helper so ci:sitemap-resolvable can ban
 * every inline /cities/${a}/${b} template — closing the copy-pasted-loop drift
 * class (a rogue loop emitting /cities/{city}/{subdivision}) regardless of the
 * loop variable's name or source.
 */
export function cityNeighborhoodPath(citySlug: string, neighborhoodSlug: string): string {
  return `/cities/${citySlug}/${neighborhoodSlug}`
}

/**
 * Reports explore page URL with year-to-date pre-loaded for a city (and optional community).
 * Use for "View year-to-date report" from city/community/neighborhood market overview.
 */
export function reportsExploreYtdPath(city: string, subdivision?: string | null): string {
  // W8.4: the custom explore tool is retired; route to the canonical pre-generated
  // report. A subdivision goes to its /subdivisions page, otherwise the city report
  // (which carries the YTD-default timeframe selector).
  if (subdivision?.trim()) return `/subdivisions/${slugify(subdivision.trim())}`
  return `/housing-market/${slugify(city.trim())}`
}

/** Entity key for a subdivision (e.g. city "Bend", subdivision "Sunriver" -> "bend:sunriver"). */
export function subdivisionEntityKey(city: string, subdivision: string): string {
  return `${slugify(city)}:${slugify(subdivision)}`
}

/** Parse entity_key "city:subdivision" into display parts (e.g. "bend:sunriver" -> { city: "Bend", subdivision: "Sunriver" }). */
export function parseEntityKey(entityKey: string): { city: string; subdivision: string } {
  const [city = '', subdivision = ''] = entityKey.split(':')
  const format = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { city: format(city), subdivision: format(subdivision) }
}

/**
 * Build an SEO-friendly listing URL slug from address parts (e.g. "123-main-st-bend-oregon-97702").
 * Includes street, city, state, and zip for legacy routes.
 */
export function listingAddressSlug(parts: {
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}): string {
  const street = [publishStreetNumber(parts.streetNumber), parts.streetName].filter(Boolean).join('-')
  const loc = [parts.city, parts.state].filter(Boolean).join('-')
  const zip = (parts.postalCode ?? '').toString().trim().replace(/\D/g, '')
  const combined = [street, loc, zip].filter(Boolean).join('-')
  return slugify(combined)
}

/** Build the canonical "{street-address}-{mlsNumber}" listing segment. */
export function listingAddressSlugWithMls(
  parts: {
    streetNumber?: string | null
    streetName?: string | null
  } | null | undefined,
  mlsNumber: string
): string {
  const mls = String(mlsNumber ?? '').trim()
  if (!mls) return ''
  const streetRaw = [publishStreetNumber(parts?.streetNumber), parts?.streetName].filter(Boolean).join('-').trim()
  const street = streetRaw ? slugify(streetRaw) : ''
  return street ? `${street}-${mls}` : mls
}

/**
 * Build canonical listing detail path using location hierarchy:
 * /homes-for-sale/{city}/[{neighborhood}/]{community}/{street-address}-{mlsNumber}
 * If community is unavailable: /homes-for-sale/{city}/{street-address}-{mlsNumber}
 * If location is incomplete, falls back to /homes-for-sale/listing/{mlsNumber}.
 */
export function listingDetailPath(
  listingKey: string,
  address?: {
    streetNumber?: string | null
    streetName?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
  } | null,
  location?: {
    city?: string | null
    neighborhood?: string | null
    subdivision?: string | null
  } | null,
  identifiers?: {
    mlsNumber?: string | null
  } | null
): string {
  const normalizedListingKey = String(listingKey ?? '').trim()
  const normalizedMls = String(identifiers?.mlsNumber ?? '').trim()
  const publicId = normalizedMls || normalizedListingKey
  if (!publicId) return listingsBrowsePath()

  // 'Outside Boundaries' is the boundary classifier's SENTINEL for a home
  // outside every polygon — it is not a place and never a URL segment. Callers
  // pass `boundaryCity ?? city`, so when the boundary field carries the
  // sentinel, fall through to the MLS city instead of publishing
  // /homes-for-sale/outside-boundaries/... as the canonical.
  // `[\s-]*` rather than `[\s-]?` (SITE-22): the fixture asserting this rule
  // found the single-separator form let "Outside  Boundaries" through, and
  // a URL segment is not the place to be strict about whitespace. No real
  // Central Oregon place is named this, so widening the match cannot withhold
  // a real one.
  const isBoundarySentinel = (v: string | null | undefined) =>
    !!v && /^outside[\s-]*boundaries$/i.test(v.trim())
  const locationCity = isBoundarySentinel(location?.city) ? null : (location?.city ?? null)
  const cityRaw = locationCity ?? address?.city ?? null
  const citySlug = cityRaw?.trim() ? slugify(cityRaw) : null
  // Drop MLS noise ("N/A", "None", …) so we never emit /homes-for-sale/city/na/...
  const cleanSubdivision = displaySubdivision(location?.subdivision)
  const cleanNeighborhood = isBoundarySentinel(location?.neighborhood)
    ? null
    : displaySubdivision(location?.neighborhood)
  const neighborhoodSlug = cleanNeighborhood ? slugify(cleanNeighborhood) : null
  const subdivisionSlug = cleanSubdivision ? slugify(cleanSubdivision) : null
  const listingSegment = listingAddressSlugWithMls(
    { streetNumber: address?.streetNumber ?? null, streetName: address?.streetName ?? null },
    publicId
  )

  if (citySlug && subdivisionSlug && listingSegment) {
    const hierarchyBase = subdivisionListingsPath(citySlug, subdivisionSlug, neighborhoodSlug)
    return `${hierarchyBase}/${encodeURIComponent(listingSegment)}`
  }

  if (citySlug && listingSegment) {
    return `/homes-for-sale/${citySlug}/${encodeURIComponent(listingSegment)}`
  }

  return `/homes-for-sale/listing/${encodeURIComponent(publicId)}`
}

/**
 * The always-valid key form of a listing URL: /homes-for-sale/listing/<id>.
 * `listingDetailPath` degrades to exactly this when the address is incomplete,
 * and app/listing/by-key redirects it to the pretty URL. Callers that hold a
 * key and nothing else (a saved alert row, a booking link) use this rather
 * than typing the path, so the fallback shape lives in one place.
 */
export function listingByKeyPath(publicId: string): string {
  return `/homes-for-sale/listing/${encodeURIComponent(publicId)}`
}

/** Every field the ONE listing-URL builder reads. Nothing else affects the path. */
export type ListingUrlSubject = {
  listingKey?: string | null
  listNumber?: string | null
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  /** Boundary city/neighborhood from the listing_tile_mv spatial xref — pass
   *  these (a ListingTile carries them) so the URL gets the FULL hierarchy. */
  boundaryCity?: string | null
  boundaryNeighborhood?: string | null
  subdivisionName?: string | null
}

/**
 * THE listing URL. One builder for the canonical, the sitemap row, and every
 * internal href, so the site cannot link to a URL it does not canonicalise to.
 *
 * Always returns a /homes-for-sale/... path via listingDetailPath — never the
 * raw /listing/<key> alias. Pass whatever fields the caller has; when address
 * fields are absent (a bare map pin) it degrades to the still-valid
 * /homes-for-sale/listing/<id> form, never a 404.
 *
 * SITE-22, verified against Search Console 2026-06-08..2026-09-05: 2,363 of
 * 8,724 listing ids appeared at more than one URL — 4,995 URLs, 21,808
 * impressions, 47.7% of listing-class impressions (2,104 ids at two URLs, 249
 * at three, 10 at four). The duplicates were the site's own output, not
 * crawler-minted, and they had one cause each:
 *
 *   · a builder called listingDetailPath directly with {city, subdivision}
 *     while the canonical passed {boundaryCity, boundaryNeighborhood,
 *     subdivision}, so the href and the canonical disagreed on the middle
 *     segments for every home whose boundary place is not its MLS city;
 *   · a builder passed no listNumber, subdivisionName or boundaryNeighborhood
 *     at all, so the path fell back to the 26-digit ListingKey — 885 such URLs
 *     drawing 3,348 impressions.
 *
 * The demonstrated harm is index fragmentation, not clicks: multi-URL ids ran
 * 1.33% CTR at weighted position 13.5 against 1.56% and 11.5 for single-URL
 * ids. Do NOT read a rank change into that.
 *
 * The three fields most easily dropped — listNumber, boundaryNeighborhood,
 * subdivisionName — are the three that MOVE the path, which is why every
 * caller takes this whole shape rather than four positional arguments it can
 * partly fill.
 */
export function listingTileHref(tile: ListingUrlSubject): string {
  // 'N/A' is MLS noise, not a plat. listingDetailPath drops it too (via
  // displaySubdivision) — the pre-filter here keeps the two agreeing even if
  // one of them is edited, which is the /jacksonville/na/... shape GSC still
  // carries from before the filter existed.
  const subdivision =
    tile.subdivisionName && tile.subdivisionName !== 'N/A' ? tile.subdivisionName : null
  return listingDetailPath(
    String(tile.listingKey ?? tile.listNumber ?? ''),
    { streetNumber: tile.streetNumber ?? null, streetName: tile.streetName ?? null, city: tile.city ?? null },
    {
      // 'Outside Boundaries' is the classifier's sentinel, not a place;
      // listingDetailPath refuses it and falls through to the MLS city, which
      // is why /homes-for-sale/outside-boundaries/... is a RETIRED canonical
      // shape GSC still remembers rather than one we can emit today.
      city: tile.boundaryCity ?? tile.city ?? null,
      neighborhood: tile.boundaryNeighborhood ?? null,
      subdivision,
    },
    { mlsNumber: tile.listNumber ?? null },
  )
}

/**
 * The same URL, from a listing DETAIL row. Identical output to
 * listingTileHref — it exists so a detail page (whose row spells the fields
 * differently) cannot quietly grow a second builder, and so `<link
 * rel=canonical>`, the JSON-LD `url` and the page's own self-href are one
 * expression rather than three copies of it.
 */
export function listingCanonicalHref(listing: {
  listingKey: string
  listNumber?: string | null
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  boundaryCity?: string | null
  boundaryNeighborhood?: string | null
  subdivisionName?: string | null
}): string {
  return listingTileHref(listing)
}

/**
 * Extract the listing key from a URL segment that may be:
 * - "key"
 * - "key~address-slug" (legacy)
 * - "street-address-mls" (canonical)
 * - "mlsOrKey-zip" (legacy canonical)
 * - "12345-address-slug" (legacy short form)
 * Canonical parsing prefers the terminal MLS number token.
 */
export function listingKeyFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug).trim()
  if (!decoded) return ''
  const beforeTilde = decoded.split('~')[0]?.trim() ?? ''
  if (!beforeTilde) return ''

  const mlsTail = beforeTilde.match(/-(\d{6,})$/)
  if (mlsTail?.[1]) return mlsTail[1].trim()

  const zipMatch = beforeTilde.match(/^(.*)-(\d{5})$/)
  if (zipMatch?.[1]) return zipMatch[1].trim()

  const parts = beforeTilde.split('-')
  const first = parts[0]?.trim() ?? ''
  if (parts.length > 1 && /^\d+$/.test(first)) return first
  return beforeTilde
}
