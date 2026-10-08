/**
 * THE SUBJECT'S PRICE TIER: WHAT ITS OWN AREA SELLS FOR.
 *
 * Matt 2026-09-10, on 23 Benaiah (a 2,080 sqft Larkspur-area home that asked
 * $665,000 and printed a range of $523,000 to $1,165,000): "we should never
 * have a range this wide. these comps are literally all over the board."
 *
 * The cause was one hole, not many. `similarPerformingSubdivision` and its D12
 * sibling both grade a sale against the SUBJECT'S subdivision median $/sqft,
 * and both return true — pass — when that median is missing. 23 Benaiah's MLS
 * record carries SubdivisionName "N/A", so it has no cell, so the price-tier
 * cut never bound: a $579/sqft downtown sale and a $234/sqft sale out on China
 * Hat both priced a $320/sqft tract home, and the range printed the spread.
 *
 * A home always sits in SOME price tier, read from the sales already in the
 * pool the ladder was handed: no extra read, no new source of truth.
 *
 * THE NARROWEST LEVEL THAT HOLDS A FAIR MEDIAN (Matt 2026-10-08, "One 20%
 * line": the anchor is "what your home's own area sells for"). The first cut
 * read the neighborhood polygon first, so a modest subdivision inside a pricey
 * neighborhood was graded against the neighborhood. 3062 NW Kelly Hill sits in
 * Westside Meadows II, an older tract inside Summit West. Summit West's median
 * was $609 a square foot (42 sales), so the line ran $487 to $731, and every
 * Westside Meadows sale ($345 to $457 a square foot) fell outside its own
 * home's price line: only the own-plat rungs, which the line does not grade,
 * held any sale, and the search died at four. The levels, narrowest first,
 * each taken only when it holds ANCHOR_MIN_N sales:
 *
 *   1. plat          the recorded plat the home sits in (boundaries polygon);
 *   2. family        that plat's subdivision family: its phases, numbered
 *                    plats and additions (sameSubdivisionFamily below), in
 *                    the same city: Westside Meadows and Westside Meadows II;
 *   3. subdivision   the MLS SubdivisionName on the home's own record;
 *   4. community     the community the home sits in, when it is one the search
 *                    walls on (searchCommunitySlug, the walk's own test);
 *   5. neighborhood  the City of Bend neighborhood polygon;
 *   6. within-a-mile then rural-radius: the ground around a home no polygon
 *                    holds, measured over more ground, never over fewer sales;
 *   7. city          the home's city, the last resort, and never on rural
 *                    acreage, where a city median is in-town tract homes.
 *
 * The quantity is unchanged at every level: each sale's close price over its
 * living area, before any date adjustment, over the window the caller read
 * (the facts pool on the facts walk, 24 months or 30 for a custom or new
 * home; twelve months on the listings ladder).
 *
 * The subject's own asking price is deliberately NOT an anchor. An expired
 * listing is, by definition, a price the market refused; 120 Sisemore asked
 * $1,495,000 and the sales supported $718,000, and anchoring to that ask would
 * have admitted the luxury comps that produced it.
 */

import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  ordinaryPhaseFamilyKey,
  sameOrdinaryPhaseFamily,
  saleSearchCommunitySlug,
  searchCommunitySlug,
} from '@/lib/cma/community-location'
import { marketAreaName } from '@/lib/cma/market-area'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import {
  platFamilyBaseName,
  platFamilyDisplayName,
  platFamilyKey,
  platFamilySlug,
  platMemberDisplayName,
} from '@/lib/market/plat-family'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { displaySubdivision } from '@/lib/slug'
import type { PricingSale, PricingSubject } from '@/lib/pricing/match'

export type PriceAnchorSource =
  | 'plat'
  | 'family'
  | 'subdivision'
  | 'community'
  | 'neighborhood'
  | 'within-a-mile'
  | 'rural-radius'
  | 'city'

export type PriceAnchor = {
  ppsf: number
  n: number
  source: PriceAnchorSource
  /** How far the read had to reach, in miles, when it reached by radius. */
  radiusMiles?: number
  /**
   * The place the median was read over, named for a reader ("Westside
   * Meadows", "Summit West", "Bend"). Null on a radius read, and when the
   * level has no publishable name.
   */
  where?: string | null
}

/**
 * A tier read on fewer sales than this is noise, not a market. The same five
 * the subdivision cells hold their median to (SUBDIVISION_TIER_MIN_N in
 * lib/pricing/classes.ts), and it binds at every level below.
 */
export const ANCHOR_MIN_N = 5

/** How far out the last-resort anchor looks when no polygon holds the subject. */
export const ANCHOR_RADIUS_MILES = 1

/**
 * AND HOW FAR IT REACHES ON RURAL GROUND (Matt 2026-09-10).
 *
 * A mile around a Bend tract home holds dozens of sales. A mile around 19496
 * Tumalo Reservoir holds two, so the anchor came back null, so nothing graded
 * that document on price at all — the same hole 23 Benaiah fell through, just
 * out in the county. It then priced a 2,325 sqft home off a $2,800,000 sale at
 * $1,048/sqft standing beside four sales at $370 to $466, and printed $858,000
 * to $2,550,000.
 *
 * Houses are further apart out there, so the tier is measured over more ground
 * — never over fewer sales. ANCHOR_MIN_N still binds at every step, and a
 * subject that cannot reach it even at the widest radius still gets no anchor
 * rather than an invented one.
 */
export const ANCHOR_RURAL_RADII_MILES = [2, 3, 5, 8] as const

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function ppsfOf(sale: PricingSale): number | null {
  const direct = sale.closePpsf
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) return direct
  if (sale.closePrice > 0 && sale.sqft > 0) return sale.closePrice / sale.sqft
  return null
}

const MILES_PER_DEG_LAT = 69.05

function milesBetween(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const latM = MILES_PER_DEG_LAT
  const lngM = MILES_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * latM
  const dx = (a.lng - b.lng) * lngM
  return Math.sqrt(dx * dx + dy * dy)
}


/** True when a family base reads as a Central Oregon city's own name. */
function isCityName(key: string | null | undefined): boolean {
  return Boolean(key) && CENTRAL_OREGON_CITY_SLUGS.has(platFamilySlug(key!))
}

/**
 * THE SUBDIVISION FAMILY KEY of one recorded plat, read from its slug, or
 * null when the plat has none.
 *
 * This is the site's own family rule (lib/market/plat-family.ts, Matt
 * 2026-09-23: "When there are multiple phases in a subdivision, we want all
 * those to go into the same main neighborhood page"): the county label with
 * the recording residue stripped (Phase, Unit, Stage, "Second Addition", a
 * trailing number in digits, roman numerals or words), compared on
 * platFamilyKey. "Westside Meadows II" and "Westside Meadows" share the base
 * "Westside Meadows". It is read from the slug because the comp pools carry
 * each sale's plat slug, not its label; measured 2026-10-08 over all 3,427
 * recorded plats in public.boundaries, the slug gives the label's key for
 * 3,374, and the other 53 (land-use file numbers, dotted initials) come out
 * narrower, never wider, so a slug can only miss a family, never invent one.
 *
 * A base that is a Central Oregon city's own name is not a family: the
 * townsite additions of Bend are not "Bend", and an anchor named "in Bend"
 * would read as the whole city. Those plats fall through to the next level.
 */
export function subdivisionFamilyKey(platSlug: string | null | undefined): string | null {
  const raw = (platSlug ?? '').trim().toLowerCase()
  if (!raw) return null
  const base = platFamilyBaseName(raw.replace(/-+/g, ' '))
  if (!base) return null
  const key = platFamilyKey(base)
  if (!key || isCityName(key)) return null
  return key
}

/**
 * The family test for one home's plat, built once and asked once per sale.
 * True for the plat itself, for the phases of one ordinary subdivision the
 * walk already treats as one plat (sameOrdinaryPhaseFamily, Matt 2026-10-06),
 * and for plats sharing the site's family base (subdivisionFamilyKey).
 * Location only: the MLS name is not read. Never a family named for a city.
 */
export function subdivisionFamilyOf(platSlug: string | null | undefined): (salePlat: string | null | undefined) => boolean {
  const home = (platSlug ?? '').trim().toLowerCase()
  if (!home) return () => false
  const homeKey = subdivisionFamilyKey(home)
  const phaseStemIsCity = isCityName((ordinaryPhaseFamilyKey(home) ?? '').replace(/-+/g, ' '))
  const seen = new Map<string, boolean>()
  return (salePlat) => {
    const sale = (salePlat ?? '').trim().toLowerCase()
    if (!sale) return false
    if (sale === home) return true
    const known = seen.get(sale)
    if (known != null) return known
    const same =
      (!phaseStemIsCity && sameOrdinaryPhaseFamily(home, sale)) ||
      (homeKey != null && subdivisionFamilyKey(sale) === homeKey)
    seen.set(sale, same)
    return same
  }
}

/** True when two recorded plats are one subdivision family (subdivisionFamilyOf). */
export function sameSubdivisionFamily(a: string | null | undefined, b: string | null | undefined): boolean {
  return subdivisionFamilyOf(a)(b)
}

/**
 * One sale as the anchor reads it: its own $/sqft and which of the subject's
 * places it sits in. Both ladders build these with anchorSampler, so they
 * walk the same levels in the same order (anchorFromSamples).
 */
export type AnchorSample = {
  ppsf: number | null
  /** In the subject's own recorded plat. */
  inPlat: boolean
  /** In the subject's subdivision family (the plat itself included). */
  inFamily: boolean
  /** Carries the subject's own MLS SubdivisionName, in the subject's city. */
  sameSubdivisionName: boolean
  /** Inside the community the subject's search walls on. */
  inCommunity: boolean
  /** Inside the subject's City of Bend neighborhood polygon. */
  inNeighborhood: boolean
  /** Miles from the subject, or null without coordinates. */
  miles: number | null
  /** In the subject's city. */
  inCity: boolean
}

/** Where the subject sits, as the anchor reads it. */
export type AnchorSubjectPlace = {
  /** The recorded plat the home sits in (boundaries.geo_slug), from the plat read. */
  platSlug: string | null
  /** normSubdivision of the MLS SubdivisionName on the home's own record (not an inferred pocket). */
  subdivisionNorm: string | null
  citySlug: string | null
  /** The community the home's search walls on (searchCommunitySlug), or null. */
  communitySlug: string | null
  /** City of Bend neighborhood mesh slug, or null outside the mesh. */
  marketArea: string | null
  latitude: number | null
  longitude: number | null
  /**
   * Rural acreage reads no city level. Out in the county a city median is
   * in-town tract homes, not this home's market, and Matt's 2026-09-10 rule
   * holds there: a home the widest ring cannot price on five sales gets no
   * anchor rather than an invented one.
   */
  ruralAcreage: boolean
}

/** One sale's place, as the anchor reads it. */
export type AnchorSalePlace = {
  ppsf: number | null
  platSlug: string | null
  subdivisionNorm: string | null
  citySlug: string | null
  /**
   * The sale's community read against the subject by the ladder's own test
   * (saleSearchCommunitySlug on the facts walk, saleCommunityOf on the
   * listings ladder), or null.
   */
  communitySlug: string | null
  marketArea: string | null
  latitude: number | null
  longitude: number | null
}

/** A city slug, or null for a blank one (citySlug writes 'unknown' for no city). */
function knownCity(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim()
  return s && s !== 'unknown' ? s : null
}

/**
 * THE ONE SAMPLE BUILDER both ladders use: which of the subject's places a
 * sale sits in. The family and subdivision levels hold to the subject's own
 * city, as the site's families do (a phase is never grouped with a namesake
 * in another town), so a sale with no city does not join them.
 */
export function anchorSampler(subject: AnchorSubjectPlace): (sale: AnchorSalePlace) => AnchorSample {
  const city = knownCity(subject.citySlug)
  const inFamily = subdivisionFamilyOf(subject.platSlug)
  const plat = (subject.platSlug ?? '').trim() || null
  return (sale) => {
    const sameCity = Boolean(city && knownCity(sale.citySlug) === city)
    const salePlat = (sale.platSlug ?? '').trim() || null
    const inPlat = Boolean(plat && salePlat && salePlat === plat)
    return {
      ppsf: sale.ppsf,
      inPlat,
      inFamily: inPlat || (sameCity && inFamily(salePlat)),
      sameSubdivisionName: Boolean(subject.subdivisionNorm && sameCity && sale.subdivisionNorm === subject.subdivisionNorm),
      inCommunity: Boolean(subject.communitySlug && sale.communitySlug === subject.communitySlug),
      inNeighborhood: Boolean(subject.marketArea && sale.marketArea === subject.marketArea),
      miles: milesBetween(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: sale.latitude, lng: sale.longitude },
      ),
      inCity: !subject.ruralAcreage && sameCity,
    }
  }
}

/** The reader's name for each of the subject's places, when it has one. */
export type AnchorPlaceNames = {
  plat?: string | null
  family?: string | null
  subdivision?: string | null
  community?: string | null
  neighborhood?: string | null
  city?: string | null
}

function usablePpsf(v: number | null): v is number {
  return v != null && Number.isFinite(v) && v > 0
}

/**
 * THE ONE LEVEL WALK both ladders share. The first level, narrowest first,
 * that holds ANCHOR_MIN_N sales with a usable $/sqft sets the anchor. Null
 * when none does, which every caller reads as "no line": nothing here invents
 * a tier from a thin sample.
 */
export function anchorFromSamples(
  samples: readonly AnchorSample[],
  names: AnchorPlaceNames = {},
): PriceAnchor | null {
  const rates = (pick: (s: AnchorSample) => boolean): number[] =>
    samples
      .filter(pick)
      .map((s) => s.ppsf)
      .filter(usablePpsf)
  const levels: Array<{ source: PriceAnchorSource; where: string | null; rates: () => number[]; radiusMiles?: number }> = [
    { source: 'plat', where: names.plat ?? null, rates: () => rates((s) => s.inPlat) },
    { source: 'family', where: names.family ?? null, rates: () => rates((s) => s.inPlat || s.inFamily) },
    { source: 'subdivision', where: names.subdivision ?? null, rates: () => rates((s) => s.sameSubdivisionName) },
    { source: 'community', where: names.community ?? null, rates: () => rates((s) => s.inCommunity) },
    { source: 'neighborhood', where: names.neighborhood ?? null, rates: () => rates((s) => s.inNeighborhood) },
    {
      source: 'within-a-mile',
      where: null,
      radiusMiles: ANCHOR_RADIUS_MILES,
      rates: () => rates((s) => s.miles != null && s.miles <= ANCHOR_RADIUS_MILES),
    },
    // Rural ground: reach further for the SAME number of sales, never settle
    // for fewer. The tier is always read over the tightest ring that can
    // support it.
    ...ANCHOR_RURAL_RADII_MILES.map((radius) => ({
      source: 'rural-radius' as const,
      where: null,
      radiusMiles: radius,
      rates: () => rates((s) => s.miles != null && s.miles <= radius),
    })),
    { source: 'city', where: names.city ?? null, rates: () => rates((s) => s.inCity) },
  ]
  for (const level of levels) {
    const values = level.rates()
    if (values.length < ANCHOR_MIN_N) continue
    const m = median(values)
    if (m == null) continue
    return {
      ppsf: m,
      n: values.length,
      source: level.source,
      ...(level.radiusMiles != null ? { radiusMiles: level.radiusMiles } : {}),
      where: level.where,
    }
  }
  return null
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * The reader's names for a subject's places, from what the ladders already
 * hold: the county label of its plat (getSubdivisionRing), its MLS
 * SubdivisionName, the community slug its search walls on, its neighborhood
 * mesh slug, and its city. A family base that reads as a city's own name is
 * never printed as the family (it would read as the whole city).
 */
export function anchorPlaceNames(input: {
  platSlug?: string | null
  platLabel?: string | null
  subdivision?: string | null
  communitySlug?: string | null
  marketArea?: string | null
  city?: string | null
}): AnchorPlaceNames {
  const label = (input.platLabel ?? '').trim() || (input.platSlug ? titleCaseWords(input.platSlug.replace(/-+/g, ' ')) : '')
  const familyBase = label ? platFamilyBaseName(label) : null
  const familyName = familyBase && !isCityName(platFamilyKey(familyBase)) ? familyBase : null
  const community = (input.communitySlug ?? '').trim()
  return {
    plat: label ? platMemberDisplayName(label) || label : null,
    family: familyName ? platFamilyDisplayName({ name: familyName }) || familyName : null,
    subdivision: publishPlatDisplayName(input.subdivision) ?? displaySubdivision(input.subdivision),
    community: community
      ? (getResortCommunityBySlug(community)?.label ?? titleCaseWords(community.replace(/-+/g, ' ')))
      : null,
    neighborhood: marketAreaName(input.marketArea ?? null),
    city: (input.city ?? '').trim() || null,
  }
}

/**
 * Where the anchor was read, as the trace and the letter say it: "in
 * Westside Meadows", "in Summit West", "within 1 mile", "in Bend". A level
 * with no publishable name says what kind of place it was.
 */
export function anchorPlacePhrase(anchor: Pick<PriceAnchor, 'source' | 'radiusMiles' | 'where'>): string {
  if (anchor.radiusMiles != null) {
    return `within ${anchor.radiusMiles} ${anchor.radiusMiles === 1 ? 'mile' : 'miles'}`
  }
  const where = (anchor.where ?? '').trim()
  if (where) return `in ${where}`
  switch (anchor.source) {
    case 'plat':
      return "in your home's own plat"
    case 'family':
      return "in your home's plat and its phases"
    case 'subdivision':
      return "in the tract your home's listing names"
    case 'community':
      return "in your home's community"
    case 'neighborhood':
      return "in your home's neighborhood"
    case 'city':
      return "in your home's city"
    default:
      return "in your home's area"
  }
}

/**
 * The price tier to grade comps against on the facts walk, read over the pool
 * the walk was handed, narrowest level first (anchorFromSamples). Null when no
 * level holds enough sales, and a null anchor keeps today's fail-open
 * behaviour rather than inventing a tier from three sales.
 *
 * Pass the subject as the MLS row and the plat read left it, before any
 * inferred pocket: the subdivision level is the home's own MLS name, and the
 * plat level is the polygon the home sits in.
 */
export function resolvePriceAnchor(subject: PricingSubject, pool: readonly PricingSale[]): PriceAnchor | null {
  const platSlug = (subject.subdivisionSlug ?? '').trim() || null
  const community = searchCommunitySlug(subject)
  const sample = anchorSampler({
    platSlug,
    subdivisionNorm: subject.subdivisionNorm ?? null,
    citySlug: subject.citySlug ?? null,
    communitySlug: community,
    marketArea: subject.marketArea ?? null,
    latitude: subject.latitude,
    longitude: subject.longitude,
    ruralAcreage: subject.ruralAcreage === true,
  })
  const samples = pool.map((sale) =>
    sample({
      ppsf: ppsfOf(sale),
      platSlug: sale.subdivisionSlug ?? null,
      subdivisionNorm: sale.subdivisionNorm ?? null,
      citySlug: sale.citySlug ?? null,
      // The walk's own community test (the community rung reads the same).
      communitySlug: community ? saleSearchCommunitySlug(subject, sale) : null,
      marketArea: sale.marketArea ?? null,
      latitude: sale.latitude,
      longitude: sale.longitude,
    }),
  )
  return anchorFromSamples(
    samples,
    anchorPlaceNames({
      platSlug,
      platLabel: subject.platLabel ?? null,
      subdivision: subject.subdivision,
      communitySlug: community,
      marketArea: subject.marketArea ?? null,
      city: subject.city,
    }),
  )
}

/**
 * THE HOUSE NEXT DOOR IS NOT A DIFFERENT PRICE TIER.
 *
 * 23 Benaiah asked $665,000 for 2,080 sqft. 31 Benaiah — the same 2,080 sqft
 * plan on the same street — closed at $512,000 fourteen months earlier, which
 * is $246/sqft against a Larkspur median of $345. The first cut of the price
 * anchor threw it out for being "a different tier" and left the document
 * priced off five larger homes in other neighborhoods.
 *
 * A sale on the subject's own street, of the subject's own size, IS the
 * subject's tier. No median may veto it. Everything else about it — product
 * type, bath count, date, condition — is still graded exactly as before; this
 * exempts the PRICE cut alone.
 */
export const SAME_STREET_SIZE_BAND = 0.1

/**
 * How far the recommendation may sit above a same-street sale of the subject's
 * own size before a person has to say so (Matt 2026-09-10: "the twin anchors
 * the number, and the other sales bracket rather than set it").
 *
 * Ten percent is room for condition and updates between two houses on one
 * street. It is not room for the $141,000 that separated 23 Benaiah's
 * recommendation from what the identical plan next door actually fetched.
 */
export const SAME_STREET_PREMIUM_MAX = 0.1

export function streetKey(address: string | null | undefined): string | null {
  const s = (address ?? '').trim().toLowerCase()
  if (!s) return null
  // "23 Benaiah" / "23 NW Benaiah Ave" → "benaiah". The house number goes, the
  // directional and the suffix go, what identifies the street stays.
  const withoutNumber = s.replace(/^\s*\d+[a-z]?\s+/, '')
  const tokens = withoutNumber
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((t) => !/^(n|s|e|w|ne|nw|se|sw|north|south|east|west)$/.test(t))
    .filter((t) => !/^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|blvd|loop|cir|circle|ter|terrace|hwy|highway)\.?$/.test(t))
  return tokens[0] ?? null
}

/**
 * THE OTHER EXEMPTION: THE SUBJECT'S OWN PLAT (Matt 2026-09-10, "two
 * exemptions and only two"). A sale inside it IS the subject's price tier. An
 * adjacent plat is a different plat and is graded like anything else.
 * Phases of one ordinary subdivision are that plat (Matt 2026-10-06). An
 * addition inside a community, and a phase of a registry community, are not.
 *
 * Keys, not names: `subdivisionSlug` is the RECORDED plat polygon both homes
 * were resolved against, and `subdivisionNorm` the MLS SubdivisionName
 * (normSubdivision, placeholders like "N/A" already null) as the fallback.
 */
export type PlatKeys = {
  subdivisionSlug?: string | null
  subdivisionNorm?: string | null
}

/**
 * IS THIS SALE IN THE SUBJECT'S OWN PLAT? (Matt 2026-09-10: "location is the
 * primary thing... within the subdivision, that's the truest sense of comp.")
 *
 * The RECORDED plat polygon first, from the county boundary both the subject
 * and the sale were resolved against, and the MLS SubdivisionName only as a
 * fallback. The MLS field is typed by a listing agent and 31 of 330 priced
 * subjects carry a placeholder or a blank in it.
 *
 * MEASURED, because the first version of this comment guessed and was wrong.
 * Recorded-plat coverage over the queue's own subjects on 2026-09-10: 120 of
 * the 299 that name a subdivision also sit inside a recorded plat, and 5 of
 * the 31 that name none do. So the polygon rescues five documents, not the
 * hundred the ladder's skip counter suggested. It is still the better key
 * where both are known — a polygon does not depend on how someone typed a
 * tract name — and it costs nothing, because select.ts already resolves these
 * slugs for the adjacent-plat rung.
 *
 * Moved here from lib/pricing/match.ts on 2026-09-30 so both exemptions live in
 * one file: the ladder's same-subdivision rung and the comparability judge's
 * own-plat restoration (lib/cma/judge.ts) read the same definition.
 */
export function samePlat(subject: PlatKeys, sale: PlatKeys): boolean {
  if (subject.subdivisionSlug && sale.subdivisionSlug) {
    if (sale.subdivisionSlug === subject.subdivisionSlug) return true
    return sameOrdinaryPhaseFamily(subject.subdivisionSlug, sale.subdivisionSlug)
  }
  if (subject.subdivisionNorm) return sale.subdivisionNorm === subject.subdivisionNorm
  return false
}

/**
 * The ladders' own-plat rungs. Both the facts ladder (lib/pricing/ladder.ts) and
 * the listings ladder (lib/cma/comp-tiers.ts) name them `subdivision-*`, and a
 * sale admitted there skipped the price-tier cut by that rung's own rule.
 */
export function isOwnPlatRung(tier: string | null | undefined): boolean {
  return /^subdivision-/.test(tier ?? '')
}

/** True when the sale is the same size on the same street as the subject. */
export function sameStreetPeer(
  subject: { streetAddress: string | null | undefined; city?: string | null; sqft: number },
  sale: { address: string | null | undefined; city?: string | null; sqft: number },
): boolean {
  if (!(subject.sqft > 0) || !(sale.sqft > 0)) return false
  const a = streetKey(subject.streetAddress)
  const b = streetKey(sale.address)
  if (!a || !b || a !== b) return false
  const sc = (subject.city ?? '').trim().toLowerCase()
  const cc = (sale.city ?? '').trim().toLowerCase()
  if (sc && cc && sc !== cc) return false
  const ratio = sale.sqft / subject.sqft
  return ratio >= 1 - SAME_STREET_SIZE_BAND && ratio <= 1 + SAME_STREET_SIZE_BAND
}
