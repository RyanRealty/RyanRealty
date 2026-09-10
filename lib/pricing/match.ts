/**
 * Pure pricing matcher. Given a subject and a candidate pool (already fetched),
 * walk the 3/6/9 → distance → similar-subdivision ladder. No I/O.
 */

import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { communitySlugForSubdivision, isResortCommunity } from '@/lib/cma/resort-guard'
import { resolvePriceAnchor, sameStreetPeer, type PriceAnchor } from '@/lib/pricing/price-anchor'
import { bathCountCompatible, distanceMiles, proximityLabel, resolveMarketArea } from '@/lib/cma/market-area'
import { roomCountsUsable } from '@/lib/pricing/room-counts'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import { crossesNamedRiver } from '@/lib/pricing/river-cross'
import {
  classifyAgeBand,
  customBathCompatible,
  customLotCompatible,
  hoaCompatible,
  horseInfrastructureCompatible,
  irrigationClassFromRemarks,
  irrigationCompatible,
  isCustomOrNewSubject,
  isNewBuild,
  lotCompatible,
  newConstructionCompatible,
  plausibleListedClose,
  productCompatible,
  resolveIrrigationClass,
  sewerCompatible,
  customSalePriceFloorOk,
  SAME_NEIGHBORHOOD_TIER_RATIO,
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
  PRICING_MAX_COMPS,
  PRICING_MIN_COMPS,
  PRICING_TARGET_COMPS,
  pricingTierLadder,
  type AppleStrictness,
  type PricingTier,
  BOUNDARY_EXIT_BELOW,
} from '@/lib/pricing/ladder'
import { outbuildingsCompatible, terrainCompatible, zoningClassCompatible, type RuralSplitCounts } from '@/lib/pricing/rural'

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
   * Plats next to the subject's, inside the same neighborhood or community
   * (Matt 2026-09-08 containment). Empty when the point is in no plat or the
   * ring read failed; the adjacent rung then skips.
   */
  adjacentSubdivisionSlugs?: string[]
  newConstruction?: boolean | null
  /** MLS property_sub_type — "New Construction" classifies even when YN is null. */
  propertySubType?: string | null
  /** Zoning of record. Hard cut only when both sides have a non-empty string. */
  zoning?: string | null
  publicRemarks?: string | null
  /** Subject irrigation from remarks and/or OWRD. Sales use remarks only. */
  irrigationClass?: IrrigationClass | null
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
  dropCount: number
  closePpsf: number
  photoUrl: string | null
  publicRemarks: string | null
  marketArea?: string | null
  /** County plat the sale sits in (boundaries.geo_slug); set by the selector for the adjacency rung. */
  subdivisionSlug?: string | null
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
  /**
   * True when the sale sits on the subject's OWN GROUND — its plat, its mapped
   * neighborhood, or its street. A room-count difference is usable only there
   * (lib/pricing/room-counts.ts).
   */
  local = false,
): boolean {
  if (!productCompatible(subject.productClass, sale.productClass)) return false
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  // Custom/new: ±1 whole bath (Perspective 3ba vs Rim View 4ba). Exact floor
  // match still holds for ordinary resale.
  if (customOrNew) {
    if (!customBathCompatible(subject.baths, sale.baths)) return false
    if (!customLotCompatible(subject.lotAcres, sale.lotAcres)) return false
  } else {
    // ONE ROOM RULE for beds and baths alike (Matt 2026-09-10). Same whole
    // count travels anywhere; one room apart is used only on this home's own
    // ground and is disclosed; wider is refused.
    if (
      !roomCountsUsable({ beds: subject.beds, baths: subject.baths }, { beds: sale.beds, baths: sale.baths }, { local })
        .ok
    ) {
      return false
    }
    if (!lotCompatible(subject.lotAcres, sale.lotAcres)) return false
  }
  if (!resortCommunityCompatible(subject.subdivision, sale.subdivision)) return false
  // Water and sewer stay hard on every rung. A well house and a city-water
  // house are different products in this market; widening distance does not
  // make them comparable.
  if (!waterCompatible(subject.waterClass, sale.waterClass)) return false
  if (!sewerCompatible(subject.sewerClass, sale.sewerClass)) return false
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

function cellFor(
  cells: Map<string, SubdivisionCell>,
  citySlug: string,
  subdivisionNorm: string | null,
): SubdivisionCell | null {
  if (!subdivisionNorm) return null
  return cells.get(`${citySlug}:${subdivisionNorm}`) ?? null
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
): { ok: boolean; miles: number | null; roomDifference?: Array<'beds' | 'baths'> | null } {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return { ok: false, miles: null }
  if (subject.streetAddress && sale.address.toLowerCase() === subject.streetAddress.toLowerCase()) {
    return { ok: false, miles: null }
  }
  if (sale.closeDate >= asOf) return { ok: false, miles: null }
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return { ok: false, miles: null }
  if (monthsBetween(asOf, sale.closeDate) > tier.monthsBack) return { ok: false, miles: null }
  if (!tier.ignoreCity && sale.citySlug !== subject.citySlug) return { ok: false, miles: null }
  if (tier.sameSubdivision) {
    if (!subject.subdivisionNorm || sale.subdivisionNorm !== subject.subdivisionNorm) {
      return { ok: false, miles: null }
    }
  }
  // THE PARENT LEVEL IS A WALL (Matt 2026-09-09): a plat inside a planned or
  // golf community is priced from that community until the community itself is
  // exhausted. Only the like-community rung and a boundary-exit rung may look
  // outside it, and both disclose. A subject with no community is unaffected.
  const subjectCommunity = communitySlugForSubdivision(subject.subdivision)
  const saleCommunity = communitySlugForSubdivision(sale.subdivision)
  // The two rungs allowed outside the community: the boundary exit, and the
  // starved widening — the last resort that exists so a home gets an answer
  // instead of nothing, and which says on the document what it reached for.
  const crossesCommunity = Boolean(tier.crossBoundary) || Boolean(tier.whenStarved)
  if (tier.sameCommunity) {
    if (!subjectCommunity || saleCommunity !== subjectCommunity) return { ok: false, miles: null }
  } else if (tier.likeCommunity) {
    // Another community of the same kind, never the subject's own and never a
    // plain neighborhood.
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
  // The plats next to the subject's, inside its boundary (containment rung).
  if (tier.adjacentSubdivision) {
    const ring = subject.adjacentSubdivisionSlugs ?? []
    if (!sale.subdivisionSlug || !ring.includes(sale.subdivisionSlug)) return { ok: false, miles: null }
  }
  const sqftLo = subject.sqft * (1 - tier.sqftBand)
  const sqftHi = subject.sqft * (1 + tier.sqftBand)
  if (sale.sqft < sqftLo || sale.sqft > sqftHi) return { ok: false, miles: null }

  const asOfYear = Number(asOf.slice(0, 4))
  const allowFeatureCross = Boolean(tier.whenStarved) && subject.marketArea == null
  // THIS HOME'S OWN GROUND: its plat, its mapped neighborhood, or its street.
  // The room rule opens by one room here and nowhere else (Matt 2026-09-10).
  const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude, sale.longitude) ?? null
  const localSale =
    (subject.subdivisionNorm != null && sale.subdivisionNorm === subject.subdivisionNorm) ||
    (subject.marketArea != null && saleArea === subject.marketArea) ||
    sameStreetPeer(
      { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
      { address: sale.address, city: sale.city, sqft: sale.sqft },
    )
  if (!applesOk(subject, sale, tier.apples, asOfYear, allowFeatureCross, localSale)) {
    return { ok: false, miles: null }
  }
  const rooms = roomCountsUsable(
    { beds: subject.beds, baths: subject.baths },
    { beds: sale.beds, baths: sale.baths },
    { local: localSale },
  )
  if (!ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, tier.ageYears)) return { ok: false, miles: null }
  if (!storyOk(subject.storyClass, sale.storyClass, tier.sameStory)) return { ok: false, miles: null }
  // Beds and baths are decided by the ONE ROOM RULE inside applesOk above. The
  // per-tier bedSlop/bathSlop numbers no longer gate anything: a rung cannot be
  // looser than the room rule, and a rung that was tighter (bedSlop 1 on a
  // faraway rung) was re-imposing the wall the rule deliberately opened.

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
  if (
    !customOrNew &&
    !newConstructionCompatible(
      isNewBuild(subject.yearBuilt, asOfYear, subject.newConstruction),
      isNewBuild(sale.yearBuilt, asOfYear, sale.newConstruction),
    )
  ) {
    return { ok: false, miles: null }
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
    return { ok: false, miles: null }
  }

  // Price-tier + neighborhood cuts on every rung that leaves the subdivision.
  // Same-subdivision sales are the same tier and the same polygon by definition.
  // Custom/new year-quality peers skip the $/sqft tier cut so a North Rim
  // custom sale is not tossed as "too luxury" against a custom subject.
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
    // A boundary-exit rung (ladder.ts `beyond-*`) is the one place the search
    // may cross the polygon, and it only runs once the boundary is exhausted.
    // Crossing lands in ANOTHER mapped polygon, never in unmapped land — a
    // Highway 20 sale is a different market for a mapped Bend subject.
    if (subjectArea !== saleArea && !customPeer && !(tier.crossBoundary && saleArea != null)) {
      return { ok: false, miles: null }
    }
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
      return { ok: false, miles: null }
    }
    // THE SUBJECT ALWAYS HAS A PRICE TIER. When its own plat has no cell — an
    // MLS record carrying "N/A", or a plat with too few sales — the cut above
    // compares null to null and passes everything. The anchor is the
    // neighborhood around the home, or the mile around it, and every comp is
    // graded on its own $/sqft against it.
    const subjectPpsf = subj?.medianPpsf ?? anchor?.ppsf ?? null
    const subjectN = subj?.n ?? anchor?.n ?? 0
    // The same plan on the same street is this home's tier, whatever a
    // neighborhood median says (lib/pricing/price-anchor.ts).
    const ownStreet = sameStreetPeer(
      { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft },
      { address: sale.address, city: sale.city, sqft: sale.sqft },
    )
    const gradeOnOwnPpsf = !ownStreet && (!comp || !sale.subdivisionNorm || subj == null)
    if (gradeOnOwnPpsf) {
      // Custom and new subjects keep the FLOOR and lose the ceiling. A custom
      // home selling far above its neighborhood's median is what custom means;
      // being priced from a sale far below it is not. See customSalePriceFloorOk.
      const ok = customPeer
        ? customSalePriceFloorOk(subjectPpsf, subjectN, sale.closePpsf, tierRatio)
        : untieredSalePriceTierOk(subjectPpsf, subjectN, sale.closePpsf, tierRatio)
      if (!ok) return { ok: false, miles: null }
    }
  }

  const miles = distanceMiles(
    { lat: subject.latitude, lng: subject.longitude },
    { lat: sale.latitude, lng: sale.longitude },
  )
  if (tier.maxMiles != null) {
    if (miles == null || miles > tier.maxMiles) return { ok: false, miles }
  }
  return { ok: true, miles, roomDifference: rooms.notes.length > 0 ? rooms.notes : null }
}

const GLA_BRACKET_BAND = 0.25

function toSelected(subject: PricingSubject, sale: PricingSale, asOf: string, tierName: string): SelectedPricingComp {
  return {
    ...sale,
    selectionTier: tierName,
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

function bracketEligible(
  subject: PricingSubject,
  sale: PricingSale,
  asOf: string,
  wantLarger: boolean,
  /** Same price tier as the ladder itself applies — the bracket swap used to
   *  reach into the whole city pool on size alone. */
  anchor: PriceAnchor | null = null,
  cells: Map<string, SubdivisionCell> = new Map(),
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
    !customOrNew &&
    !newConstructionCompatible(
      isNewBuild(subject.yearBuilt, asOfYear, subject.newConstruction),
      isNewBuild(sale.yearBuilt, asOfYear, sale.newConstruction),
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
    const subj = cellFor(cells, subject.citySlug, subject.subdivisionNorm)
    const subjectPpsf = subj?.medianPpsf ?? anchor?.ppsf ?? null
    const subjectN = subj?.n ?? anchor?.n ?? 0
    const ratio = subject.marketArea != null ? SAME_NEIGHBORHOOD_TIER_RATIO : undefined
    // Custom and new keep the FLOOR here too. Skipping the cut outright let the
    // bracket swap reach past the ladder and import the cheap sale the ladder
    // itself had just refused.
    const ok = customOrNew
      ? customSalePriceFloorOk(subjectPpsf, subjectN, sale.closePpsf, ratio)
      : untieredSalePriceTierOk(subjectPpsf, subjectN, sale.closePpsf, ratio)
    if (!ok) return false
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
  const incoming = candidates[0]!

  const outgoing = comps.reduce((worst, c) => {
    const size = Math.abs(c.sqft - subject.sqft) - Math.abs(worst.sqft - subject.sqft)
    if (size > 0) return c
    if (size < 0) return worst
    return saleMiles(subject, c) > saleMiles(subject, worst) ? c : worst
  })

  const next = comps.filter((c) => c.listingKey !== outgoing.listingKey)
  next.push(toSelected(subject, incoming, asOf, 'gla-bracket'))
  return {
    comps: next,
    note: `GLA bracket: replaced ${outgoing.address} (${outgoing.sqft} sqft) with ${incoming.address} (${incoming.sqft} sqft) so the set is not all ${allLarger ? 'larger' : 'smaller'} than the subject.`,
  }
}

function similarity(subject: PricingSubject, sale: PricingSale, asOf: string): number {
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
  if (customOrNew) {
    // Year + quality outrank radius for this class (dist 0.18 used to beat age 0.16).
    return size * 0.26 + recency * 0.20 + age * 0.28 + story * 0.14 + dist * 0.12
  }
  return size * 0.28 + recency * 0.22 + age * 0.16 + story * 0.16 + dist * 0.18
}

export function walkPricingLadder(
  subject: PricingSubject,
  pool: PricingSale[],
  opts: {
    asOf: string
    cells?: Map<string, SubdivisionCell>
    tiers?: PricingTier[]
  },
): PricingMatchResult {
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
  const trace: string[] = [
    `As-of ${asOf}. Same subdivision first (3, 6, 9, then 12 months, and a wider GLA band on the same street), then the plats next to it inside the same neighborhood or community (3 to 12 months), then distance inside that boundary, then similar-performing subdivisions; the boundary is crossed only when it supplied fewer than ${BOUNDARY_EXIT_BELOW} sales. Hard cuts: product (townhouse ≠ condo ≠ detached), rural/urban, resort, water, sewer, whole baths, US-97/Parkway and Deschutes banks, irrigated vs dry, horse/barn infrastructure on acreage, and on acreage the zoning class (farm or forest against rural residential), outbuildings, and usable land, zoning when both sides have a zone in town, new vs resale, custom/new year-and-quality, neighborhood once the search leaves the subdivision, HOA on the tight rungs, and a 30% subdivision $/sqft tier gap.`,
  ]

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

  for (const tier of tiers) {
    const skip =
      // THE WIDENING RUNS ONLY WHEN THE BOUNDED LADDER CAME UP SHORT.
      tier.whenStarved && byKey.size >= PRICING_MIN_COMPS
        ? 'the bounded search already reached the minimum, so no widening was needed'
        : tier.sameCommunity && !communitySlugForSubdivision(subject.subdivision)
        ? 'the subject is not inside a planned or golf community'
        : tier.likeCommunity && !isResortCommunity(communitySlugForSubdivision(subject.subdivision))
        ? 'the subject is not inside a golf or resort community'
        : tier.likeCommunity && byKey.size >= PRICING_MIN_COMPS
        ? 'the community supplied the minimum, so no peer community was needed'
        : tier.sameSubdivision && !subject.subdivisionNorm
        ? 'the subject has no subdivision on its MLS row'
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
    for (const sale of pool) {
      if (byKey.has(sale.listingKey)) continue
      // ONE SALE, ONE ROW. A relisting of the same closed transaction carries a
      // new listing key, so keying on that alone lets one sale into a set twice
      // — once in the median and again at an end of the printed range. Address
      // plus city plus close price: two different homes do not close at the
      // exact same price at the same street address, and a duplicate always
      // agrees with itself on price even when it disagrees on square footage.
      const saleKey = `${sale.address.trim().toLowerCase()}|${(sale.city ?? '').trim().toLowerCase()}|${Math.round(sale.closePrice)}`
      if (bySale.has(saleKey)) continue
      const { ok, roomDifference } = passesTier(subject, sale, tier, asOf, cells, priceAnchor)
      if (!ok) continue
      byKey.set(sale.listingKey, {
        ...toSelected(subject, sale, asOf, tier.name),
        roomDifference: roomDifference ?? null,
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
    if (byKey.size >= PRICING_TARGET_COMPS) break
  }

  const ranked = [...byKey.values()].sort((a, b) => similarity(subject, b, asOf) - similarity(subject, a, asOf))
  const sliced = ranked.slice(0, PRICING_MAX_COMPS)
  const bracketed = bracketGla(subject, sliced, pool, asOf, priceAnchor, cells)
  if (bracketed.note) {
    if (!tiersUsed.includes('gla-bracket')) tiersUsed.push('gla-bracket')
    trace.push(bracketed.note)
  }
  const comps = [...bracketed.comps].sort((a, b) => b.closeDate.localeCompare(a.closeDate))
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
    ...(ruralSplits ? { ruralSplits } : {}),
  }
}
