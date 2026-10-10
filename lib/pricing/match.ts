/**
 * Pure pricing matcher. Given a subject and a candidate pool (already fetched),
 * walk the 3/6/9 → distance → similar-subdivision ladder. No I/O.
 */

import { realSubdivision } from '@/lib/cma/comp-tiers'
import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { saleInsideSubjectCommunity, saleSearchCommunitySlug, searchCommunitySlug } from '@/lib/cma/community-location'
import { isResortCommunity } from '@/lib/cma/resort-guard'
import { anchorPlacePhrase, resolvePriceAnchor, sameStreetPeer, streetKey, type PriceAnchor } from '@/lib/pricing/price-anchor'
import { onOwnPlat, ownGroundSeatRank } from '@/lib/pricing/plat-ground'
import { describePriceTierLine, insidePriceTier, priceTierLine } from '@/lib/pricing/price-tier'
import { notSettingSaleFrom, PRICE_SET_SQFT_BAND, priceSetRefusal, saleSetsThePrice, type NotSettingSale } from '@/lib/pricing/price-set'
import { locationMatchFromFacts, type LocationMatch } from '@/lib/pricing/closed-comp-weight'
import { ageRestrictedMismatch, ownPlatAgeRestrictedShare } from '@/lib/pricing/age-restricted'
import { distanceMiles, proximityLabel, resolveMarketArea } from '@/lib/cma/market-area'
import { roomCountsDecision, type RoomDecision } from '@/lib/pricing/room-ground'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import { crossesNamedRiver } from '@/lib/pricing/river-cross'
import {
  aduSaleRefused,
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
  customSalePriceFloorOk,
  SAME_NEIGHBORHOOD_TIER_RATIO,
  SUBDIVISION_TIER_RATIO,
  similarPerformingSubdivision,
  untieredSalePriceTierOk,
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
  ORDINARY_FACTS_POOL_MONTHS,
  PRICING_MIN_COMPS,
  PRICING_TARGET_COMPS,
  PRICING_WALK_CAP,
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
import { addressIsThisHome } from '@/lib/pricing/same-address'
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
  /** MLS unit. A shared building uses it so another unit is not this home. */
  unitNumber?: string | null
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  /**
   * MLS full and half bath counts (listings.baths_full / baths_half). `baths`
   * is BathroomsTotal, which counts a half bath whole (lib/pricing/bath-count.ts).
   */
  bathsFull?: number | null
  bathsHalf?: number | null
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
   * The next row: plats that touch the touching plats, not the subject and not
   * already in the touching row. Undefined means that adjacency was not read.
   * The walk does not fill it from every other plat in the parent. An empty
   * list means the next row has nowhere to go.
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
   * Named MLS tracts: 0.25 mi cluster. Blank MLS: 0.35 mi inferred names.
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
  /** MLS unit. Absent on sale_pricing_facts; stamped from listings before the walk. */
  unitNumber?: string | null
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  /**
   * MLS full and half bath counts (listings.baths_full / baths_half). `baths`
   * is BathroomsTotal, which counts a half bath whole (lib/pricing/bath-count.ts).
   */
  bathsFull?: number | null
  bathsHalf?: number | null
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
  /** The picker's one-room decision for this sale, with the counts it compared. */
  roomDecision?: RoomDecision | null
  /**
   * True when the sale sits in the subject's own plat by the same-subdivision
   * rung's own test (inSubjectPlat), whichever rung admitted it. The comparability
   * judge reads it: a sale in the subject's own plat may not be dropped on price
   * tier (Matt 2026-09-10, the first of the two exemptions).
   */
  ownPlat?: boolean
  /**
   * Rule 15's location step from where the sale sits (saleLocationMatch), not
   * from the rung that admitted it. The closed-sale weight reads it.
   */
  locationMatch?: LocationMatch
  /**
   * Set when this sale stays inside the recorded plat even though its sewer
   * is not the subject's. The letter prints it. Absent when they match, when
   * either is unknown, or when the sale is outside the plat.
   */
  sewerNote?: string | null
  /**
   * Every sale the walk admits sets the price (rule 20, Matt 2026-10-07: a
   * sale that does not is refused at admission and never counts toward the
   * five). Literal true so downstream never recomputes it.
   */
  setsPrice: true
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
  /** New price-setting sales it contributed to the pool. */
  added: number
  /** Distinct price-setting sales held after it. */
  runningTotal: number
  /**
   * Sales that passed this rung's walls and do not set the price (another
   * community, or a clearly different size or product). They do not count
   * toward the five, and the walk went on in order.
   */
  notSetting: number
  /**
   * Sales this rung would have taken whose remarks state an ADU, skipped
   * because the subject's remarks state none (Matt 2026-10-08, "ADU sale
   * skips", aduSaleRefused in lib/pricing/classes.ts). A skipped sale is like
   * one that never qualified: not seated, not marked seen, and a later rung
   * that reaches it skips it again. Absent on a rung that did not run.
   */
  aduSkipped?: number
  /**
   * Sales that passed every other wall this rung holds and sit outside the one
   * 20% price line around the home's anchor (lib/pricing/price-tier.ts). They
   * are skipped, and the walk goes on in the same order. Zero when the home has
   * no anchor, and on the own-plat rungs, which the line does not grade.
   */
  priceTier?: number
}

export type PricingMatchResult = {
  comps: SelectedPricingComp[]
  /** The $/sqft tier every comp was graded against, or null when none could be
   *  resolved — meaning nothing cut a comp on price on this build. */
  priceAnchor?: PriceAnchor | null
  /** Distinct sales the one 20% price line skipped over the whole walk. */
  priceTierSkipped?: number
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
   * Distinct sales the ADU wall skipped over the whole walk (each counted once,
   * however many rungs reached it). Zero when the subject's own remarks state
   * an ADU, since then nothing is skipped (aduSaleRefused).
   */
  aduSkipped?: number
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
  /** The rung that first brought the set to PRICING_TARGET_COMPS; null when the walk never reached it. */
  reachedOnTier?: string | null
  /**
   * True when that rung widened the area (touching plats, the next row, a
   * ring, the neighborhood, the community, the boundary exit, the widening).
   * False when own ground reached five, which seats up to seven on its own.
   */
  reachedOnWidening?: boolean
  /**
   * REFILL FROM THE SAME RUNG (Matt 2026-10-08). The rung that reached five
   * widened the area and seated only the shortfall; these are that rung's
   * remaining qualifying, price-setting sales the cap did not seat, in the
   * rung's own order (closest matches first). When the product wall leaves
   * that set short, the build takes the next one from here, never from a
   * wider rung (lib/cma/review-refill.ts). Empty when own ground reached five.
   * Optional only so a stub result (the facts table still backfilling) and
   * test literals stay valid; the walk always sets it.
   */
  bench?: SelectedPricingComp[]
  /**
   * Sales that passed a rung and rule 20 refused, each with the sentence the
   * letter prints beside it (SKILL §0.3 rule 29). The walk records the reason.
   * The renderer does not recompute it. Empty when nothing was refused.
   */
  notSettingSales?: NotSettingSale[]
  /**
   * In-band sales that did not seat, and the last wall that held each one,
   * when the walk finished short of five. `no-rung` means no rung's place
   * included the sale. Absent when the walk reached five.
   */
  unseatedWalls?: UnseatedWall[]
}

/** One in-band sale the walk did not seat, and the wall that held it. */
export type UnseatedWall = {
  listingKey: string
  address: string
  sqft: number
  closePrice: number
  subdivision: string | null
  why: string
  tier: string
  miles: number | null
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

/** The product wall that refused the sale, or null when the sale is the same product. */
function applesMiss(
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
): string | null {
  if (!productCompatible(subject.productClass, sale.productClass)) return 'product'
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
    return 'age-restricted'
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
  // The ONE ROOM RULE is not decided here. Every door into the set (the
  // walk's rungs and the size bracket) calls pickerRoomDecision itself, and
  // the seated sale carries that same decision (toSelected). This test used to
  // run its own copy without the own-plat test, so it refused a one-room sale
  // on the subject's recorded plat that rule 4 keeps.
  if (customOrNew) {
    if (!customLotCompatible(subject.lotAcres, sale.lotAcres)) return 'lot'
  } else {
    if (!lotCompatible(subject.lotAcres, sale.lotAcres)) return 'lot'
  }
  if (!resortCommunityCompatible(subject.subdivision, sale.subdivision)) return 'resort'
  // Water stays hard on every rung. A well house and a city-water house are
  // different products; widening distance does not make them comparable.
  // Sewer is hard outside the recorded plat. Inside it, septic and public
  // sewer both stay and the letter names which is which. Unknown still stays.
  if (!waterCompatible(subject.waterClass, sale.waterClass)) return 'water'
  if (
    !sewerCompatible(subject.sewerClass, sale.sewerClass) &&
    !saleInsideSubjectCommunity(subject, sale)
  ) {
    return 'sewer'
  }
  if (crossesMajorDivide(subject.marketArea, sale.marketArea)) return 'divide'
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
    return 'highway'
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
    return 'river'
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
    return 'bank'
  }
  const subjectIrrigation = resolveIrrigationClass(subject.publicRemarks, null, subject.irrigationClass)
  const saleIrrigation = irrigationClassFromRemarks(sale.publicRemarks)
  if (!irrigationCompatible(subjectIrrigation, saleIrrigation)) return 'irrigation'
  if (subject.ruralAcreage || (subject.lotAcres ?? 0) >= 1) {
    if (!horseInfrastructureCompatible(subject.publicRemarks, sale.publicRemarks)) return 'horse'
    // Delta 4 (Matt 2026-09-09): outside a boundary the comparison is of the
    // property. Zoning CLASS, outbuildings and usable land are hard splits,
    // never dollar adjustments; every side that is unknown keeps the sale.
    if (!zoningClassCompatible(subject.zoning, sale.zoning)) return 'zoning'
    if (!outbuildingsCompatible(subject.publicRemarks, sale.publicRemarks)) return 'outbuildings'
    if (!terrainCompatible(subject.publicRemarks, sale.publicRemarks)) return 'terrain'
  } else if (!zoningCompatible(subject.zoning, sale.zoning)) {
    return 'zoning'
  }
  if (level === 'product_lot' || level === 'utilities') return null
  return hoaCompatible(subject.hoaClass, sale.hoaClass) ? null : 'hoa'
}

function applesOk(
  subject: PricingSubject,
  sale: PricingSale,
  level: AppleStrictness,
  asOfYear?: number,
  allowFeatureCross = false,
): boolean {
  return applesMiss(subject, sale, level, asOfYear, allowFeatureCross) == null
}

function cellFor(
  cells: Map<string, SubdivisionCell>,
  citySlug: string,
  subdivisionNorm: string | null,
): SubdivisionCell | null {
  if (!subdivisionNorm) return null
  return cells.get(`${citySlug}:${subdivisionNorm}`) ?? null
}

/** The neighborhood polygon a row sits in: its stamp, else the polygon its point resolves to. */
function areaOf(row: { marketArea?: string | null; latitude: number | null; longitude: number | null }): string | null {
  return row.marketArea ?? resolveMarketArea(row.latitude, row.longitude) ?? null
}

/**
 * A custom or new subject, as the price-tier and polygon cuts read it (no
 * sub type: the cuts below have always asked the question this way).
 */
function customPeerOf(subject: PricingSubject, asOfYear: number): boolean {
  return isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
    },
    asOfYear,
  )
}

/** The rung flags the parent wall reads. A plain ring rung sets none of them. */
type ParentWallRung = Partial<
  Pick<
    PricingTier,
    | 'sameSubdivision'
    | 'sameStreetOnly'
    | 'samePocket'
    | 'adjacentSubdivision'
    | 'sameCommunity'
    | 'likeCommunity'
    | 'crossBoundary'
    | 'whenStarved'
  >
>

/**
 * THE PARENT IS THE WALL, as one predicate. A home inside a community
 * (Tetherow, Caldera Springs, Broken Top) or a neighborhood (Awbrey Butte,
 * River West) never takes a sale outside that parent. Not on a distance ring,
 * not when the set is short, not from another resort. A subject with neither
 * is unaffected.
 *
 * passesTier reads it on every rung. The GLA bracket reads it with the rung
 * the sale would have entered on (bracketWallRung), so a size swap never
 * crosses a wall the walk would not cross: a plat-less River West subject
 * once took a smaller Awbrey Butte sale through the swap after every ring
 * rung had refused it (review, 2026-10-07).
 */
function parentWallAdmits(subject: PricingSubject, sale: PricingSale, rung: ParentWallRung, asOfYear: number): boolean {
  const subjectCommunity = searchCommunitySlug(subject)
  const saleCommunity = saleSearchCommunitySlug(subject, sale)
  const confined = parentConfines(subject)
  const crossesCommunity = !confined && (Boolean(rung.crossBoundary) || Boolean(rung.whenStarved))
  if (rung.sameCommunity) {
    if (!subjectCommunity || saleCommunity !== subjectCommunity) return false
  } else if (rung.likeCommunity) {
    // A parent is never left for a peer resort. The peer rung remains only
    // for a home that sits in no neighborhood and no community.
    if (confined) return false
    if (!subjectCommunity || !isResortCommunity(subjectCommunity)) return false
    if (!saleCommunity || saleCommunity === subjectCommunity || !isResortCommunity(saleCommunity)) return false
  } else if (subjectCommunity && saleCommunity !== subjectCommunity && !crossesCommunity) {
    return false
  } else if (!subjectCommunity && saleCommunity && !crossesCommunity) {
    // Symmetric: a community sale carries that community's premium, so it does
    // not price an ordinary plat next door either.
    return false
  }
  // A street-cluster match is this home's own ground only inside its neighborhood.
  // A shared street name in another mapped neighborhood does not cross that line.
  // A null market area (no polygon) does not exclude.
  if (
    isClusterPocket(subject) &&
    (rung.sameSubdivision || rung.samePocket || rung.sameStreetOnly) &&
    subject.marketArea &&
    sale.marketArea &&
    subject.marketArea !== sale.marketArea
  ) {
    return false
  }
  // Same-subdivision sales are the same polygon by definition.
  if (rung.sameSubdivision) return true
  // Mapped vs unmapped is a different market for ordinary resale. Custom/new
  // subjects outside the Bend GIS mesh still keep year-quality peers that
  // resolve into a neighboring polygon (North Rim → Awbrey Butte). True
  // Parkway/Deschutes crosses stay hard in applesOk.
  // A touching plat is the adjacent step even when a neighborhood line
  // splits it from the subject. Anything farther stays inside the parent's
  // polygon. A home with no parent may still cross on the boundary-exit
  // rung, into another mapped polygon, never into unmapped land.
  const subjectArea = areaOf(subject)
  const saleArea = areaOf(sale)
  const touchingAdjacent = rung.adjacentSubdivision === true
  const customOutsideMesh = customPeerOf(subject, asOfYear) && !subject.marketArea
  const mayCrossArea = !confined && Boolean(rung.crossBoundary) && saleArea != null
  return subjectArea === saleArea || touchingAdjacent || customOutsideMesh || mayCrossArea
}

/** A miss about where or when this rung looks, not about the house itself. */
const RUNG_PLACE_MISS = new Set([
  'same-listing',
  'this-home',
  'not-closed-yet',
  'implausible-close',
  'outside-months',
  'other-city',
  'not-this-street',
  'not-this-plat',
  'outside-parent',
  'not-adjacent-plat',
  'not-next-plat',
  'not-this-pocket',
  'miles',
])

function tierMiss(why: string, miles: number | null = null, priceTier = false) {
  return priceTier
    ? { ok: false as const, miles, why, priceTier: true as const }
    : { ok: false as const, miles, why }
}

function inPickerSizeBand(subjectSqft: number, saleSqft: number): boolean {
  return subjectSqft > 0 && saleSqft > 0 && Math.abs(saleSqft - subjectSqft) / subjectSqft <= PRICE_SET_SQFT_BAND
}

function passesTier(
  subject: PricingSubject,
  sale: PricingSale,
  tier: PricingTier,
  asOf: string,
  cells: Map<string, SubdivisionCell>,
  /**
   * The subject's price tier when its own plat has no cell
   * (lib/pricing/price-anchor.ts). Without it the $/sqft cut below fails open
   * on every comp, which is how 23 Benaiah priced a $320/sqft home off a
   * $579/sqft downtown sale (Matt 2026-09-10).
   */
  anchor: PriceAnchor | null = null,
): {
  ok: boolean
  miles: number | null
  /** The wall that refused the sale. Absent when the sale passes. */
  why?: string
  roomDecision?: RoomDecision | null
  sewerNote?: string | null
  /** True when every other wall passed and the one 20% price line refused it. */
  priceTier?: boolean
} {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return tierMiss('same-listing')
  // A different unit at this address is a different home. The listing key
  // above already removed the subject's own row.
  if (
    addressIsThisHome({
      subjectAddress: subject.streetAddress,
      saleAddress: sale.address,
      subjectUnit: subject.unitNumber,
      saleUnit: sale.unitNumber,
      productClass: subject.productClass,
    })
  ) {
    return tierMiss('this-home')
  }
  if (sale.closeDate >= asOf) return tierMiss('not-closed-yet')
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return tierMiss('implausible-close')
  if (monthsBetween(asOf, sale.closeDate) > tier.monthsBack) return tierMiss('outside-months')
  if (!tier.ignoreCity && sale.citySlug !== subject.citySlug) return tierMiss('other-city')
  const onOwnStreet = sameStreetPeer(
    { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
    { address: sale.address, city: sale.city, sqft: sale.sqft },
  )
  if (tier.sameStreetOnly && !onOwnStreet) return tierMiss('not-this-street')
  // The subject's own street is its own ground for every rule below, exactly as
  // its own plat is.
  const ownPlat = tier.sameSubdivision === true || tier.sameStreetOnly === true
  // Street-cluster subjects: "same subdivision" means the exclusive Canter /
  // Horse Back / Ranch pocket, not every Black Butte home that shares the
  // catch-all SaddleStone MLS name (Matt Flex HARD LOCK 2026-09-15).
  if (tier.sameSubdivision && !inSubjectPlat(subject, sale)) return tierMiss('not-this-plat')
  // THE PARENT IS THE WALL (parentWallAdmits): the community line on
  // every rung, the street-cluster polygon on the own-ground rungs, and the
  // neighborhood polygon on every rung that leaves the subdivision. The GLA
  // bracket reads the same predicate.
  const asOfYear = Number(asOf.slice(0, 4))
  if (!parentWallAdmits(subject, sale, tier, asOfYear)) return tierMiss('outside-parent')
  // The plats next to the subject's, closest first.
  if (tier.adjacentSubdivision) {
    const ring = subject.adjacentSubdivisionSlugs ?? []
    if (!sale.subdivisionSlug || !ring.includes(sale.subdivisionSlug)) return tierMiss('not-adjacent-plat')
  }
  if (tier.closerSubdivision) {
    const next = subject.closerSubdivisionSlugs ?? []
    if (!sale.subdivisionSlug || !next.includes(sale.subdivisionSlug)) return tierMiss('not-next-plat')
  }
  if (tier.samePocket) {
    const nameHit =
      Boolean(sale.subdivisionNorm) &&
      (subject.pocketSubdivisionNorms ?? []).includes(sale.subdivisionNorm!)
    const saleStreet = streetKey(sale.address)
    const streetHit = Boolean(saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet))
    if (!nameHit && !streetHit) return tierMiss('not-this-pocket')
  }
  const sqftLo = subject.sqft * (1 - tier.sqftBand)
  const sqftHi = subject.sqft * (1 + tier.sqftBand)
  if (sale.sqft < sqftLo || sale.sqft > sqftHi) return tierMiss('size')

  const allowFeatureCross = Boolean(tier.whenStarved) && subject.marketArea == null
  const apples = applesMiss(subject, sale, tier.apples, asOfYear, allowFeatureCross)
  if (apples) return tierMiss(apples)
  // ONE ROOM RULE (rule 4, Matt 2026-10-09). Up to two bedrooms off, up to two
  // bathrooms off, or both, stays and is weighed less. Three or more on either
  // count is refused everywhere. The picker's one call (pickerRoomDecision) is
  // the same one the size bracket makes and the seated sale carries.
  const rooms = pickerRoomDecision(subject, sale)
  if (!rooms.ok) return tierMiss('rooms')
  if (!ownPlat && !ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, tier.ageYears)) {
    return tierMiss('age')
  }
  if (!ownPlat && !storyOk(subject.storyClass, sale.storyClass, tier.sameStory)) {
    return tierMiss('stories')
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
    return tierMiss('resale-versus-new')
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
    return tierMiss('year-quality')
  }

  // Price-tier + neighborhood cuts on every rung that leaves the subdivision.
  // Same-subdivision sales are the same tier and the same polygon by definition.
  // Custom/new year-quality peers skip the $/sqft tier cut so a North Rim
  // custom sale is not tossed as "too luxury" against a custom subject.
  let outsidePriceLine = false
  if (!tier.sameSubdivision) {
    // The neighborhood polygon was held above by parentWallAdmits.
    const subjectArea = areaOf(subject)
    const customPeer = customPeerOf(subject, asOfYear)
    const subj = cellFor(cells, subject.citySlug, subject.subdivisionNorm)
    const comp = cellFor(cells, sale.citySlug, sale.subdivisionNorm)
    const tierRatio = subjectArea != null ? SAME_NEIGHBORHOOD_TIER_RATIO : undefined
    if (
      !customPeer &&
      !similarPerformingSubdivision(
        subj?.medianPpsf ?? null,
        subj?.n ?? 0,
        comp?.medianPpsf ?? null,
        comp?.n ?? 0,
        tierRatio,
      )
    ) {
      return tierMiss('subdivision-tier')
    }
    // The same plan on the same street is this home's tier, whatever a
    // neighborhood median says (lib/pricing/price-anchor.ts).
    const ownStreet = sameStreetPeer(
      { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
      { address: sale.address, city: sale.city, sqft: sale.sqft },
    )
    const line = priceTierLine(anchor?.ppsf)
    if (line) {
      // ONE 20% LINE (Matt 2026-10-08, lib/pricing/price-tier.ts). Every sale
      // off the subject's own plat and off its own-street twin is graded on its
      // OWN closed $/sqft (close_ppsf, before date adjustment) against the
      // home's independent anchor, the same line the comparability review
      // grounds a price-tier cut on. It replaces the 30% tier gap, which seated
      // 2400 Jones at $381 against a $498 anchor and left the review to cut it.
      // The sale is not refused here: every other wall below still runs first,
      // so the rung counts only the sales the line alone kept out.
      // Custom and new subjects keep the floor and lose the ceiling, as before.
      if (!ownStreet && !insidePriceTier(sale.closePpsf, line, { floorOnly: customPeer })) {
        outsidePriceLine = true
      }
    } else {
      // NO ANCHOR: TODAY'S BEHAVIOR, UNCHANGED. With fewer than ANCHOR_MIN_N
      // sales in the neighborhood and every ring there is no independent line
      // to draw, so a cell-less sale is graded on its own $/sqft against the
      // subject's own plat cell when it has one, at the old tier ratio, and
      // passes when it has none (untieredSalePriceTierOk fails open).
      const subjectPpsf = subj?.medianPpsf ?? null
      const subjectN = subj?.n ?? 0
      const gradeOnOwnPpsf = !ownStreet && (!comp || !sale.subdivisionNorm || subj == null)
      if (gradeOnOwnPpsf) {
        // Custom and new subjects keep the FLOOR and lose the ceiling. A custom
        // home selling far above its neighborhood's median is what custom means;
        // being priced from a sale far below it is not. See customSalePriceFloorOk.
        const ok = customPeer
          ? customSalePriceFloorOk(subjectPpsf, subjectN, sale.closePpsf, tierRatio)
          : untieredSalePriceTierOk(subjectPpsf, subjectN, sale.closePpsf, tierRatio)
        if (!ok) return tierMiss('price-cell')
      }
    }
  }

  const miles = distanceMiles(
    { lat: subject.latitude, lng: subject.longitude },
    { lat: sale.latitude, lng: sale.longitude },
  )
  if (tier.maxMiles != null) {
    if (miles == null || miles > tier.maxMiles) return tierMiss('miles', miles)
  }
  // Every wall passed. The price line is the only thing keeping it out.
  if (outsidePriceLine) return tierMiss('price-line', miles, true)
  const sewerNote = saleInsideSubjectCommunity(subject, sale)
    ? sewerPlatNote(subject.sewerClass, sale.sewerClass, sale.address)
    : null
  return {
    ok: true,
    miles,
    roomDecision: rooms,
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

/**
 * Rule 15's location step from where the sale sits, read by the walls' own
 * tests: the same-subdivision rung's plat test (inSubjectPlat), the adjacent
 * rung's touching ring, the closer rung's next row, the pocket rung's street
 * cluster for a subject with no recorded plat, and parentWallAdmits'
 * community line and neighborhood polygon. The rung that admitted the sale
 * does not decide it: 915 Saginaw's River West sales came in on radius rungs
 * and weighed as wider (2026-10-07).
 */
export function saleLocationMatch(subject: PricingSubject, sale: PricingSale): LocationMatch {
  const plat = sale.subdivisionSlug?.trim() || null
  const subjectCommunity = searchCommunitySlug(subject)
  const saleCommunity = saleSearchCommunitySlug(subject, sale)
  const subjectArea = areaOf(subject)
  const saleStreet = streetKey(sale.address)
  const recordedPlat = subjectHasRecordedSubdivision(subject) && subject.inferredPocket?.inferred !== true
  const inPocket =
    (Boolean(sale.subdivisionNorm) && (subject.pocketSubdivisionNorms ?? []).includes(sale.subdivisionNorm!)) ||
    Boolean(saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet))
  return locationMatchFromFacts({
    ownPlat: inSubjectPlat(subject, sale),
    touchingPlat: plat != null && (subject.adjacentSubdivisionSlugs ?? []).includes(plat),
    // A recorded plat walks its quarter-mile pocket after the touching rows,
    // so a pocket sale there is the neighborhood step, as the rung reading had it.
    platRow: (plat != null && (subject.closerSubdivisionSlugs ?? []).includes(plat)) || (recordedPlat && inPocket),
    streetPocket: !recordedPlat && inPocket,
    insideParent:
      (subjectCommunity != null && saleCommunity === subjectCommunity) ||
      (subjectArea != null && areaOf(sale) === subjectArea),
  })
}

/**
 * THE PICKER'S ONE-ROOM DECISION (rule 4), the one call every door into the
 * set makes: each rung of the walk (passesTier), the size bracket
 * (bracketEligible), and the stamp every seated sale carries (toSelected).
 * Own ground is the subject's own plat by the same-subdivision rung's own test
 * (inSubjectPlat: the recorded polygon or a phase of it, else the MLS name, or
 * the street-cluster pocket), plus what roomCountsDecision reads itself (the
 * MLS plat name, the mapped neighborhood, the own street, the phase family).
 *
 * The stamp is what every later check re-runs (carriedRoomDecision in
 * lib/pricing/room-ground.ts). Before 2026-10-08 the size bracket seated a
 * sale without it, and the accuracy contract, which reads only the subject's
 * room counts, decided that sale off own ground and refused it:
 * cma-20435-powder-mountain (60645 Taos, 3 full baths against 2, inside the
 * subject's mapped neighborhood) and cma-63264-rossby (63127 Vista Meadow,
 * 4 bed against 3, inside the subject's mapped neighborhood).
 */
function pickerRoomDecision(subject: PricingSubject, sale: PricingSale): RoomDecision {
  return roomCountsDecision(subject, { ...sale, ownPlat: inSubjectPlat(subject, sale) })
}

function toSelected(
  subject: PricingSubject,
  sale: PricingSale,
  asOf: string,
  tierName: string,
  /** The decision the door that admitted the sale already made; computed when absent. */
  rooms: RoomDecision = pickerRoomDecision(subject, sale),
): SelectedPricingComp {
  return {
    ...sale,
    selectionTier: tierName,
    setsPrice: true,
    // Every seated sale carries the picker's room decision and, when it kept a
    // one-room gap on own ground, the disclosure the letter prints beside it.
    roomDecision: rooms,
    roomDifference: rooms.notes.length > 0 ? rooms.notes : null,
    ownPlat: inSubjectPlat(subject, sale),
    locationMatch: saleLocationMatch(subject, sale),
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
 * else's is its own subdivision by the one ground decision both ladders ask
 * (onOwnPlat in lib/pricing/plat-ground.ts, Matt 2026-10-08 "Yes,
 * everywhere"): the recorded polygon first, the plat, a phase of it, an alias
 * sibling, or a recorded addition or phase of its subdivision family inside
 * the subject's own neighborhood or community polygon, and the MLS name only
 * for a sale no polygon holds. The rung, the age-restricted wall, the
 * price-line exemption, the room rule's own ground, the size bracket, the
 * pocket rules, the location weight, and the `ownPlat` stamp every selected
 * sale carries (which the review reads) all read this. Before the ruling it
 * was samePlat, so a Kenwood First Addition sale for a Kenwood subject came
 * in on the touching-plat rung at weight 2 here and on the own-plat rung at
 * weight 3 on the listings ladder.
 */
function inSubjectPlat(subject: PricingSubject, sale: PricingSale): boolean {
  return isClusterPocket(subject) ? saleInExclusivePocket(subject, sale) : onOwnPlat(subject, sale)
}

/**
 * The size bracket may not leave the rows the walk already searched.
 * A recorded plat opened size inside its own phases, then the touching
 * plats, then the next row. A closer match in square footage does not
 * take a seat from outside those rows. A subject with no recorded plat
 * still brackets from the wider pool.
 */
function bracketStaysOnSubdivisionRows(subject: PricingSubject, sale: PricingSale): boolean {
  if (!subject.subdivisionSlug?.trim()) return true
  if (inSubjectPlat(subject, sale)) return true
  const plat = sale.subdivisionSlug?.trim()
  if (!plat) return false
  return (
    (subject.adjacentSubdivisionSlugs ?? []).includes(plat) ||
    (subject.closerSubdivisionSlugs ?? []).includes(plat)
  )
}

/**
 * The rung a bracket candidate would have entered the walk on, as the parent
 * wall reads it: the subject's own plat is the same-subdivision rung, a
 * touching plat is the adjacent rung, anything else is a plain ring rung. A
 * size swap is not a widening, so the boundary-exit and starved rungs never
 * stand behind it.
 */
function bracketWallRung(subject: PricingSubject, sale: PricingSale): ParentWallRung {
  if (inSubjectPlat(subject, sale)) return { sameSubdivision: true }
  const plat = sale.subdivisionSlug?.trim()
  if (plat && (subject.adjacentSubdivisionSlugs ?? []).includes(plat)) return { adjacentSubdivision: true }
  return {}
}

/**
 * THE RUNGS A SIZE SWAP STANDS IN FOR, for their year band and story rule
 * (2026-10-08). The bracket checked the walls, the price line, rule 4 and the
 * ADU wall, but no year band and no story rule, so on 711 Georgia (built
 * 2016) it seated 355 Delaware (built 1925) from a touching plat, a sale every
 * touching-plat rung had refused on the year band, in place of the only
 * own-street sale.
 *
 * Null for the subject's own ground (its plat, or its own street at its size):
 * the own-plat and own-street rungs carry no year band or story rule there
 * (passesTier's ownPlat), so neither does the swap. A touching plat stands in
 * for the touching-plat rungs, the next row for the next-row rungs. Anything
 * else stands in for every rung of the walk's ladder that could reach the
 * sale where it sits (its distance, the pocket, the subject's community, a
 * rural subject's rural rungs), never the boundary exit, the starved widening
 * or a peer community, which a size swap never stands behind (bracketWallRung).
 * The sale passes when one of those rungs' year band and story rule passes it.
 */
function bracketStandInRungs(
  subject: PricingSubject,
  sale: PricingSale,
  tiers: readonly PricingTier[],
): PricingTier[] | null {
  if (inSubjectPlat(subject, sale)) return null
  if (
    sameStreetPeer(
      { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
      { address: sale.address, city: sale.city, sqft: sale.sqft },
    )
  ) {
    return null
  }
  const plat = sale.subdivisionSlug?.trim()
  if (plat && (subject.adjacentSubdivisionSlugs ?? []).includes(plat)) return tiers.filter((t) => t.adjacentSubdivision)
  if (plat && (subject.closerSubdivisionSlugs ?? []).includes(plat)) return tiers.filter((t) => t.closerSubdivision)
  const miles = distanceMiles(
    { lat: subject.latitude, lng: subject.longitude },
    { lat: sale.latitude, lng: sale.longitude },
  )
  const saleStreet = streetKey(sale.address)
  const inPocket =
    (Boolean(sale.subdivisionNorm) && (subject.pocketSubdivisionNorms ?? []).includes(sale.subdivisionNorm!)) ||
    Boolean(saleStreet && (subject.pocketStreetKeys ?? []).includes(saleStreet))
  const subjectCommunity = searchCommunitySlug(subject)
  const inCommunity = subjectCommunity != null && saleSearchCommunitySlug(subject, sale) === subjectCommunity
  return tiers.filter((t) => {
    if (t.sameStreetOnly || t.sameSubdivision || t.adjacentSubdivision || t.closerSubdivision) return false
    if (t.crossBoundary || t.whenStarved || t.likeCommunity) return false
    if (t.sameCommunity && !inCommunity) return false
    if (t.samePocket && !inPocket) return false
    if (t.ruralOnly && !subject.ruralAcreage) return false
    if (t.maxMiles != null && (miles == null || miles > t.maxMiles)) return false
    return true
  })
}

/** True when a rung the swap stands in for would pass the sale on its year band and story rule. */
function bracketYearAndStoryOk(
  subject: PricingSubject,
  sale: PricingSale,
  tiers: readonly PricingTier[],
  asOfYear: number,
): boolean {
  const standIn = bracketStandInRungs(subject, sale, tiers)
  if (standIn == null) return true
  return standIn.some(
    (t) =>
      ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, t.ageYears) &&
      storyOk(subject.storyClass, sale.storyClass, t.sameStory),
  )
}

function bracketEligible(
  subject: PricingSubject,
  sale: PricingSale,
  asOf: string,
  wantLarger: boolean,
  /** Same price tier as the ladder itself applies — the bracket swap used to
   *  reach into the whole city pool on size alone. */
  anchor: PriceAnchor | null = null,
  cells: Map<string, SubdivisionCell> = new Map(),
  /** The walk's own ladder, for the year band and story rule of the rung the swap stands in for. */
  tiers: readonly PricingTier[] = pricingTierLadder(),
): boolean {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return false
  if (
    addressIsThisHome({
      subjectAddress: subject.streetAddress,
      saleAddress: sale.address,
      subjectUnit: subject.unitNumber,
      saleUnit: sale.unitNumber,
      productClass: subject.productClass,
    })
  ) {
    return false
  }
  if (!bracketStaysOnSubdivisionRows(subject, sale)) return false
  if (sale.closeDate >= asOf) return false
  // The bracket swap stays on the ordinary 24-month rung. Recovery sales
  // (out to 36 months) are seated by the recovery rungs, not by this swap.
  // Letting the swap reach past 24 months pulled a sale onto a custom subject
  // the contract then killed (cma-63531-gentry, 2026-09-10).
  if (monthsBetween(asOf, sale.closeDate) > BRACKET_MAX_AGE_MONTHS) return false
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return false
  const asOfYear = Number(asOf.slice(0, 4))
  // The same community, street-cluster and neighborhood walls the walk holds.
  // Without them a plat-less subject's swap reached the whole pool.
  if (!parentWallAdmits(subject, sale, bracketWallRung(subject, sale), asOfYear)) return false
  if (!applesOk(subject, sale, 'product_lot', asOfYear)) return false
  // The year band and story rule of the rung this swap stands in for
  // (bracketStandInRungs): a sale that rung would refuse on age or stories
  // is not a size fix (711 Georgia, 2026-10-08).
  if (!bracketYearAndStoryOk(subject, sale, tiers, asOfYear)) return false
  // Rule 4, the walk's own call. A swap never seats a sale the rule refuses,
  // and a one-room sale it keeps goes in carrying that decision (toSelected).
  if (!pickerRoomDecision(subject, sale).ok) return false
  // The ADU wall (Matt 2026-10-08), the same one every rung applies at the door.
  if (aduSaleRefused(subject.publicRemarks, sale.publicRemarks)) return false
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
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
  // The bracket may not import a different price tier. A swap is a size fix,
  // not a licence to reach across town.
  {
    // Custom and new keep the FLOOR here too. Skipping the cut outright let the
    // bracket swap reach past the ladder and import the cheap sale the ladder
    // itself had just refused.
    const line = priceTierLine(anchor?.ppsf)
    if (line) {
      // The same one 20% line the walk admits on (lib/pricing/price-tier.ts),
      // so a size swap never seats a sale the review would drop for price.
      // The walk's two exemptions hold here too: the subject's own plat and
      // its own-street twin are its price tier, and the review restores them.
      const exempt =
        inSubjectPlat(subject, sale) ||
        sameStreetPeer(
          { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
          { address: sale.address, city: sale.city, sqft: sale.sqft },
        )
      if (!exempt && !insidePriceTier(sale.closePpsf, line, { floorOnly: customOrNew })) return false
    } else {
      // No anchor: today's behavior, graded on the subject's own plat cell.
      const subj = cellFor(cells, subject.citySlug, subject.subdivisionNorm)
      const subjectPpsf = subj?.medianPpsf ?? null
      const subjectN = subj?.n ?? 0
      const ratio = subject.marketArea != null ? SAME_NEIGHBORHOOD_TIER_RATIO : undefined
      const ok = customOrNew
        ? customSalePriceFloorOk(subjectPpsf, subjectN, sale.closePpsf, ratio)
        : untieredSalePriceTierOk(subjectPpsf, subjectN, sale.closePpsf, ratio)
      if (!ok) return false
    }
  }
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
  /**
   * Rule 20's test, the same one the walk admits on. bracketEligible holds the
   * parent wall; this is the other door the walk has, so a size swap never
   * imports a sale that does not set the price.
   */
  setsPrice: (sale: SelectedPricingComp) => boolean = () => true,
  /** The walk's ladder (bracketEligible reads the rung the swap stands in for). */
  tiers: readonly PricingTier[] = pricingTierLadder({ customOrNew: customLadder }),
): { comps: SelectedPricingComp[]; note: string | null } {
  if (comps.length === 0) return { comps, note: null }
  const allLarger = comps.every((c) => c.sqft > subject.sqft)
  const allSmaller = comps.every((c) => c.sqft < subject.sqft)
  if (!allLarger && !allSmaller) return { comps, note: null }

  const kept = new Set(comps.map((c) => c.listingKey))
  const wantLarger = allSmaller
  const candidates = pool.filter(
    (sale) =>
      !kept.has(sale.listingKey) &&
      bracketEligible(subject, sale, asOf, wantLarger, anchor, cells, tiers) &&
      setsPrice(toSelected(subject, sale, asOf, 'gla-bracket')),
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
 * and only when its close is inside the own-plat band. The band is read before
 * the outgoing sale is removed. A same-plat replacement is not distance-blocked
 * and skips the band. Custom and new subjects skip the band, as they do on the walk.
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

function medianClose(values: readonly number[]): number | null {
  const sorted = values.filter((n) => n > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * A neighbor plat can clear the subdivision-median tier and still close far
 * from this home's own sales. The plat set is those sales. While an own-plat
 * sale is in the set, the band is their median (30%): a close about 32% off
 * that set is a different house, not a size gap the pocket's 20% band explains.
 * No own-plat sale yet still returns true here, so the first comp can enter.
 * A different-plat pocket sale does not stay on that opening. After the set is
 * built it has to sit with the comps that were kept, and a close under every
 * one of them is dropped. That is not an 80% floor and not a new minimum price.
 *
 * The walk applies this while the set is accumulating. The GLA bracket applies
 * it again to a different-plat replacement, and the median has to be read on
 * the kept set that still includes the own-plat sale being replaced. Removing
 * that sale first leaves this median check with nothing to measure.
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
  const mid = medianClose(closes)
  if (mid == null) return true
  if (!(sale.closePrice > 0)) return true
  const gap = sale.closePrice / mid
  return gap >= 1 / SUBDIVISION_TIER_RATIO && gap <= SUBDIVISION_TIER_RATIO
}

/**
 * No own-plat close was kept, so the 1.3 own-plat band has nothing to read.
 * A different-plat pocket sale still has to sit with the comps that were
 * kept. One that closes under every one of them is a cheaper house. Same-plat
 * sales are not in this pass. Custom and new subjects skip it, as they skip
 * the plat check on the walk. When an own-plat sale is kept, the caller does
 * not use this: that case stays the 1.3 own-plat median.
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
    if (sale.closePrice < cheapestOther) return false
    const mid = medianClose(others.map((row) => row.closePrice))
    if (mid == null) return true
    const gap = sale.closePrice / mid
    return gap >= 1 / SUBDIVISION_TIER_RATIO && gap <= SUBDIVISION_TIER_RATIO
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


/**
 * Own ground, then the touching plats, then the next row, then a pocket.
 * Distance, community, and city fill only what those rows left open.
 * A later row does not take a slot from an earlier one.
 */
function pricingLocationGroup(tier: string | null | undefined): number {
  const name = tier ?? ''
  if (name.startsWith('own-street-') || name.startsWith('subdivision-')) return 0
  if (name.startsWith('adjacent-sub-')) return 1
  if (name.startsWith('closer-sub-')) return 2
  if (name.startsWith('pocket-')) return 3
  return 4
}

/** Same era, then a generation apart, then a different era. Unknown sits in the middle. */
const PLAT_ERA_TIGHT_YEARS = 7
const PLAT_ERA_LOOSE_YEARS = 15
/** A plat whose homes are within about 10% of this living area is the same size. */
const PLAT_SIZE_CLOSE = 0.1
/** Float noise under a hundredth of a mile does not beat a closer feature match. */
const MILES_TIE = 0.01

function platKey(sale: PricingSale): string {
  const slug = sale.subdivisionSlug?.trim().toLowerCase()
  if (slug) return slug
  const name = sale.subdivisionNorm?.trim().toLowerCase()
  if (name) return name
  return sale.listingKey
}

/**
 * How much this plat's homes resemble the subject's own subdivision.
 * Era first, then size. This ranks which plat fills an open slot. It does
 * not drop a sale, and it does not use a median close.
 */
function platLikeness(
  subject: PricingSubject,
  sales: readonly PricingSale[],
): { era: number; size: number } {
  const years = sales
    .map((sale) => sale.yearBuilt)
    .filter((year): year is number => year != null && year >= 1850)
  const sqfts = sales.map((sale) => sale.sqft).filter((sqft) => sqft > 0)
  const yearMid = medianClose(years)
  const sqftMid = medianClose(sqfts)
  let era = 1
  if (subject.yearBuilt != null && subject.yearBuilt >= 1850 && yearMid != null) {
    const gap = Math.abs(subject.yearBuilt - yearMid)
    era = gap <= PLAT_ERA_TIGHT_YEARS ? 0 : gap <= PLAT_ERA_LOOSE_YEARS ? 1 : 2
  }
  let size = 1
  if (subject.sqft > 0 && sqftMid != null) {
    size = Math.abs(sqftMid - subject.sqft) / subject.sqft <= PLAT_SIZE_CLOSE ? 0 : 1
  }
  return { era, size }
}

/** Beds, baths, living area, then year. Close price is not in this gap. */
function featureGap(subject: PricingSubject, sale: PricingSale): number {
  const beds = subject.beds != null && sale.beds != null ? Math.abs(sale.beds - subject.beds) : 1
  const baths = subject.baths != null && sale.baths != null ? Math.abs(sale.baths - subject.baths) : 1
  const sizePct = subject.sqft > 0 ? Math.abs(sale.sqft - subject.sqft) / subject.sqft : 1
  const year =
    subject.yearBuilt != null && sale.yearBuilt != null ? Math.abs(subject.yearBuilt - sale.yearBuilt) : 25
  return beds * 10 + baths * 10 + sizePct * 5 + year / 50
}

/**
 * The homes in one opened row that most resemble the subject.
 * On a touching row, the plat whose homes match this subdivision comes
 * first. Inside the subject's own ground or pocket, distance comes first.
 * Then beds, baths, size, and year.
 */
function pickClosestMatches(
  subject: PricingSubject,
  sales: readonly SelectedPricingComp[],
  slots: number,
  rankPlats: boolean,
): SelectedPricingComp[] {
  const likeness = new Map<string, { era: number; size: number }>()
  if (rankPlats) {
    const byPlat = new Map<string, SelectedPricingComp[]>()
    for (const sale of sales) {
      const key = platKey(sale)
      const rows = byPlat.get(key)
      if (rows) rows.push(sale)
      else byPlat.set(key, [sale])
    }
    for (const [key, rows] of byPlat) likeness.set(key, platLikeness(subject, rows))
  }
  const neutral = { era: 0, size: 0 }
  return [...sales]
    .sort((a, b) => {
      const left = likeness.get(platKey(a)) ?? neutral
      const right = likeness.get(platKey(b)) ?? neutral
      if (left.era !== right.era) return left.era - right.era
      if (left.size !== right.size) return left.size - right.size
      const miles = saleMiles(subject, a) - saleMiles(subject, b)
      if (Math.abs(miles) > MILES_TIE) return miles
      const features = featureGap(subject, a) - featureGap(subject, b)
      if (features !== 0) return features
      return a.listingKey.localeCompare(b.listingKey)
    })
    .slice(0, slots)
}

/** Own street and plat (group 0) and the pocket (group 3): the subject's own ground. */
function ownGroundGroup(group: number): boolean {
  return group === 0 || group === 3
}

/**
 * NEWEST FIRST, THEN NEAREST (Matt 2026-10-07). When the subject's own ground
 * holds more qualifying sales than seats, the most recent closes take the
 * seats, and distance breaks a tie on the close date. Beds, baths, size and
 * year, then the listing key, settle anything still tied.
 *
 * OWN STREET AND EXACT PLAT FIRST (Matt 2026-10-08). On the own street and
 * own plat place (group 0) the subject's own-street and exact-plat sales seat
 * before the rest of its own subdivision (alias siblings, family plats in its
 * neighborhood), newest first within each (ownGroundSeatRank in
 * lib/pricing/plat-ground.ts, the order the listings ladder seats in too). A
 * street-cluster subject's exclusive pocket is one place and is not ranked.
 */
function pickNewestThenNearest(
  subject: PricingSubject,
  sales: readonly SelectedPricingComp[],
  slots: number,
  rankOwnGround = false,
): SelectedPricingComp[] {
  const ranked = rankOwnGround && !isClusterPocket(subject)
  const rank = (sale: SelectedPricingComp): number => (ranked ? ownGroundSeatRank(subject, sale) : 0)
  return [...sales]
    .sort((a, b) => {
      const order = rank(a) - rank(b)
      if (order !== 0) return order
      const date = b.closeDate.slice(0, 10).localeCompare(a.closeDate.slice(0, 10))
      if (date !== 0) return date
      const miles = saleMiles(subject, a) - saleMiles(subject, b)
      if (Math.abs(miles) > MILES_TIE) return miles
      const features = featureGap(subject, a) - featureGap(subject, b)
      if (features !== 0) return features
      return a.listingKey.localeCompare(b.listingKey)
    })
    .slice(0, slots)
}

/**
 * Fills up to `max` seats place by place: own ground, then the touching
 * plats, the next row, the pocket, the rest. An own-ground place with more
 * sales than open seats keeps its newest closes, nearest first on a tie; any
 * other place keeps its closest homes (distance, then beds, baths, size and
 * year), in the plat that resembles this one on a touching row.
 */
function seatByPlace(
  subject: PricingSubject,
  comps: readonly SelectedPricingComp[],
  max: number,
): SelectedPricingComp[] {
  const groups = new Map<number, SelectedPricingComp[]>()
  for (const comp of comps) {
    const group = pricingLocationGroup(comp.selectionTier)
    const rows = groups.get(group)
    if (rows) rows.push(comp)
    else groups.set(group, [comp])
  }
  const kept: SelectedPricingComp[] = []
  for (const group of [0, 1, 2, 3, 4]) {
    if (kept.length >= max) break
    const rows = groups.get(group)
    if (!rows?.length) continue
    const slots = max - kept.length
    if (rows.length <= slots) kept.push(...rows)
    else if (ownGroundGroup(group)) kept.push(...pickNewestThenNearest(subject, rows, slots, group === 0))
    else kept.push(...pickClosestMatches(subject, rows, slots, group === 1 || group === 2))
  }
  return kept
}

/**
 * The seats (Matt 2026-10-07: walk to 7, price on 5+; only what's needed;
 * newest first, then nearest).
 *
 * AN EARLIER PLACE KEEPS ITS SEATS. Every sale admitted before the rung that
 * brought the set to five is seated: together they held fewer than five, so
 * they always fit.
 *
 * SEATS SIX AND SEVEN COME ONLY FROM OWN GROUND. When the rung that reached
 * five was own ground, the own-ground place it belongs to (own street and plat
 * together, or the pocket), whose later windows also walked, fills the seats
 * up to PRICING_WALK_CAP, newest closes first, nearest on a tie, with the
 * subject's own-street and exact-plat sales seated before the rest of its own
 * subdivision (Matt 2026-10-08, "Own street and exact plat first"). When a rung
 * that widens the area reached five (touching plats, the next row, a ring, the
 * neighborhood, the community, the boundary exit, the widening), that rung
 * adds only the shortfall to five, its closest homes first (distance, then
 * beds, baths, size and year, in the plat that resembles this one on a
 * touching row), and the set is five.
 *
 * Before this rule the last place group lumped the community, every ring,
 * similar plats, the city, the boundary exit and the widening together, so a
 * one-month sale a ring admitted before five could lose its seat to a closer
 * fifteen-month sale on the city rung that reached five (review 2026-10-07).
 * The listings ladder (lib/cma/comps.ts selectComps) follows the same rule.
 */
function capPricingSet(
  subject: PricingSubject,
  comps: readonly SelectedPricingComp[],
  max: number,
  reachedOnTier: string | null,
): { kept: SelectedPricingComp[]; bench: SelectedPricingComp[]; widening: boolean } {
  if (reachedOnTier == null) {
    return { kept: comps.length <= max ? [...comps] : seatByPlace(subject, comps, max), bench: [], widening: false }
  }
  const reachGroup = pricingLocationGroup(reachedOnTier)
  const ownGround = ownGroundGroup(reachGroup)
  const competes = (comp: SelectedPricingComp) =>
    ownGround ? pricingLocationGroup(comp.selectionTier) === reachGroup : comp.selectionTier === reachedOnTier
  const kept = seatByPlace(
    subject,
    comps.filter((comp) => !competes(comp)),
    max,
  )
  const open = comps.filter(competes)
  const limit = ownGround ? max : Math.min(max, PRICING_TARGET_COMPS)
  const slots = Math.max(0, limit - kept.length)
  // THE BENCH (Matt 2026-10-08, refill from the same rung): on a widening
  // rung, the sales it qualified past the shortfall, in the rung's own order.
  // Own ground has no bench: it already seats up to PRICING_WALK_CAP.
  let bench: SelectedPricingComp[] = []
  if (open.length > 0) {
    if (open.length <= slots) {
      kept.push(...open)
    } else if (ownGround) {
      kept.push(...pickNewestThenNearest(subject, open, slots, reachGroup === 0))
    } else {
      const ordered = pickClosestMatches(subject, open, open.length, reachGroup === 1 || reachGroup === 2)
      kept.push(...ordered.slice(0, slots))
      bench = ordered.slice(slots)
    }
  }
  return { kept, bench, widening: !ownGround }
}

/**
 * A neighborhood polygon or a community that walls the search confines it.
 * A community made up from a plat name, with no HOA, is an ordinary plat and
 * confines nothing (searchCommunitySlug, Matt 2026-10-08).
 */
function parentConfines(subject: PricingSubject): boolean {
  return Boolean(subject.marketArea) || Boolean(searchCommunitySlug(subject))
}

/**
 * A recorded subdivision is a county plat slug, or a real MLS plat name.
 * N/A, blank, and the other sentinels in realSubdivision are none. An inferred
 * pocket name does not count: the check uses the subject before that fill.
 */
export function subjectHasRecordedSubdivision(subject: {
  subdivisionSlug?: string | null
  subdivision?: string | null
}): boolean {
  if ((subject.subdivisionSlug ?? '').trim()) return true
  return realSubdivision(subject.subdivision) != null
}

/** Street, own plat, touching plats, and the next touching row. Nothing past that while they hold the minimum. */
function tierOutsideRecordedPlatRows(tier: PricingTier): boolean {
  return !(tier.sameStreetOnly || tier.sameSubdivision || tier.adjacentSubdivision || tier.closerSubdivision)
}

/**
 * THE WALK, IN ORDER, AND WHAT COUNTS (Matt 2026-10-07: five price-setting
 * sales is the floor; a sale that does not set the price never counts).
 *
 * Every count in this function (countBeforePocket, platRowCount, the stop at
 * PRICING_TARGET_COMPS, the whenStarved and likeCommunity gates, the plat
 * lock, crossBoundary at BOUNDARY_EXIT_BELOW, exclusiveCount, runningTotal)
 * reads byKey, and byKey holds price-setting sales only: a sale that passes a
 * rung's walls and fails rule 20 (lib/pricing/price-set.ts saleSetsThePrice:
 * another community, or a clearly different size or product) is counted on
 * the rung as notSetting, recorded in bySale so no later rung re-scans it
 * (the test is tier-independent, so it would refuse again), and never
 * admitted. No gate is rewritten; the walk simply goes on.
 *
 * ORDER PROOF. The tiers come from lib/pricing/ladder.ts in the locked order
 * (own street and plat, the plats that touch it, the plats that touch those,
 * the quarter-mile pocket, the neighborhood or community and its rings inside
 * the parent, then likeCommunity, crossBoundary and whenStarved) and this
 * loop iterates them in that order: nothing reorders, reads ahead, or
 * re-enters an earlier rung. parentConfines still refuses likeCommunity,
 * crossBoundary and whenStarved for a subject inside a neighborhood or
 * community, so a confined subject never leaves its parent to reach five: it
 * ends short and the build fails as a comp shortage. An unconfined subject
 * reaches crossBoundary only under BOUNDARY_EXIT_BELOW setters, as before,
 * and crossBoundary is still refused with no marketArea. Reaching five never
 * crosses a wall the old walk would not cross; it only continues further down
 * the same ordered list when a non-setter was met. Never a radius search in
 * place of the order.
 *
 * WALK TO 7, PRICE ON 5+ (Matt 2026-10-07). The subject's own ground (own
 * street, own plat, its pocket) walks its whole window. Once byKey holds
 * PRICING_TARGET_COMPS, no rung that widens the area runs. Every rung scans
 * its whole row, and capPricingSet seats the set: every sale admitted before
 * the rung that reached five keeps its seat. Own ground that reached five
 * fills up to PRICING_WALK_CAP, newest closes first, so the review can drop one
 * or two and the set still prices on five. A rung that widens the area adds
 * only the sales needed to reach five (only what's needed, Matt 2026-10-07).
 */
export function walkPricingLadder(
  rawSubject: PricingSubject,
  pool: PricingSale[],
  opts: {
    asOf: string
    cells?: Map<string, SubdivisionCell>
    tiers?: PricingTier[]
    /** Pending listings in the same pocket — hold exclusivity, never enter the closed set. */
    pendingPool?: PricingSale[]
    /**
     * How many months of closes the pool holds (selectPricingComps reads 24,
     * or 30 for a custom or new home). Only the trace's anchor sentence reads
     * it, so the window it states is the one the pool was read over.
     */
    anchorWindowMonths?: number
  },
): PricingMatchResult {
  const recordedPlat = subjectHasRecordedSubdivision(rawSubject)
  const inferred = inferPocketForPricingWalk(rawSubject, pool)
  const subject = applyInferredPocket({ ...rawSubject }, inferred)
  // Whether this home's own plat is a 55+ community, read off the plat's own
  // sales in the pool, once, before any rung grades a sale against it.
  subject.ownPlatAgeRestrictedShare = ownPlatAgeRestrictedShare(pool.filter((s) => inSubjectPlat(subject, s)))
  // Next-row slugs come from the touching-plat read in selectPricingComps.
  // Distance from a sale is not adjacency. When that read did not run, the
  // next row stays empty rather than every other plat in the parent.
  if (subject.closerSubdivisionSlugs == null) {
    subject.closerSubdivisionSlugs = []
  }
  const asOf = opts.asOf.slice(0, 10)
  const cells = opts.cells ?? new Map()
  // The subject's price tier, resolved once (lib/pricing/price-anchor.ts). With
  // it, every sale off the own plat and the street twin is graded on the one
  // 20% line around it, whether or not the plats have cells (Matt 2026-10-08).
  // Without it, the plat cells grade as before. Read from the home as its MLS
  // row and plat read left it, not the inferred pocket: the anchor's levels are
  // its own recorded plat, that plat's family, and its own MLS subdivision name
  // before any wider ground.
  // The anchor stays on the ordinary (or custom) window. The pool also holds
  // closes out to 36 months for the date-recovery rungs, and those older
  // closes must not move the line on a letter that already has five sales.
  const anchorMonths = opts.anchorWindowMonths ?? ORDINARY_FACTS_POOL_MONTHS
  const withinAnchor = pool.filter((s) => monthsBetween(asOf, s.closeDate) <= anchorMonths)
  const priceAnchor = resolvePriceAnchor(rawSubject, withinAnchor.length > 0 ? withinAnchor : pool)
  // The one 20% line around it (lib/pricing/price-tier.ts), or null with no anchor.
  const priceLine = priceTierLine(priceAnchor?.ppsf)
  /** Distinct sales the price line skipped, across every rung. */
  const priceTierKeys = new Set<string>()
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
    `As-of ${asOf}. Named subdivision and its street cluster first (own street, same plat, pocket names and streets), exclusive while that set holds a tight closed+pending group. Then the plats next to it inside the same neighborhood or community, then distance inside that boundary, then similar-performing subdivisions; the boundary is crossed only when it supplied fewer than ${BOUNDARY_EXIT_BELOW} sales. Year and quality outrank radius only when exclusive closed sales sit below ${BOUNDARY_EXIT_BELOW}. Hard cuts: product (townhouse ≠ condo ≠ detached), rural/urban, resort, water, sewer, whole baths, US-97/Parkway and Deschutes banks, irrigated vs dry, horse/barn infrastructure on acreage, and on acreage the zoning class (farm or forest against rural residential), outbuildings, and usable land, zoning when both sides have a zone in town, new vs resale, custom/new year-and-quality, neighborhood once the search leaves the subdivision, HOA on the tight rungs, a subdivision $/sqft tier gap between plats, and ${priceLine ? `off the subject's own plat and street twin, a sale's own $/sqft inside ${describePriceTierLine(priceLine)} (one 20% line around this home's price anchor, the same line the comparability review holds)` : 'no price line around the home itself, because no price anchor could be resolved'}.`,
  ]
  if (priceAnchor && priceLine) {
    // Where the line was read, by name (Matt 2026-10-08): the narrowest level
    // that held a fair median, so a reader can see it is this home's own area.
    const windowText = opts.anchorWindowMonths ? ` that closed in the last ${opts.anchorWindowMonths} months` : ''
    trace.push(
      `Price tier: homes of this size sell for about $${priceLine.anchor} a square foot ${anchorPlacePhrase(priceAnchor)} (median of ${priceAnchor.n} sales${windowText}). Off this home's own plat and street, sales outside ${describePriceTierLine(priceLine)} are a different market and are not used.`,
    )
  }
  if (subject.inferredPocket?.inferred && subject.inferredPocket.subdivision) {
    trace.push(
      `MLS SubdivisionName was blank, so the search inferred ${subject.inferredPocket.subdivision} (${subject.inferredPocket.source}) before any mile ring.`,
    )
  } else if (!recordedPlat && (subject.pocketSubdivisionNorms?.length ?? 0) > 0 && subject.subdivision) {
    trace.push(
      `${subject.subdivision} is a named tract, so the search also held the ${subject.pocketSubdivisionNorms!.length} mapped pocket${subject.pocketSubdivisionNorms!.length === 1 ? '' : 's'} inside a quarter mile before any mile ring.`,
    )
  }

  if (!subject.sqft || subject.sqft < 300) {
    const note = 'Subject has no usable living area, so there is nothing to compare.'
    return {
      comps: [],
      tiersUsed,
      trace: [note],
      reachedTarget: false,
      starved: true,
      rungs,
      bench: [],
      notSettingSales: [],
    }
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
  // other subdivisions. A price cut then kept the cheap cluster and dropped
  // every Redtail Ridge sale, including 3499 SW 44th at $790,000. The Sep 7
  // build, before that cut, still had the plat sale. A pocket rung is wider
  // than a plat that has already filled. It must not be mixed in. When own
  // ground still has more qualifiers than the seven seats (walk to 7, Matt
  // 2026-10-07), its newest closes stay, nearest on a tie. A median close
  // does not choose them.
  let countBeforePocket: number | null = null
  // How many sales the plat rows (street, own plat, touching plats, the plats
  // that touch those) held when the walk first reached a rung outside them.
  // Read once: the running total grows on the rungs after it, and gating on
  // that total stopped a short plat at the first three sales it met, which a
  // later pocket drop then cut to two (review, 2026-10-07).
  let platRowCount: number | null = null
  /**
   * The rung that first brought the set to PRICING_TARGET_COMPS. The cap
   * seats every sale admitted before it; only this rung (or, when it was own
   * ground, that own-ground place) competes for the seats left.
   */
  let reachedOnTier: string | null = null
  /** Distinct sales the ADU wall skipped, for the diagnostics (counted once each). */
  const aduSkippedKeys = new Set<string>()

  // Rule 20, resolved once: a pure function of subject x sale, independent of
  // the rung. Every input is stamped before the walk (toSelected stamps
  // ownPlat; the selector stamps communityLocated and communitySlug on each
  // row; sqft and lotAcres are row fields). The refusal is the same call:
  // admission and the sentence the letter prints cannot disagree.
  const subjectCommunity = searchCommunitySlug(subject)
  const notSettingSales: NotSettingSale[] = []
  const priceSetInput = (sale: SelectedPricingComp) => {
    const saleCommunity = saleSearchCommunitySlug(subject, sale)
    return {
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
    }
  }
  const setsPrice = (sale: SelectedPricingComp): boolean => saleSetsThePrice(priceSetInput(sale))
  // The first wall about the house itself. A later ring's month window, or a
  // city rung's tighter size band, must not hide it. A seated sale is removed.
  const wallByKey = new Map<string, UnseatedWall>()
  const seatedOnce = new Set<string>()
  const noteWall = (sale: PricingSale, why: string, tierName: string, miles: number | null = null) => {
    if (!inPickerSizeBand(subject.sqft, sale.sqft)) return
    const prior = wallByKey.get(sale.listingKey)
    if (prior && !RUNG_PLACE_MISS.has(prior.why)) return
    if (
      prior &&
      RUNG_PLACE_MISS.has(why) &&
      prior.tier.startsWith('nearby-') &&
      !tierName.startsWith('nearby-')
    ) {
      return
    }
    wallByKey.set(sale.listingKey, {
      listingKey: sale.listingKey,
      address: sale.address,
      sqft: sale.sqft,
      closePrice: sale.closePrice,
      subdivision: sale.subdivision ?? null,
      why,
      tier: tierName,
      miles,
    })
  }

  for (const tier of tiers) {
    if (tier.samePocket && countBeforePocket == null) countBeforePocket = byKey.size
    if (recordedPlat && platRowCount == null && tierOutsideRecordedPlatRows(tier)) {
      platRowCount = byKey.size
      if (platRowCount < PRICING_MIN_COMPS) {
        trace.push(
          `${subject.subdivision ?? 'The recorded plat'}, the plats that touch it, and the plats that touch those held ${platRowCount} price-setting sale${platRowCount === 1 ? '' : 's'}, short of ${PRICING_MIN_COMPS}, so the search went on inside the neighborhood, closest first.`,
        )
      }
    }
    if (
      tier.samePocket &&
      !tier.sameSubdivision &&
      countBeforePocket != null &&
      countBeforePocket >= PRICING_TARGET_COMPS
    ) {
      rungs.push({
        tier: tier.name,
        ran: false,
        skippedReason: `the subject's own plat already has ${countBeforePocket} price-setting sales, so the quarter-mile pocket was not mixed into the price`,
        monthsBack: tier.monthsBack,
        scanned: 0,
        added: 0,
        runningTotal: byKey.size,
        notSetting: 0,
      })
      continue
    }
    // THE AREA STOPS WIDENING AT FIVE (walk to 7, Matt 2026-10-07: "while
    // the same area still holds qualifying sales"). The subject's own ground
    // (own street, own plat, its pocket) is the same area across its whole
    // window, so those rungs keep walking past five. Every rung that widens
    // the area (touching plats, the next row, rings, neighborhood, community,
    // boundary exit, starved) is skipped once the set holds five. The cap
    // below seats the set: own ground up to PRICING_WALK_CAP, a widening rung
    // only up to five.
    if (byKey.size >= PRICING_TARGET_COMPS && !isPocketExclusiveTier(tier)) {
      rungs.push({
        tier: tier.name,
        ran: false,
        // Truthful whichever place reached five: own ground, a touching plat,
        // a ring or the city (review 2026-10-07).
        skippedReason: `the search already has ${byKey.size} price-setting sales (it reached ${PRICING_TARGET_COMPS} on ${reachedOnTier ?? 'an earlier rung'}), so it does not widen the area`,
        monthsBack: tier.monthsBack,
        scanned: 0,
        added: 0,
        runningTotal: byKey.size,
        notSetting: 0,
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
        : tier.sameCommunity && !subjectCommunity
        ? 'the subject is not inside a planned or golf community'
        : tier.likeCommunity && !isResortCommunity(subjectCommunity)
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
        // A recorded plat stays in its own rows (plat, touching plats, the plats
        // that touch those) once they hold the minimum. Short of it, the walk
        // goes on through the rest of the neighborhood or community, closest
        // first and inside the parent wall, before the build fails (rules 15
        // and 19: "Do not return a short set"). 915 Saginaw and 1648 Pheasant
        // failed on 2026-10-07 holding one sale each with the neighborhood unread.
        : recordedPlat && tierOutsideRecordedPlatRows(tier) && (platRowCount ?? 0) >= PRICING_MIN_COMPS
          ? `this home sits in a recorded subdivision, and that plat, the plats that touch it, and the plats that touch those already hold ${platRowCount} price-setting sales, so the search stays there. It does not open a quarter-mile pocket, a distance ring, or the rest of the neighborhood`
        : parentConfines(subject) && (tier.likeCommunity || tier.crossBoundary || tier.whenStarved)
          ? 'this home sits inside a neighborhood or community, so the search does not leave it for another community or a distance past that boundary'
        : tier.closerSubdivision && !(subject.closerSubdivisionSlugs?.length)
          ? 'no subdivision that touches the touching plats is known'
        : tier.adjacentSubdivision && !(subject.adjacentSubdivisionSlugs?.length)
          ? 'no plat next to the subject\'s is known'
          : tier.crossBoundary && !subject.marketArea
            ? 'the subject is outside every mapped boundary, so there is no boundary to leave'
            : tier.crossBoundary && byKey.size >= BOUNDARY_EXIT_BELOW
              ? `the boundary supplied ${byKey.size} price-setting sales, so the search stayed inside it`
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
        notSetting: 0,
      })
      continue
    }
    let added = 0
    let rungNotSetting = 0
    let rungAduSkipped = 0
    let rungPriceTier = 0
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
      if (byKey.has(sale.listingKey)) continue
      // A close inside 24 months already had the normal rungs. Recovery is
      // only the sales those rungs could not see because they were older.
      if (tier.dateRecovery && monthsBetween(asOf, sale.closeDate) <= ORDINARY_FACTS_POOL_MONTHS) continue
      // ONE SALE, ONE ROW. A relisting of the same closed transaction carries a
      // new listing key, so keying on that alone lets one sale into a set twice,
      // once in the median and again at an end of the printed range. Address,
      // unit, city, and close price. A blank unit stays on address and price, so
      // one house relisted at the same price still enters once. Two units in one
      // building are two sales even when they close at the same dollar (1940
      // Monterey Pines units 2 and 12, both $520,000).
      const unit = (sale.unitNumber ?? '').trim().toLowerCase()
      const saleKey = `${sale.address.trim().toLowerCase()}|${unit}|${(sale.city ?? '').trim().toLowerCase()}|${Math.round(sale.closePrice)}`
      if (bySale.has(saleKey)) continue
      const { ok, why, roomDecision, sewerNote, priceTier } = passesTier(
        subject,
        sale,
        tier,
        asOf,
        cells,
        priceAnchor,
      )
      if (priceTier) {
        // Outside the one 20% line: skipped and counted, the walk goes on in
        // the same order. Not added to bySale, so the line is re-read on each
        // rung exactly as every other wall is.
        noteWall(sale, why ?? 'price-line', tier.name)
        rungPriceTier++
        priceTierKeys.add(sale.listingKey)
        continue
      }
      if (!ok) {
        const saleMiles =
          tier.maxMiles != null
            ? distanceMiles(
                { lat: subject.latitude, lng: subject.longitude },
                { lat: sale.latitude, lng: sale.longitude },
              )
            : null
        const nearbyCovers =
          tier.name.startsWith('nearby-') &&
          tier.maxMiles != null &&
          saleMiles != null &&
          saleMiles <= tier.maxMiles
        // A later city rung must not overwrite the quarter-mile reason. A
        // sale older than this rung's months is still outside the neighborhood
        // when the parent wall says so. That is the wall, and the month
        // window is not hiding it.
        let recorded = why ?? 'unknown'
        if (recorded === 'outside-months' && nearbyCovers && !parentWallAdmits(subject, sale, tier, asOfYearForLadder)) {
          recorded = 'outside-parent'
        }
        const alreadyNearby = wallByKey.get(sale.listingKey)?.tier.startsWith('nearby-') === true
        if (nearbyCovers || (!alreadyNearby && why && !RUNG_PLACE_MISS.has(why))) {
          noteWall(sale, recorded, tier.name, saleMiles)
        }
        continue
      }
      // A SALE WITH AN ADU NEVER PRICES A HOME WITHOUT ONE (Matt 2026-10-08,
      // "ADU sale skips"; aduSaleRefused, the reader the review and the
      // listings ladder apply too). The rung would have taken it; it is
      // skipped like a sale that never qualified, so it is not marked seen,
      // does not count toward the five, and the walk goes on in order.
      if (aduSaleRefused(subject.publicRemarks, sale.publicRemarks)) {
        rungAduSkipped++
        aduSkippedKeys.add(sale.listingKey)
        continue
      }
      // The subdivision-median tier does not see this close. Once the plat has
      // a sale, a different plat has to land on that set's own prices.
      if (!customLadder && !inSubjectPlat(subject, sale) && !closeNearOwnPlat(subject, sale, byKey.values())) {
        noteWall(sale, 'own-plat-close-band', tier.name)
        continue
      }
      const selected: SelectedPricingComp = {
        // Stamped with the room decision this rung just made (toSelected).
        ...toSelected(subject, sale, asOf, tier.name, roomDecision ?? undefined),
        sewerNote: sewerNote ?? null,
        setsPrice: true,
      }
      // The walls ran first, so this is a sale the rung would have taken and
      // rule 20 refused. It is not admitted, it does not count toward the
      // five, and no later rung re-scans it. The walk goes on in order.
      if (!setsPrice(selected)) {
        const refusal = priceSetRefusal(priceSetInput(selected))
        if (refusal) {
          notSettingSales.push(
            notSettingSaleFrom(
              {
                listingKey: selected.listingKey,
                listNumber: selected.listNumber,
                address: selected.address,
              },
              refusal,
            ),
          )
        }
        bySale.add(saleKey)
        rungNotSetting++
        continue
      }
      byKey.set(sale.listingKey, selected)
      bySale.add(saleKey)
      wallByKey.delete(sale.listingKey)
      seatedOnce.add(sale.listingKey)
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
      notSetting: rungNotSetting,
      aduSkipped: rungAduSkipped,
      priceTier: rungPriceTier,
    })
    if (rungPriceTier > 0 && priceLine) {
      // No rung name in the line: the comp-search sentence reads the trace for
      // the widest month and mile figures, and a rung that only skipped sales
      // did not supply one (lib/cma/render-comp-search.ts).
      trace.push(
        `${rungPriceTier} sale(s) passed this rung's other walls and sold outside ${describePriceTierLine(priceLine)}, this home's price tier, so they were skipped and the search went on.`,
      )
    }
    if (rungNotSetting > 0) {
      trace.push(
        `${rungNotSetting} sale(s) passed this rung but do not set the price (another community, or a clearly different size or product), so they do not count toward the five and the search went on.`,
      )
    }
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
    if (reachedOnTier == null && byKey.size >= PRICING_TARGET_COMPS) reachedOnTier = tier.name
  }

  if (aduSkippedKeys.size > 0) {
    trace.push(
      `Skipped ${aduSkippedKeys.size} sale(s) whose remarks state an ADU, guest house or other second living unit: this home's remarks state none, so a sale carrying a second unit does not set its price (Matt 2026-10-08).`,
    )
  }
  const pocketStarved = pocketStarvedForYearQuality(exclusiveCount)
  const ranked = [...byKey.values()].sort(
    (a, b) => similarity(subject, b, asOf, pocketStarved) - similarity(subject, a, asOf, pocketStarved),
  )
  // An own-plat sale still in this set keeps the 1.3 median, including the
  // bracket read below, which runs before that sale is removed. The pocket
  // pass runs only when that median was never there.
  const hadOwnPlat = ranked.some((c) => c.ownPlat)
  const sitting = hadOwnPlat ? ranked : pocketSalesSitWithKept(ranked, customLadder)
  const seats = capPricingSet(subject, sitting, PRICING_WALK_CAP, reachedOnTier)
  const sliced = seats.kept
  const bracketed = bracketGla(subject, sliced, pool, asOf, priceAnchor, cells, customLadder, setsPrice, tiers)
  if (bracketed.note) {
    if (!tiersUsed.includes('gla-bracket')) tiersUsed.push('gla-bracket')
    trace.push(bracketed.note)
  }
  const priced = hadOwnPlat ? bracketed.comps : pocketSalesSitWithKept([...bracketed.comps], customLadder)
  // Every admitted sale set the price at the door, and the bracket read the
  // same test, so this filter holds the whole set. A short set is a comp
  // shortage; there is no back door that keeps a non-setter when the set is
  // thin (Matt 2026-10-07).
  const setters = priced.filter(setsPrice)
  if (setters.length < priced.length) {
    trace.push(
      `${priced.length - setters.length} sale(s) reached the set without setting the price; this should not happen and is a defect in the walk.`,
    )
  }
  const keptForPrice = setters
  const comps = [...keptForPrice].sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  const reachedTarget = comps.length >= PRICING_TARGET_COMPS
  if (comps.length < PRICING_MIN_COMPS) {
    trace.push(
      `Comp shortage: only ${comps.length} price-setting sale(s) after the full ladder. This home needs ${PRICING_MIN_COMPS}.`,
    )
  } else {
    trace.push(`Final set: ${comps.length} closed sales from ${tiersUsed.join(', ') || 'none'}.`)
  }
  // The bench never holds a seated sale (the GLA bracket can seat one of them).
  const seated = new Set(comps.map((c) => c.listingKey))
  const unseatedWalls: UnseatedWall[] = []
  if (comps.length < PRICING_MIN_COMPS) {
    const seen = new Set<string>()
    for (const sale of pool) {
      if (seated.has(sale.listingKey) || seen.has(sale.listingKey)) continue
      if (!inPickerSizeBand(subject.sqft, sale.sqft)) continue
      seen.add(sale.listingKey)
      const saleMiles = distanceMiles(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: sale.latitude, lng: sale.longitude },
      )
      if (seatedOnce.has(sale.listingKey)) {
        unseatedWalls.push({
          listingKey: sale.listingKey,
          address: sale.address,
          sqft: sale.sqft,
          closePrice: sale.closePrice,
          subdivision: sale.subdivision ?? null,
          why: 'left-after-it-seated',
          tier: '',
          miles: saleMiles,
        })
        continue
      }
      const noted = wallByKey.get(sale.listingKey)
      unseatedWalls.push(
        noted
          ? { ...noted, miles: noted.miles ?? saleMiles }
          : {
              listingKey: sale.listingKey,
              address: sale.address,
              sqft: sale.sqft,
              closePrice: sale.closePrice,
              subdivision: sale.subdivision ?? null,
              why: 'no-rung',
              tier: '',
              miles: saleMiles,
            },
      )
    }
  }
  const bench = seats.bench.filter((c) => !seated.has(c.listingKey))
  if (seats.widening && bench.length > 0) {
    trace.push(
      `${reachedOnTier} widened the area and seated only what reached ${PRICING_TARGET_COMPS}; it holds ${bench.length} more qualifying sale${bench.length === 1 ? '' : 's'} the comparability review can refill from, in that rung's order, and the search never widens past it.`,
    )
  }
  return {
    comps,
    tiersUsed,
    trace,
    reachedTarget,
    starved: !reachedTarget,
    rungs,
    reachedOnTier,
    reachedOnWidening: seats.widening,
    bench,
    priceAnchor,
    priceTierSkipped: priceTierKeys.size,
    inferredPocket: subject.inferredPocket ?? null,
    ownPlatAgeRestrictedShare: subject.ownPlatAgeRestrictedShare ?? null,
    aduSkipped: aduSkippedKeys.size,
    exclusiveCount,
    pocketStarved,
    notSettingSales,
    ...(unseatedWalls.length > 0 ? { unseatedWalls } : {}),
    ...(ruralSplits ? { ruralSplits } : {}),
  }
}
