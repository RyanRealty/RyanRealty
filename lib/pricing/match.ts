/**
 * Pure pricing matcher. Given a subject and a candidate pool (already fetched),
 * walk the 3/6/9 → distance → similar-subdivision ladder. No I/O.
 */

import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { communityForAddress, memberPlatMap, saleInsideSubjectCommunity } from '@/lib/cma/community-location'
import { isResortCommunity } from '@/lib/cma/resort-guard'
import { resolvePriceAnchor, samePlat, sameStreetPeer, streetKey, type PriceAnchor } from '@/lib/pricing/price-anchor'
import { closedSaleDomTotal } from '@/lib/cma/listing-history-line'
import { differentPlatAboveOwnPlatHigh, saleSetsThePrice } from '@/lib/pricing/price-set'
import { RANGE_REVIEW_SHARE } from '@/lib/pricing/review'
import { ageRestrictedMismatch, ownPlatAgeRestrictedShare } from '@/lib/pricing/age-restricted'
import { distanceMiles, proximityLabel, resolveMarketArea } from '@/lib/cma/market-area'
import { roomCountsDecision } from '@/lib/pricing/room-ground'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import { crossesNamedRiver } from '@/lib/pricing/river-cross'
import {
  classifyAgeBand,
  customLotCompatible,
  hoaCompatible,
  horseInfrastructureCompatible,
  irrigationClassFromRemarks,
  irrigationCompatible,
  isCustomOrNewSubject,
  dropsResaleVersusNewBuild,
  lotCompatible,
  plausibleListedClose,
  productCompatible,
  resolveIrrigationClass,
  sewerCompatible,
  sewerPlatNote,
  waterCompatible,
  yearQualityCompatible,
  type HoaClass,
  type IrrigationClass,
  type LotClass,
  type ProductKey,
  type SewerClass,
  type StoryClass,
  type WaterClass,
} from '@/lib/pricing/classes'
import {
  keepEarlierRungSales,
  PRICING_MAX_COMPS,
  PRICING_MIN_COMPS,
  PRICING_TARGET_COMPS,
  pricingTierLadder,
  type AppleStrictness,
  type PricingTier,
  BOUNDARY_EXIT_BELOW,
  isClusterPocket,
  isGeographyWidenTier,
  isPocketExclusiveTier,
  pocketStopsLaterRungs,
  pocketStarvedForYearQuality,
} from '@/lib/pricing/ladder'
import { outbuildingsCompatible, terrainCompatible, zoningClassCompatible, type RuralSplitCounts } from '@/lib/pricing/rural'
import {
  applyInferredPocket,
  inferPocketForPricingWalk,
  saleInExclusivePocket,
  type InferredPocket,
} from '@/lib/pricing/infer-pocket'

export type PricingSubject = {
  listingKey: string | null
  streetAddress: string
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number
  lotAcres: number | null
  yearBuilt: number | null
  storyClass: StoryClass
  productClass: ProductKey
  waterClass: WaterClass
  sewerClass: SewerClass
  hoaClass: HoaClass
  lotClass: LotClass
  ruralAcreage: boolean
  /** City of Bend GIS mesh slug, or null outside every polygon. */
  marketArea?: string | null
  /** County plat the subject sits in (boundaries.geo_slug), for the adjacency rung. */
  subdivisionSlug?: string | null
  /**
   * Plats that touch the subject's, closest first. A parent community still
   * refuses one that sits outside that community. Empty when the point is in
   * no plat or the ring read failed; the adjacent rung then skips.
   */
  adjacentSubdivisionSlugs?: string[]
  /**
   * Other plats inside the parent, nearest first. Not the subject's plat and
   * not the touching ring. Undefined lets the walk derive this from the pool.
   * An empty list means the crawl has nowhere to go.
   */
  closerSubdivisionSlugs?: string[]
  newConstruction?: boolean | null
  /** MLS property_sub_type — "New Construction" classifies even when YN is null. */
  propertySubType?: string | null
  /** Zoning of record. Hard cut only when both sides have a non-empty string. */
  zoning?: string | null
  publicRemarks?: string | null
  /** The MLS SeniorCommunityYN field. True is age-restriction evidence; false or null is not evidence. */
  seniorCommunityYn?: boolean | null
  /**
   * Share of the sales in this home's own plat that are age-restricted,
   * measured once over the ladder's pool (walkPricingLadder). Above half, the
   * plat IS a 55+ community and its 55+ sales price this home
   * (lib/pricing/age-restricted.ts). Undefined outside the ladder walk.
   */
  ownPlatAgeRestrictedShare?: number | null
  /** Subject irrigation from remarks and/or OWRD. Sales use remarks only. */
  irrigationClass?: IrrigationClass | null
  /**
   * Mapped tract names in the street-cluster / inferred pocket.
   * Named MLS tracts and a blank MLS name both use the quarter-mile pocket.
   * The pocket-* rungs match these; the home name uses subdivision-*.
   */
  pocketSubdivisionNorms?: string[]
  /** Street keys in the inferred / named cluster (canter, horse, ranch). */
  pocketStreetKeys?: string[]
  /** Set when a blank MLS tract was filled from a plat or nearest neighbor. */
  inferredPocket?: InferredPocket | null
  /** County plat label from getSubdivisionRing — not an MLS SubdivisionName. */
  platLabel?: string | null
  /**
   * Community whose boundary contains this lat/lng. Not an MLS SubdivisionName.
   * Null with communityLocated means the address sits in no community.
   */
  communitySlug?: string | null
  /** Lat/lng was tested against community boundaries. */
  communityLocated?: boolean
  /** Every recorded plat polygon that contains the subject. Not the MLS name. */
  containingPlatSlugs?: readonly string[] | null
  /** Plat slugs that sit inside the subject's community. Location, not a name list. */
  communityMemberPlats?: string[]
}

export type PricingSale = {
  listingKey: string
  listNumber: string | null
  address: string
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number
  lotAcres: number | null
  yearBuilt: number | null
  storyClass: StoryClass
  productClass: ProductKey
  waterClass: WaterClass
  sewerClass: SewerClass
  hoaClass: HoaClass
  lotClass: LotClass
  closePrice: number
  closeDate: string
  concessionsAmount: number | null
  concessionsYn: string | null
  originalAsk: number | null
  lastAsk: number | null
  daysToOffer: number | null
  cdom: number | null
  /** First on-market / list date when known — enables calendar DOM for closed comps. */
  onMarketDate?: string | null
  dropCount: number
  closePpsf: number
  photoUrl: string | null
  publicRemarks: string | null
  /**
   * The MLS SeniorCommunityYN field, read from listings (sale_pricing_facts
   * does not carry it). True is age-restriction evidence; false or null is not.
   */
  seniorCommunityYn?: boolean | null
  marketArea?: string | null
  /** County plat the sale sits in (boundaries.geo_slug); set by the selector for the adjacency rung. */
  subdivisionSlug?: string | null
  /** Community boundary that contains this sale's lat/lng. Not the MLS name. */
  communitySlug?: string | null
  /** Lat/lng was tested against community boundaries. */
  communityLocated?: boolean
  /** Every recorded plat polygon that contains the sale. Not the MLS name. */
  containingPlatSlugs?: readonly string[] | null
  newConstruction?: boolean | null
  zoning?: string | null
}

export type SubdivisionCell = {
  medianPpsf: number
  n: number
}

export type SelectedPricingComp = PricingSale & {
  selectionTier: string
  proximity: string | null
  monthsBeforeAsOf: number
  /**
   * Which room counts differ from the subject on a sale the selector admitted
   * anyway (Matt 2026-09-10: adjust inside, wall outside). The document
   * discloses it, and the accuracy contract reads it instead of re-applying
   * the wall the selector deliberately opened.
   */
  roomDifference?: Array<'beds' | 'baths'> | null
  /**
   * True when the sale sits in the subject's own plat by the same-subdivision
   * rung's own test (inSubjectPlat), whichever rung admitted it. The comparability
   * judge reads it: a sale in the subject's own plat may not be dropped on price
   * tier (Matt 2026-09-10, the first of the two exemptions).
   */
  ownPlat?: boolean
  /**
   * Set when this sale stays inside the recorded plat even though its sewer
   * is not the subject's. The letter prints it. Absent when they match, when
   * either is unknown, or when the sale is outside the plat.
   */
  sewerNote?: string | null
}

/**
 * One rung of the facts ladder, as COUNTS (round four, class E).
 *
 * `trace` says the same thing in prose ("subdivision-6mo: +3 (running 5)") and
 * `tiersUsed` says only that a rung fired. Neither can be read to answer "how
 * many of these sales came from inside the subdivision", which is the question
 * cma-2465-7th-redmond-97756 answered wrongly in a chapter heading. One row
 * per rung the ladder WALKED, whether it added anything or not.
 */
export type PricingLadderRung = {
  tier: string
  /** False when the rung was skipped before it ran (no subdivision, not rural). */
  ran: boolean
  skippedReason: string | null
  monthsBack: number
  /** Candidate sales the rung scanned. */
  scanned: number
  /** New sales it contributed to the pool. */
  added: number
  /** Distinct sales held after it. */
  runningTotal: number
}

export type PricingMatchResult = {
  comps: SelectedPricingComp[]
  /** The $/sqft tier every comp was graded against, or null when none could be
   *  resolved — meaning nothing cut a comp on price on this build. */
  priceAnchor?: PriceAnchor | null
  tiersUsed: string[]
  trace: string[]
  reachedTarget: boolean
  starved: boolean
  /** Every rung the ladder walked, in order. */
  rungs: PricingLadderRung[]
  /**
   * On acreage: how many rural sales in the pool each hard split set aside,
   * counted once over the pool (the rungs reject inside passesTier without a
   * reason). Absent for in-town subjects.
   */
  ruralSplits?: RuralSplitCounts
  /** Present when a blank SubdivisionName was filled, or a named tract collected its street cluster. */
  inferredPocket?: InferredPocket | null
  /** The own-plat age-restricted share the walk graded against (PricingSubject). */
  ownPlatAgeRestrictedShare?: number | null
  /**
   * Closed sales held from own-street / own-plat / street-cluster rungs.
   * Geography widening is skipped when closed+pending is a tight set.
   */
  exclusiveCount?: number
  /**
   * True when exclusive closed sales sit below POCKET_STARVE_BELOW (5).
   * Year/quality outranks radius only then (rural/custom).
   */
  pocketStarved?: boolean
}

function monthsBetween(laterIso: string, earlierIso: string): number {
  const ms = new Date(laterIso).getTime() - new Date(earlierIso).getTime()
  return ms / (30.44 * 86_400_000)
}

function ageOk(subjectYear: number | null, compYear: number | null, asOfYear: number, maxYears: number | null): boolean {
  if (maxYears == null) return true
  if (subjectYear == null || compYear == null) return true
  const a = classifyAgeBand(subjectYear, asOfYear)
  const b = classifyAgeBand(compYear, asOfYear)
  if (a === 'unknown' || b === 'unknown') return true
  return Math.abs(subjectYear - compYear) <= maxYears
}

function storyOk(subject: StoryClass, comp: StoryClass, requireSame: boolean): boolean {
  if (!requireSame) return true
  if (subject === 'unknown' || comp === 'unknown') return true
  return subject === comp
}

function slopOk(subject: number | null, comp: number | null, slop: number | null): boolean {
  if (slop == null) return true
  if (subject == null || comp == null) return true
  return Math.abs(subject - comp) <= slop
}

function normalizeZoning(raw: string | null | undefined): string | null {
  const s = raw?.trim().toUpperCase() ?? ''
  return s || null
}

function zoningCompatible(subjectZone: string | null | undefined, saleZone: string | null | undefined): boolean {
  const a = normalizeZoning(subjectZone)
  const b = normalizeZoning(saleZone)
  if (!a || !b) return true
  return a === b
}

function applesOk(
  subject: PricingSubject,
  sale: PricingSale,
  level: AppleStrictness,
  asOfYear?: number,
  /**
   * The one rung that may cross a highway or a river: the starved widening, on
   * a subject with no mapped boundary (Matt 2026-09-09, "when a crossing is the
   * only way to reach three sales, take it and say so"). Every other rung
   * treats both as walls.
   */
  allowFeatureCross = false,
): boolean {
  if (!productCompatible(subject.productClass, sale.productClass)) return false
  // AGE-RESTRICTED HOUSING IS A DIFFERENT PRODUCT (lib/pricing/age-restricted.ts,
  // 2026-09-30). A 55+ sale off the subject's own plat walls on every rung
  // unless the subject is 55+ itself. Inside the plat it passes here, and the
  // build decides once it can see how much of the plat is 55+.
  // The subject and the sale go in as the records the walk holds, so each is
  // read once per walk however many rungs grade it (isAgeRestricted's memo).
  if (
    ageRestrictedMismatch({
      subject,
      sale,
      saleInOwnPlat: inSubjectPlat(subject, sale),
      ownPlatShare: subject.ownPlatAgeRestrictedShare,
    })
  ) {
    return false
  }
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  // ONE ROOM RULE for beds and baths alike, custom/new included
  // (Matt 2026-09-10, skill 0.1). Same function the comparability review uses.
  if (!roomCountsDecision(subject, sale).ok) return false
  if (customOrNew) {
    if (!customLotCompatible(subject.lotAcres, sale.lotAcres)) return false
  } else {
    if (!lotCompatible(subject.lotAcres, sale.lotAcres)) return false
  }
  if (!resortCommunityCompatible(subject.subdivision, sale.subdivision)) return false
  // Water stays hard on every rung. A well house and a city-water house are
  // different products; widening distance does not make them comparable.
  // Sewer is hard outside the recorded plat. Inside it, septic and public
  // sewer both stay and the letter names which is which. Unknown still stays.
  if (!waterCompatible(subject.waterClass, sale.waterClass)) return false
  if (
    !sewerCompatible(subject.sewerClass, sale.sewerClass) &&
    !saleInsideSubjectCommunity(subject, sale)
  ) {
    return false
  }
  if (crossesMajorDivide(subject.marketArea, sale.marketArea)) return false
  // The highway cut, and the one exception Matt named: on a subject with no
  // mapped boundary, the starved widening rung may cross when a crossing is
  // the only way to reach three sales, and the report says so.
  const crossesHighway =
    crossesUs97(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    ) ||
    differentUs97Bank(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    )
  if (crossesHighway && !allowFeatureCross) {
    return false
  }
  // A RIVER IS A WALL WHERE NOTHING ELSE IS (Matt 2026-09-09: "if we're in a
  // city that doesn't really have that, then we use other major things to
  // constrain us, like major roadways, rivers"). Redmond, La Pine, Sisters and
  // Prineville sit outside the Bend GIS mesh, so until now a search there was
  // held only by city and radius. The named rivers hold it in. Bend is already
  // held by its polygon, so this adds nothing there. The starved widening rung
  // is the one place a crossing is allowed, and it discloses it.
  if (
    subject.marketArea == null &&
    !allowFeatureCross &&
    crossesNamedRiver(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    )
  ) {
    return false
  }
  // Unmapped rural vs a mapped Parkway/Deschutes bank: keep for ordinary
  // acreage. Custom/new outside the Bend GIS mesh (Rim View / North Rim) must
  // still reach year-quality peers that land inside Awbrey Butte — inventing a
  // bank from a null mesh starves the set. Both-mapped bank crosses still die
  // above via crossesMajorDivide.
  if (
    !customOrNew &&
    subject.ruralAcreage &&
    unmappedCrossesKnownBank(subject.marketArea, sale.marketArea)
  ) {
    return false
  }
  const subjectIrrigation = resolveIrrigationClass(subject.publicRemarks, null, subject.irrigationClass)
  const saleIrrigation = irrigationClassFromRemarks(sale.publicRemarks)
  if (!irrigationCompatible(subjectIrrigation, saleIrrigation)) return false
  if (subject.ruralAcreage || (subject.lotAcres ?? 0) >= 1) {
    if (!horseInfrastructureCompatible(subject.publicRemarks, sale.publicRemarks)) return false
    // Delta 4 (Matt 2026-09-09): outside a boundary the comparison is of the
    // property. Zoning CLASS, outbuildings and usable land are hard splits,
    // never dollar adjustments; every side that is unknown keeps the sale.
    if (!zoningClassCompatible(subject.zoning, sale.zoning)) return false
    if (!outbuildingsCompatible(subject.publicRemarks, sale.publicRemarks)) return false
    if (!terrainCompatible(subject.publicRemarks, sale.publicRemarks)) return false
  } else if (!zoningCompatible(subject.zoning, sale.zoning)) {
    return false
  }
  if (level === 'product_lot' || level === 'utilities') return true
  return hoaCompatible(subject.hoaClass, sale.hoaClass)
}

function passesTier(
  subject: PricingSubject,
  sale: PricingSale,
  tier: PricingTier,
  asOf: string,
  _cells: Map<string, SubdivisionCell>,
  /**
   * Kept on the signature so callers still pass the neighborhood anchor.
   * A median does not remove a sale.
   */
  _anchor: PriceAnchor | null = null,
): { ok: boolean; miles: number | null; roomDifference?: Array<'beds' | 'baths'> | null; sewerNote?: string | null } {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return { ok: false, miles: null }
  if (subject.streetAddress && sale.address.toLowerCase() === subject.streetAddress.toLowerCase()) {
    return { ok: false, miles: null }
  }
  if (sale.closeDate >= asOf) return { ok: false, miles: null }
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return { ok: false, miles: null }
  if (monthsBetween(asOf, sale.closeDate) > tier.monthsBack) return { ok: false, miles: null }
  if (!tier.ignoreCity && sale.citySlug !== subject.citySlug) return { ok: false, miles: null }
  const onOwnStreet = sameStreetPeer(
    { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
    { address: sale.address, city: sale.city, sqft: sale.sqft },
  )
  if (tier.sameStreetOnly && !onOwnStreet) return { ok: false, miles: null }
  // The subject's own street is its own ground for every rule below, exactly as
  // its own plat is.
  const ownPlat = tier.sameSubdivision === true || tier.sameStreetOnly === true
  // Street-cluster subjects: "same subdivision" means the exclusive Canter /
  // Horse Back / Ranch pocket, not every Black Butte home that shares the
  // catch-all SaddleStone MLS name (Matt Flex HARD LOCK 2026-09-15).
  if (tier.sameSubdivision && !inSubjectPlat(subject, sale)) return { ok: false, miles: null }
  // THE PARENT IS THE WALL. A home inside a community (Tetherow, Caldera
  // Springs, Broken Top) or a neighborhood (Awbrey Butte, River West) never
  // takes a sale outside that parent. Not on a distance ring, not when the
  // set is short, not from another resort. A subject with neither is unaffected.
  const subjectCommunity = communityForAddress(subject)
  const saleCommunity = communityForAddress(sale, memberPlatMap(subjectCommunity, subject.communityMemberPlats))
  const confined = parentConfines(subject)
  const crossesCommunity = !confined && (Boolean(tier.crossBoundary) || Boolean(tier.whenStarved))
  if (tier.sameCommunity) {
    if (!subjectCommunity || saleCommunity !== subjectCommunity) return { ok: false, miles: null }
  } else if (tier.likeCommunity) {
    // A parent is never left for a peer resort. The peer rung remains only
    // for a home that sits in no neighborhood and no community.
    if (confined) return { ok: false, miles: null }
    if (!subjectCommunity || !isResortCommunity(subjectCommunity)) return { ok: false, miles: null }
    if (!saleCommunity || saleCommunity === subjectCommunity || !isResortCommunity(saleCommunity)) {
      return { ok: false, miles: null }
    }
  } else if (subjectCommunity && saleCommunity !== subjectCommunity && !crossesCommunity) {
    return { ok: false, miles: null }
  } else if (!subjectCommunity && saleCommunity && !crossesCommunity) {
    // Symmetric: a community sale carries that community's premium, so it does
    // not price an ordinary plat next door either.
    return { ok: false, miles: null }
  }
  // A named plat with no parent does not take a different named plat off a
  // distance ring or the 10-mile widen. Adjacent and closer rungs already
  // walked those plats. A sale with no plat name can still be the house next
  // door. A parent neighborhood or community is a separate wall, above: inside
  // that parent a nearby ring may still take another plat (Kenwood taking
  // Aubrey, a custom peer farther inside the same neighborhood). This wall
  // holds only when the subject sits in a plat and in no parent, which is how
  // a 10-mile rung priced a home from another neighborhood.
  if (
    !subject.ruralAcreage &&
    !confined &&
    (subject.subdivisionSlug || subject.subdivisionNorm) &&
    (isGeographyWidenTier(tier) || tier.whenStarved) &&
    namedPlatOutsideTheCrawl(subject, sale)
  ) {
    return { ok: false, miles: null }
  }
  // The plats next to the subject's, closest first.
  if (tier.adjacentSubdivision) {
    const ring = subject.adjacentSubdivisionSlugs ?? []
    if (!sale.subdivisionSlug || !ring.includes(sale.subdivisionSlug)) return { ok: false, miles: null }
  }
  if (tier.closerSubdivision) {
    const next = subject.closerSubdivisionSlugs ?? []
    if (!sale.subdivisionSlug || !next.includes(sale.subdivisionSlug)) return { ok: false, miles: null }
  }
  if (tier.samePocket) {
    const nameHit =
      Boolean(sale.subdivisionNorm) &&
      (subject.pocketSubdivisionNorms ?? []).includes(sale.subdivisionNorm!)
    const saleStreet = streetKey(sale.address)
    const streetHit = Boolean(saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet))
    if (!nameHit && !streetHit) return { ok: false, miles: null }
  }
  const sqftLo = subject.sqft * (1 - tier.sqftBand)
  const sqftHi = subject.sqft * (1 + tier.sqftBand)
  if (sale.sqft < sqftLo || sale.sqft > sqftHi) return { ok: false, miles: null }

  const asOfYear = Number(asOf.slice(0, 4))
  const allowFeatureCross = Boolean(tier.whenStarved) && subject.marketArea == null
  if (!applesOk(subject, sale, tier.apples, asOfYear, allowFeatureCross)) {
    return { ok: false, miles: null }
  }
  // ONE ROOM RULE (skill 0.1). Same function the review uses. Own-plat is own
  // ground, so one room apart is noted; two or more is refused everywhere.
  const rooms = roomCountsDecision(subject, { ...sale, ownPlat: ownPlat || inSubjectPlat(subject, sale) })
  if (!rooms.ok) return { ok: false, miles: null }
  if (!ownPlat && !ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, tier.ageYears)) {
    return { ok: false, miles: null }
  }
  if (!ownPlat && !storyOk(subject.storyClass, sale.storyClass, tier.sameStory)) {
    return { ok: false, miles: null }
  }
  // Beds and baths are decided by the ONE ROOM RULE above. The per-tier
  // bedSlop/bathSlop numbers no longer gate anything: a rung cannot be looser
  // than the room rule, and a rung that was tighter (bedSlop 1 on a faraway
  // rung) was re-imposing the wall the rule deliberately opened.

  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  // Custom/new uses the 15-year generation band. The 0–2 year new-vs-resale
  // cut would drop a 2022 custom peer for a 2024 custom subject.
  // Exclusive pocket rungs skip year/quality so a 2025 Canter new-build
  // still takes 1058 E Ranch / 1025 E Horse Back until the pocket is starved.
  const skipYearQualityOnExclusive = isPocketExclusiveTier(tier) && isClusterPocket(subject)
  if (
    !skipYearQualityOnExclusive &&
    dropsResaleVersusNewBuild(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return { ok: false, miles: null }
  }
  if (
    !skipYearQualityOnExclusive &&
    !yearQualityCompatible(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return { ok: false, miles: null }
  }

  // A rung that leaves the subdivision still stays inside the parent's polygon.
  // A neighborhood median does not remove a sale.
  if (!tier.sameSubdivision) {
    const subjectArea = subject.marketArea ?? resolveMarketArea(subject.latitude, subject.longitude) ?? null
    const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude, sale.longitude) ?? null
    const customPeer = isCustomOrNewSubject(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
      },
      asOfYear,
    )
    // Mapped vs unmapped is a different market for ordinary resale. Custom/new
    // subjects outside the Bend GIS mesh still keep year-quality peers that
    // resolve into a neighboring polygon (North Rim → Awbrey Butte). True
    // Parkway/Deschutes crosses stay hard in applesOk.
    // A touching plat is the adjacent step even when a neighborhood line
    // splits it from the subject. Anything farther stays inside the parent's
    // polygon. A home with no parent may still cross on the boundary-exit
    // rung, into another mapped polygon, never into unmapped land.
    const touchingAdjacent = tier.adjacentSubdivision === true
    const customOutsideMesh = customPeer && !subject.marketArea
    const mayCrossArea = !confined && Boolean(tier.crossBoundary) && saleArea != null
    if (subjectArea !== saleArea && !touchingAdjacent && !customOutsideMesh && !mayCrossArea) {
      return { ok: false, miles: null }
    }
  }

  const miles = distanceMiles(
    { lat: subject.latitude, lng: subject.longitude },
    { lat: sale.latitude, lng: sale.longitude },
  )
  if (tier.maxMiles != null) {
    if (miles == null || miles > tier.maxMiles) return { ok: false, miles }
  }
  const sewerNote = saleInsideSubjectCommunity(subject, sale)
    ? sewerPlatNote(subject.sewerClass, sale.sewerClass, sale.address)
    : null
  return {
    ok: true,
    miles,
    roomDifference: rooms.notes.length > 0 ? rooms.notes : null,
    sewerNote,
  }
}

const GLA_BRACKET_BAND = 0.25
/**
 * A GLA swap may replace a same-plat sale with a different plat inside the
 * one-mile ring, which is the gap the bracket exists to close. It may not
 * reach the two-mile ring to do it. 4570 Yew is 1.89 miles from 3028 Indian;
 * that swap dropped same-plat 2834 Indian.
 */
const BRACKET_OFF_PLAT_MAX_MILES = 1

function toSelected(subject: PricingSubject, sale: PricingSale, asOf: string, tierName: string): SelectedPricingComp {
  return {
    ...sale,
    selectionTier: tierName,
    ownPlat: inSubjectPlat(subject, sale),
    proximity: proximityLabel(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ),
    monthsBeforeAsOf: +monthsBetween(asOf, sale.closeDate).toFixed(1),
  }
}

function glaWithinBand(subjectSqft: number, saleSqft: number, band: number): boolean {
  return saleSqft >= subjectSqft * (1 - band) && saleSqft <= subjectSqft * (1 + band)
}

function saleMiles(subject: PricingSubject, sale: PricingSale): number {
  return (
    distanceMiles(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ) ?? 0
  )
}

/**
 * The oldest sale the GLA bracket may reach for. Matches COMP_MAX_AGE_MONTHS in
 * lib/cma/contract.ts, which hard-fails a build carrying anything older.
 */
const BRACKET_MAX_AGE_MONTHS = 24

/**
 * THE SAME-SUBDIVISION RUNG'S MEMBERSHIP TEST, as one function. A street-cluster
 * subject's "same subdivision" is its exclusive pocket (Canter / Horse Back /
 * Ranch, not every Black Butte home under the catch-all MLS name); everyone
 * else's is its own plat (samePlat in lib/pricing/price-anchor.ts, the recorded
 * polygon first and the MLS name as the fallback). The rung, the age-restricted
 * wall, and the `ownPlat` stamp every selected sale carries all read this.
 */
function inSubjectPlat(subject: PricingSubject, sale: PricingSale): boolean {
  return isClusterPocket(subject) ? saleInExclusivePocket(subject, sale) : samePlat(subject, sale)
}

/**
 * True when this sale is a recorded or named plat the crawl did not already
 * treat as the subject's own, a touching plat, or the next plat inside the
 * parent. A blank MLS name is not another plat.
 */
function namedPlatOutsideTheCrawl(subject: PricingSubject, sale: PricingSale): boolean {
  if (inSubjectPlat(subject, sale)) return false
  const saleSlug = sale.subdivisionSlug ?? null
  if (saleSlug && subject.subdivisionSlug && saleSlug === subject.subdivisionSlug) return false
  if (saleSlug && (subject.adjacentSubdivisionSlugs ?? []).includes(saleSlug)) return false
  if (saleSlug && (subject.closerSubdivisionSlugs ?? []).includes(saleSlug)) return false
  const saleNorm = sale.subdivisionNorm?.trim() || null
  if (!saleSlug && !saleNorm) return false
  if (saleNorm && subject.subdivisionNorm && saleNorm === subject.subdivisionNorm) return false
  return true
}

function bracketEligible(
  subject: PricingSubject,
  sale: PricingSale,
  asOf: string,
  wantLarger: boolean,
  _anchor: PriceAnchor | null = null,
  _cells: Map<string, SubdivisionCell> = new Map(),
): boolean {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return false
  if (subject.streetAddress && sale.address.toLowerCase() === subject.streetAddress.toLowerCase()) return false
  if (sale.closeDate >= asOf) return false
  // THE BRACKET SWAP OBEYS THE SAME 24-MONTH WALL AS EVERY RUNG. It checked
  // only that the sale was not in the future, so on a custom or new subject —
  // whose pool reaches back thirty months — it could import a sale the accuracy
  // contract then hard-fails as older than 24 months, and the whole build died
  // on a comp the swap itself had chosen (cma-63531-gentry, 2026-09-10).
  if (monthsBetween(asOf, sale.closeDate) > BRACKET_MAX_AGE_MONTHS) return false
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return false
  const asOfYear = Number(asOf.slice(0, 4))
  if (!applesOk(subject, sale, 'product_lot', asOfYear)) return false
  if (
    dropsResaleVersusNewBuild(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return false
  }
  if (
    !yearQualityCompatible(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return false
  }
  if (!glaWithinBand(subject.sqft, sale.sqft, GLA_BRACKET_BAND)) return false
  if (wantLarger) return sale.sqft > subject.sqft
  return sale.sqft < subject.sqft
}

/**
 * After the ladder: if every kept sale sits on one side of the subject's GLA
 * and the unused pool already has an apples sale on the other side inside
 * ±25%, swap out the farthest same-side sale. Never invents a comp.
 */
function bracketGla(
  subject: PricingSubject,
  comps: SelectedPricingComp[],
  pool: PricingSale[],
  asOf: string,
  anchor: PriceAnchor | null = null,
  cells: Map<string, SubdivisionCell> = new Map(),
  customLadder = false,
): { comps: SelectedPricingComp[]; note: string | null } {
  if (comps.length === 0) return { comps, note: null }
  const allLarger = comps.every((c) => c.sqft > subject.sqft)
  const allSmaller = comps.every((c) => c.sqft < subject.sqft)
  if (!allLarger && !allSmaller) return { comps, note: null }

  const kept = new Set(comps.map((c) => c.listingKey))
  const wantLarger = allSmaller
  const candidates = pool.filter(
    (sale) => !kept.has(sale.listingKey) && bracketEligible(subject, sale, asOf, wantLarger, anchor, cells),
  )
  if (candidates.length === 0) return { comps, note: null }

  candidates.sort((a, b) => {
    const size = Math.abs(a.sqft - subject.sqft) - Math.abs(b.sqft - subject.sqft)
    if (size !== 0) return size
    return b.closeDate.localeCompare(a.closeDate)
  })
  // A size swap may not spend the recorded plat to import a sale from outside it.
  const removable = comps.filter((c) => !saleInsideSubjectCommunity(subject, c))
  if (removable.length === 0) return { comps, note: null }
  const outgoing = removable.reduce((worst, c) => {
    const size = Math.abs(c.sqft - subject.sqft) - Math.abs(worst.sqft - subject.sqft)
    if (size > 0) return c
    if (size < 0) return worst
    return saleMiles(subject, c) > saleMiles(subject, worst) ? c : worst
  })
  // Price the replacement against the set that still holds `outgoing`. A
  // different plat that fails does not take the seat, so the last own-plat
  // sale cannot be deleted and then leave the check with nothing to measure.
  const incoming = candidates.find((sale) => bracketMayReplace(subject, outgoing, sale, comps, customLadder))
  if (!incoming) return { comps, note: null }

  const next = comps.filter((c) => c.listingKey !== outgoing.listingKey)
  next.push(toSelected(subject, incoming, asOf, 'gla-bracket'))
  return {
    comps: next,
    note: `GLA bracket: replaced ${outgoing.address} (${outgoing.sqft} sqft) with ${incoming.address} (${incoming.sqft} sqft) so the set is not all ${allLarger ? 'larger' : 'smaller'} than the subject.`,
  }
}

/**
 * A different plat may take the place of a same-plat sale only inside a mile,
 * and only when its close is not more than 8% above the highest own-plat close
 * still in the set. The high is read before the outgoing sale is removed.
 * A same-plat replacement is not distance-blocked and skips the ceiling.
 * Custom and new subjects skip the ceiling, as they do on the walk.
 */
function bracketMayReplace(
  subject: PricingSubject,
  outgoing: SelectedPricingComp,
  incoming: PricingSale,
  kept: readonly PricingSale[],
  customLadder: boolean,
): boolean {
  const samePlatIncoming = inSubjectPlat(subject, incoming)
  if (outgoing.ownPlat && !samePlatIncoming && saleMiles(subject, incoming) > BRACKET_OFF_PLAT_MAX_MILES) {
    return false
  }
  if (samePlatIncoming || customLadder) return true
  return closeNearOwnPlat(subject, incoming, kept)
}

/**
 * Once an own-plat sale is in the set, a different plat more than 8% above
 * the highest own-plat close does not enter. A close under that sale stays.
 * No own-plat close yet returns true, so the first comp can enter.
 * The high is read on the kept set that still includes the own-plat sale
 * being replaced. Removing that sale first leaves the check with nothing to measure.
 */
function closeNearOwnPlat(
  subject: PricingSubject,
  sale: PricingSale,
  kept: Iterable<PricingSale>,
): boolean {
  const closes: number[] = []
  for (const row of kept) {
    if (inSubjectPlat(subject, row)) closes.push(row.closePrice)
  }
  return !differentPlatAboveOwnPlatHigh(sale.closePrice, closes)
}

/**
 * No own-plat close was kept. A different-plat pocket sale still has to sit
 * with the comps that were kept. One that closes under every one of them is
 * a cheaper house. Same-plat sales are not in this pass. Custom and new
 * subjects skip it. When an own-plat sale is kept, the caller uses the
 * own-plat high instead.
 */
function pocketSalesSitWithKept(
  comps: SelectedPricingComp[],
  customLadder: boolean,
): SelectedPricingComp[] {
  if (customLadder || comps.length === 0) return comps
  if (comps.some((c) => c.ownPlat)) return comps
  return comps.filter((sale) => {
    if (!sale.selectionTier.startsWith('pocket-') || !(sale.closePrice > 0)) return true
    const others = comps.filter((row) => row.listingKey !== sale.listingKey && row.closePrice > 0)
    if (others.length === 0) return true
    const cheapestOther = Math.min(...others.map((row) => row.closePrice))
    return sale.closePrice >= cheapestOther
  })
}

function similarity(subject: PricingSubject, sale: PricingSale, asOf: string, pocketStarved: boolean): number {
  const size = 1 / (1 + Math.abs(sale.sqft - subject.sqft) / subject.sqft)
  const recency = 1 / (1 + monthsBetween(asOf, sale.closeDate) / 9)
  const age =
    subject.yearBuilt != null && sale.yearBuilt != null
      ? 1 / (1 + Math.abs(subject.yearBuilt - sale.yearBuilt) / 20)
      : 0.85
  const story = subject.storyClass !== 'unknown' && subject.storyClass === sale.storyClass ? 1 : 0.75
  const miles =
    distanceMiles(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ) ?? 2
  const dist = 1 / (1 + miles / 2)
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    Number(asOf.slice(0, 4)),
  )
  // Year + quality outrank radius ONLY when the exclusive pocket is starved
  // (Matt 2026-09-15). A named SaddleStone pocket with Horse Back / Ranch
  // sales must not lose to farther Clearpine / Forest Edge on vintage.
  if (customOrNew && pocketStarved) {
    return size * 0.26 + recency * 0.20 + age * 0.28 + story * 0.14 + dist * 0.12
  }
  return size * 0.28 + recency * 0.22 + age * 0.16 + story * 0.16 + dist * 0.18
}


/** A neighborhood polygon or a community boundary confines the search. */
function parentConfines(subject: PricingSubject): boolean {
  return Boolean(subject.marketArea) || Boolean(communityForAddress(subject))
}

function saleInsideParent(subject: PricingSubject, sale: PricingSale): boolean {
  const subjectCommunity = communityForAddress(subject)
  if (subjectCommunity) {
    return communityForAddress(sale, memberPlatMap(subjectCommunity, subject.communityMemberPlats)) === subjectCommunity
  }
  if (subject.marketArea) {
    const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude, sale.longitude)
    return saleArea === subject.marketArea
  }
  return true
}

/**
 * Other plats inside the parent, nearest to the subject first. The touching
 * ring is the adjacent step and is not repeated here.
 */
function deriveCloserSubdivisionSlugs(subject: PricingSubject, pool: readonly PricingSale[]): string[] {
  const own = subject.subdivisionSlug ?? null
  const adjacent = new Set(subject.adjacentSubdivisionSlugs ?? [])
  const best = new Map<string, number>()
  for (const sale of pool) {
    const slug = sale.subdivisionSlug
    if (!slug || slug === own || adjacent.has(slug)) continue
    if (!saleInsideParent(subject, sale)) continue
    const miles =
      distanceMiles(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: sale.latitude, lng: sale.longitude },
      ) ?? 99
    const prev = best.get(slug)
    if (prev == null || miles < prev) best.set(slug, miles)
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([slug]) => slug)
}

export function walkPricingLadder(
  rawSubject: PricingSubject,
  pool: PricingSale[],
  opts: {
    asOf: string
    cells?: Map<string, SubdivisionCell>
    tiers?: PricingTier[]
    /** Pending listings in the same pocket — hold exclusivity, never enter the closed set. */
    pendingPool?: PricingSale[]
  },
): PricingMatchResult {
  const inferred = inferPocketForPricingWalk(rawSubject, pool)
  const subject = applyInferredPocket({ ...rawSubject }, inferred)
  // Whether this home's own plat is a 55+ community, read off the plat's own
  // sales in the pool, once, before any rung grades a sale against it.
  subject.ownPlatAgeRestrictedShare = ownPlatAgeRestrictedShare(pool.filter((s) => inSubjectPlat(subject, s)))
  if (subject.closerSubdivisionSlugs == null) {
    subject.closerSubdivisionSlugs = deriveCloserSubdivisionSlugs(subject, pool)
  }
  const asOf = opts.asOf.slice(0, 10)
  const cells = opts.cells ?? new Map()
  // The subject's price tier, resolved once. Only consulted where its own plat
  // cell is missing or thin — a subject WITH a real cell is graded exactly as
  // before (lib/pricing/price-anchor.ts).
  const priceAnchor = resolvePriceAnchor(subject, pool)
  const asOfYearForLadder = Number(asOf.slice(0, 4))
  const customLadder = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYearForLadder,
  )
  const tiers = opts.tiers ?? pricingTierLadder({ customOrNew: customLadder })
  const byKey = new Map<string, SelectedPricingComp>()
  /** Sales already held, so one closed sale cannot enter a set twice. */
  const bySale = new Set<string>()
  const rungs: PricingLadderRung[] = []
  const tiersUsed: string[] = []
  let exclusiveCount = 0
  const exclusivePending = (opts.pendingPool ?? []).filter((p) => saleInExclusivePocket(subject, p)).length
  const trace: string[] = [
    `As-of ${asOf}. Named subdivision and its street cluster first (own street, same plat, pocket names and streets), exclusive while that set holds a tight closed+pending group. Then the plats next to it inside the same neighborhood or community, then distance inside that boundary, then similar-performing subdivisions; the boundary is crossed only when it supplied fewer than ${BOUNDARY_EXIT_BELOW} sales. Year and quality outrank radius only when exclusive closed sales sit below ${BOUNDARY_EXIT_BELOW}. Hard cuts: product (townhouse ≠ condo ≠ detached), rural/urban, resort, water, sewer, whole baths, US-97/Parkway and Deschutes banks, irrigated vs dry, horse/barn infrastructure on acreage, and on acreage the zoning class (farm or forest against rural residential), outbuildings, and usable land, zoning when both sides have a zone in town, new vs resale, custom/new year-and-quality, neighborhood once the search leaves the subdivision, HOA on the tight rungs, and a 30% subdivision $/sqft tier gap.`,
  ]
  if (subject.inferredPocket?.inferred && subject.inferredPocket.subdivision) {
    trace.push(
      `MLS SubdivisionName was blank, so the search inferred ${subject.inferredPocket.subdivision} (${subject.inferredPocket.source}) before any mile ring.`,
    )
  } else if ((subject.pocketSubdivisionNorms?.length ?? 0) > 0 && subject.subdivision) {
    trace.push(
      `${subject.subdivision} is a named tract, so the search also held the ${subject.pocketSubdivisionNorms!.length} mapped pocket${subject.pocketSubdivisionNorms!.length === 1 ? '' : 's'} inside a quarter mile before any mile ring.`,
    )
  }

  if (!subject.sqft || subject.sqft < 300) {
    const note = 'Subject has no usable living area, so there is nothing to compare.'
    return { comps: [], tiersUsed, trace: [note], reachedTarget: false, starved: true, rungs }
  }

  // Delta 4: the splits, counted over the rural pool for the reader's story.
  let ruralSplits: RuralSplitCounts | undefined
  if (subject.ruralAcreage || (subject.lotAcres ?? 0) >= 1) {
    ruralSplits = { zoning_class: 0, outbuildings: 0, terrain: 0, acreage_infrastructure: 0 }
    const subjectIrrigation = resolveIrrigationClass(subject.publicRemarks, null, subject.irrigationClass)
    for (const sale of pool) {
      if ((sale.lotAcres ?? 0) < 1) continue
      if (!zoningClassCompatible(subject.zoning, sale.zoning)) ruralSplits.zoning_class++
      else if (
        !irrigationCompatible(subjectIrrigation, irrigationClassFromRemarks(sale.publicRemarks)) ||
        !horseInfrastructureCompatible(subject.publicRemarks, sale.publicRemarks)
      )
        ruralSplits.acreage_infrastructure++
      else if (!outbuildingsCompatible(subject.publicRemarks, sale.publicRemarks)) ruralSplits.outbuildings++
      else if (!terrainCompatible(subject.publicRemarks, sale.publicRemarks)) ruralSplits.terrain++
    }
    const named = Object.entries(ruralSplits).filter(([, n]) => n > 0)
    if (named.length > 0) {
      trace.push(
        `Acreage splits over the pool: ${named.map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`).join(', ')}.`,
      )
    }
  }

  // How many sales the plat and the street had before any quarter-mile pocket
  // rung. 3759 SW 45th (Redtail Ridge), rebuilt 2026-09-28: the plat already
  // held 7 sales, then pocket-9mo and pocket-12mo added 17 cheaper sales in
  // other subdivisions. keepTightestByClosePrice then kept the cheap cluster
  // and dropped every Redtail Ridge sale, including 3499 SW 44th at $790,000.
  // The Sep 7 build, before that cut, still had the plat sale. A pocket rung
  // is wider than a plat that has already filled. It must not be mixed in.
  let countBeforePocket: number | null = null
  let aboveOwnPlatHigh = 0

  for (const tier of tiers) {
    if (tier.samePocket && countBeforePocket == null) countBeforePocket = byKey.size
    if (
      tier.samePocket &&
      !tier.sameSubdivision &&
      countBeforePocket != null &&
      countBeforePocket >= PRICING_TARGET_COMPS
    ) {
      rungs.push({
        tier: tier.name,
        ran: false,
        skippedReason: `the subject's own plat already has ${countBeforePocket} sales, so the quarter-mile pocket was not mixed into the price`,
        monthsBack: tier.monthsBack,
        scanned: 0,
        added: 0,
        runningTotal: byKey.size,
      })
      continue
    }
    if (byKey.size >= PRICING_TARGET_COMPS && !isPocketExclusiveTier(tier)) {
      rungs.push({
        tier: tier.name,
        ran: false,
        skippedReason: `the search already has ${byKey.size} sales from this home's own ground, so it stopped`,
        monthsBack: tier.monthsBack,
        scanned: 0,
        added: 0,
        runningTotal: byKey.size,
      })
      continue
    }
    const skip =
      // THE WIDENING RUNS ONLY WHEN THE BOUNDED LADDER CAME UP SHORT.
      tier.whenStarved && byKey.size >= PRICING_MIN_COMPS
        ? 'the bounded search already reached the minimum, so no widening was needed'
        : tier.whenStarved &&
            pocketStopsLaterRungs({
              kept: byKey.size,
              exclusiveClosed: exclusiveCount,
              exclusivePending,
              clusterPocket: isClusterPocket(subject),
            })
          ? `the pocket already supplied a tight closed+pending set (${exclusiveCount} closed, ${exclusivePending} pending), so the search stayed exclusive`
        : tier.sameCommunity && !communityForAddress(subject)
        ? 'the subject is not inside a planned or golf community'
        : tier.likeCommunity && !isResortCommunity(communityForAddress(subject))
        ? 'the subject is not inside a golf or resort community'
        : tier.likeCommunity && byKey.size >= PRICING_MIN_COMPS
        ? 'the community supplied the minimum, so no peer community was needed'
        : tier.sameSubdivision && !subject.subdivisionSlug && !subject.subdivisionNorm
        ? 'no recorded plat holds the subject, and its MLS row names none either'
        : tier.samePocket && !(subject.pocketSubdivisionNorms?.length)
          ? 'no nearby mapped pocket cluster sits inside a quarter mile'
        : isGeographyWidenTier(tier) &&
            pocketStopsLaterRungs({
              kept: byKey.size,
              exclusiveClosed: exclusiveCount,
              exclusivePending,
              clusterPocket: isClusterPocket(subject),
            })
          ? `the pocket already supplied a tight closed+pending set (${exclusiveCount} closed, ${exclusivePending} pending), so the search stayed exclusive`
        // Street-cluster: adjacent / community / similar are also wideners once
        // Canter+Horse Back already hold — do not open Black Butte via GIS ring.
        // A cluster still short of the pricing minimum does not stop: that is
        // how a quarter-mile pair failed the build instead of walking on.
        : isClusterPocket(subject) &&
            !isPocketExclusiveTier(tier) &&
            pocketStopsLaterRungs({
              kept: byKey.size,
              exclusiveClosed: exclusiveCount,
              exclusivePending,
              clusterPocket: true,
            })
          ? `the street-cluster pocket already supplied a tight closed+pending set (${exclusiveCount} closed, ${exclusivePending} pending), so the search stayed exclusive`
        : parentConfines(subject) && (tier.likeCommunity || tier.crossBoundary || tier.whenStarved)
          ? 'this home sits inside a neighborhood or community, so the search does not leave it for another community or a distance past that boundary'
        : tier.closerSubdivision && !(subject.closerSubdivisionSlugs?.length)
          ? 'no other subdivision inside this home\'s neighborhood or community is known'
        : tier.adjacentSubdivision && !(subject.adjacentSubdivisionSlugs?.length)
          ? 'no plat next to the subject\'s is known'
          : tier.crossBoundary && !subject.marketArea
            ? 'the subject is outside every mapped boundary, so there is no boundary to leave'
            : tier.crossBoundary && byKey.size >= BOUNDARY_EXIT_BELOW
              ? `the boundary supplied ${byKey.size} sales, so the search stayed inside it`
              : tier.ruralOnly && !subject.ruralAcreage
                ? 'the subject is not rural acreage'
                : tier.name.startsWith('city-') && subject.ruralAcreage
                  ? 'the subject is rural acreage, so the citywide rung does not apply'
                  : null
    if (skip) {
      rungs.push({
        tier: tier.name,
        ran: false,
        skippedReason: skip,
        monthsBack: tier.monthsBack,
        scanned: 0,
        added: 0,
        runningTotal: byKey.size,
      })
      continue
    }
    let added = 0
    const slugOrder = tier.adjacentSubdivision
      ? (subject.adjacentSubdivisionSlugs ?? [])
      : tier.closerSubdivision
        ? (subject.closerSubdivisionSlugs ?? [])
        : null
    const scanPool = slugOrder
      ? [...pool].sort((a, b) => {
          const rank = (slug: string | null | undefined) => {
            const at = slug ? slugOrder.indexOf(slug) : -1
            return at === -1 ? slugOrder.length + 1 : at
          }
          return rank(a.subdivisionSlug) - rank(b.subdivisionSlug)
        })
      : pool
    for (const sale of scanPool) {
      if (
        slugOrder &&
        byKey.size >= PRICING_TARGET_COMPS &&
        !isPocketExclusiveTier(tier)
      ) {
        break
      }
      if (byKey.has(sale.listingKey)) continue
      // ONE SALE, ONE ROW. A relisting of the same closed transaction carries a
      // new listing key, so keying on that alone lets one sale into a set twice
      // — once in the median and again at an end of the printed range. Address
      // plus city plus close price: two different homes do not close at the
      // exact same price at the same street address, and a duplicate always
      // agrees with itself on price even when it disagrees on square footage.
      const saleKey = `${sale.address.trim().toLowerCase()}|${(sale.city ?? '').trim().toLowerCase()}|${Math.round(sale.closePrice)}`
      if (bySale.has(saleKey)) continue
      const { ok, roomDifference, sewerNote } = passesTier(subject, sale, tier, asOf, cells, priceAnchor)
      if (!ok) continue
      // The subdivision-median tier does not see this close. Once the plat has
      // a sale, a different plat has to land on that set's own prices.
      if (!customLadder && !inSubjectPlat(subject, sale) && !closeNearOwnPlat(subject, sale, byKey.values())) {
        aboveOwnPlatHigh++
        continue
      }
      byKey.set(sale.listingKey, {
        ...toSelected(subject, sale, asOf, tier.name),
        roomDifference: roomDifference ?? null,
        sewerNote: sewerNote ?? null,
      })
      bySale.add(saleKey)
      added++
    }
    rungs.push({
      tier: tier.name,
      ran: true,
      skippedReason: null,
      monthsBack: tier.monthsBack,
      scanned: pool.length,
      added,
      runningTotal: byKey.size,
    })
    if (added > 0) {
      tiersUsed.push(tier.name)
      trace.push(
        `${tier.name}: +${added} (running ${byKey.size}). GLA ±${Math.round(tier.sqftBand * 100)}%${
          tier.maxMiles != null ? `, ≤${tier.maxMiles} mi` : ''
        }${tier.sameSubdivision ? ', same subdivision' : ''}.`,
      )
      if (tier.disclosure) trace.push(tier.disclosure)
    }
    if (isPocketExclusiveTier(tier)) exclusiveCount = byKey.size
  }

  const pocketStarved = pocketStarvedForYearQuality(exclusiveCount)
  const ranked = [...byKey.values()].sort(
    (a, b) => similarity(subject, b, asOf, pocketStarved) - similarity(subject, a, asOf, pocketStarved),
  )
  // An own-plat sale still in this set keeps the high-close ceiling, including
  // the bracket read below, which runs before that sale is removed. The pocket
  // pass runs only when no own-plat sale was kept.
  const hadOwnPlat = ranked.some((c) => c.ownPlat)
  const sitting = hadOwnPlat ? ranked : pocketSalesSitWithKept(ranked, customLadder)
  const sliced = keepEarlierRungSales(sitting, PRICING_MAX_COMPS, tiers.map((t) => t.name), asOf)
  const bracketed = bracketGla(subject, sliced, pool, asOf, priceAnchor, cells, customLadder)
  if (bracketed.note) {
    if (!tiersUsed.includes('gla-bracket')) tiersUsed.push('gla-bracket')
    trace.push(bracketed.note)
  }
  const priced = hadOwnPlat ? bracketed.comps : pocketSalesSitWithKept([...bracketed.comps], customLadder)
  // Once three sales set the price, a sale that does not is not in the set.
  // A short set keeps the next rung that was already admitted. Those sales
  // set the price too. Size and product were already refused on the way in.
  const setsPrice = (sale: SelectedPricingComp) => {
    const subjectCommunity = communityForAddress(subject)
    const saleCommunity = communityForAddress(
      sale,
      memberPlatMap(subjectCommunity, subject.communityMemberPlats),
    )
    return saleSetsThePrice({
      ownPlat: sale.ownPlat,
      subjectSubdivision: subject.subdivision,
      saleSubdivision: sale.subdivision,
      subjectCommunity,
      saleCommunity,
      subjectCommunityLocated: subject.communityLocated === true || subjectCommunity != null,
      saleCommunityLocated: sale.communityLocated === true || saleCommunity != null,
      subjectSqft: subject.sqft,
      saleSqft: sale.sqft,
      subjectLotAcres: subject.lotAcres,
      saleLotAcres: sale.lotAcres,
      saleDomTotal: closedSaleDomTotal({
        daysOnMarket: sale.cdom,
        onMarketDate: sale.onMarketDate,
        closeDate: sale.closeDate,
      }),
    })
  }
  if (aboveOwnPlatHigh > 0) {
    trace.push(
      `Excluded ${aboveOwnPlatHigh} sale(s) in another plat that closed more than ${Math.round(RANGE_REVIEW_SHARE * 100)}% above the highest sale in this home's own plat.`,
    )
  }
  const setters = priced.filter(setsPrice)
  const keptForPrice = setters.length >= PRICING_MIN_COMPS ? setters : priced
  if (keptForPrice.length < priced.length) {
    const dropped = priced.length - keptForPrice.length
    trace.push(
      `${dropped} ${dropped === 1 ? 'sale does' : 'sales do'} not set the price once ${setters.length} sales do, so ${dropped === 1 ? 'it is' : 'they are'} not in the set.`,
    )
  }
  const comps = [...keptForPrice].sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  const reachedTarget = comps.length >= PRICING_TARGET_COMPS
  if (comps.length < PRICING_MIN_COMPS) {
    trace.push(`Only ${comps.length} comparable sale(s) after the full ladder. The estimate needs broker review.`)
  } else {
    trace.push(`Final set: ${comps.length} closed sales from ${tiersUsed.join(', ') || 'none'}.`)
  }
  return {
    comps,
    tiersUsed,
    trace,
    reachedTarget,
    starved: !reachedTarget,
    rungs,
    priceAnchor,
    inferredPocket: subject.inferredPocket ?? null,
    ownPlatAgeRestrictedShare: subject.ownPlatAgeRestrictedShare ?? null,
    exclusiveCount,
    pocketStarved,
    ...(ruralSplits ? { ruralSplits } : {}),
  }
}
