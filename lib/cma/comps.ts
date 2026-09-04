/**
 * CMA comp selection — MARKET-AREA FIRST, distance as disclosure.
 *
 * Rewritten 2026-07-28 against the appraisal standards rather than a preference
 * (Matt: "you must do research"). The prior ladder was subdivision -> zip ->
 * CITY -> city-wide-wider, with no geographic constraint at all; subdivision is
 * frequently null and zip is coarse, so most subjects fell through to "anywhere
 * in Bend". That is exactly the "comps way too far away and in neighborhoods not
 * even really in the same area" complaint.
 *
 * What the standards actually say (see docs/plans/
 * PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md §A5 for sources):
 *   - USPAP sets NO proximity rule. Fannie Mae B4-1.3-08 requires comps from the
 *     subject's MARKET AREA and requires distance to be REPORTED with a
 *     direction, never capped. The 1-mile/5-mile rule was retired with UAD.
 *   - Competing-neighborhood comps are permitted but must be DISCLOSED, with the
 *     differences addressed.
 *   - Recency: at least 3 closed within 12 months; anything over 6 months old
 *     requires an explanation.
 *   - Size: the +/-25% GLA band is the accepted convention; wider crosses into a
 *     different buyer pool and gets the same disclosure treatment.
 *
 * So the ladder is now subdivision -> same GIS neighborhood polygon -> same area
 * but older -> competing neighborhood (flagged) -> city-wide (flagged, last
 * resort). Hard exclusions apply at EVERY tier per Matt: lot character (acreage
 * vs in-town lot) is never comparable regardless of distance. Custom / new
 * subjects add year-built and quality (19365 Rim View: do not pad TARGET_COMPS
 * with 1970s–2000 stock). Acreage subjects add remarks infrastructure
 * (irrigation, horse property, barns). US-97 / Parkway / Deschutes stays
 * lib/pricing/divides.ts on every rung, including rural — unmapped rural
 * points fail open there; we do not invent a second road list.
 */

import { selectCmaCompsPool, selectCmaCompsByKeys } from '@/lib/data'
import { resolveConcessions, sellerNetFromPrice } from '@/lib/pricing/seller-net'
import type { CmaListingRow } from '@/lib/data'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import { saneYearBuilt } from '@/lib/cma/subject'
import { ACREAGE_THRESHOLD_ACRES, landProduct } from '@/lib/cma/land-pricing'
import {
  distanceMiles,
  lotCharacterCompatible,
  productTypeCompatible,
  keepSameProductType,
  bathCountCompatible,
  yearQualityCompatible,
  acreageInfrastructureCompatible,
  marketAreaBounds,
  radiusBounds,
  marketAreaName,
  proximityLabel,
  resolveMarketArea,
  compPoolPropertySubType,
} from '@/lib/cma/market-area'
import {
  addExclusions,
  countByTier,
  diagnoseStarvation,
  emptyExclusions,
  type CompSelectionDiagnostics,
  type CompTierTrace,
} from '@/lib/cma/comp-trace'
import { compTierLadder, isRuralAcreage, realSubdivision } from '@/lib/cma/comp-tiers'
import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'
import {
  customBathCompatible,
  customLotCompatible,
  isCustomOrNewSubject,
  type IrrigationClass,
} from '@/lib/pricing/classes'

export { realSubdivision }

export const MIN_COMPS = 3
/**
 * Stop climbing the ladder at 5 (Matt 2026-07-30). The target is not "as many
 * comps as possible" — every extra comp is bought by widening geography or
 * time, so a target of 6 forced one more descent down the ladder than the
 * analysis needed. Five closed sales support the three pricing methods, and
 * stopping there keeps the set in the tightest tier that can fill it.
 */
export const TARGET_COMPS = 5
export const MAX_COMPS = 10

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

function mlsText(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return null
    }
  }
  return null
}

function rowToComp(row: CmaListingRow, tier: string, land = false): CmaComp | null {
  const closePrice = num(row['ClosePrice'])
  const rowSqft = num(row['TotalLivingAreaSqFt'])
  const closeDate = str(row['CloseDate'])
  const listingKey = str(row['ListingKey'])
  const lotAcres = num(row['lot_size_acres'])
  if (!closePrice || closePrice <= 0 || !closeDate || !listingKey) return null
  // A land sale has no living area by definition, so the >=300 sqft floor
  // rejected every one of them — the last silent wall between the land engine
  // and a comp. Acreage is the size of record for land; require that instead.
  if (land) {
    if (lotAcres == null || !(lotAcres > 0)) return null
  } else if (!rowSqft || rowSqft < 300) {
    return null
  }
  const sqft = land ? 0 : (rowSqft as number)
  const pendingTs = str(row['pending_timestamp'])
  const onMarket = str(row['OnMarketDate']) ?? str(row['ListDate'])
  let daysToOffer = num(row['days_to_pending'])
  if (daysToOffer == null && pendingTs && onMarket) {
    const ms = new Date(pendingTs).getTime() - new Date(onMarket).getTime()
    if (Number.isFinite(ms) && ms >= 0) daysToOffer = Math.round(ms / 86_400_000)
  }
  const concessions = resolveConcessions({
    amount: num(row['concessions_amount']),
    closeDate,
  })
  return {
    listingKey,
    mlsNumber: str(row['ListNumber']),
    unitNumber: str(row['unit_number']),
    address: `${str(row['StreetNumber']) ?? ''} ${str(row['StreetName']) ?? ''}`.trim(),
    city: str(row['City']) ?? '',
    subdivision: str(row['SubdivisionName']),
    latitude: num(row['Latitude']),
    longitude: num(row['Longitude']),
    beds: num(row['BedroomsTotal']),
    baths: num(row['BathroomsTotal']),
    sqft,
    lotAcres,
    propertySubType: str(row['property_sub_type']),
    yearBuilt: saneYearBuilt(num(row['year_built'])),
    garageSpaces: num(row['garage_spaces']),
    photoUrl: str(row['PhotoURL']),
    publicRemarks: str(row['public_remarks']),
    viewDescription: mlsText(row['view_description']),
    taxAnnual: num(row['tax_annual_amount']),
    listPrice: num(row['ListPrice']),
    closePrice,
    concessionsAmount: concessions,
    sellerNet: sellerNetFromPrice(closePrice, concessions),
    closeDate: closeDate.slice(0, 10),
    daysToOffer,
    domTotal: num(row['CumulativeDaysOnMarket']) ?? num(row['DaysOnMarket']),
    selectionTier: tier,
    photosCount: num(row['photos_count']),
  }
}

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}


/**
 * Size proximity x recency. Land has no living area, so its size is acreage —
 * ranking land on sqft scores every comp identically and makes the cap
 * arbitrary.
 */
/** Price per unit of the size that exists for this product: acre for land, sqft otherwise. */
function unitRate(comp: CmaComp, land: boolean): number {
  const size = land ? (comp.lotAcres ?? 0) : comp.sqft
  return size > 0 ? comp.closePrice / size : 0
}

function similarityScore(subjectSize: number, comp: CmaComp, land = false): number {
  const compSize = land ? (comp.lotAcres ?? 0) : comp.sqft
  const sizeProximity =
    subjectSize > 0 ? 1 / (1 + Math.abs(subjectSize - compSize) / subjectSize) : 1
  const months = Math.max(0, (Date.now() - new Date(comp.closeDate).getTime()) / (30.44 * 86_400_000))
  const recency = 1 / (1 + months / 12)
  return sizeProximity * recency
}

export interface CompSelection {
  comps: CmaComp[]
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  tiersUsed: string[]
  trace: string[]
  /** The structured, queryable half of the trace — persisted to build_summary. */
  diagnostics: CompSelectionDiagnostics
  /** Set when comps came from sale_pricing_facts (market-path time adj). */
  pricingSource?: 'facts' | 'listings'
  /** Fact-row comps, kept so the builder can walk the monthly market path. */
  pricingSales?: import('@/lib/pricing/match').SelectedPricingComp[]
}

function emptyDiagnostics(subject: CmaSubject, note: string | null): CompSelectionDiagnostics {
  return {
    market_area: null,
    market_area_resolved: false,
    rural_acreage: false,
    subject: {
      sqft: subject.sqft ?? null,
      lot_acres: subject.lotAcres ?? null,
      subdivision: realSubdivision(subject.subdivision),
      subdivision_raw: subject.subdivision ?? null,
      product_sub_type: subject.propertySubType ?? null,
    },
    ladder: [],
    tiers_used: [],
    reached_target: false,
    starved: true,
    starved_at: null,
    starved_reason: note,
    target_comps: TARGET_COMPS,
    min_comps: MIN_COMPS,
    candidates: 0,
    excluded_totals: emptyExclusions(),
    outliers_excluded: 0,
    final_count: 0,
    final_tier_counts: {},
    disclosures: [],
  }
}

/**
 * Select up to MAX_COMPS closed comps for the subject. Every query filter is
 * recorded in `trace` (prose, for the rendered citations) and in `diagnostics`
 * (structured, for build_summary).
 */
export async function selectComps(
  subject: CmaSubject,
  opts: { subjectIrrigation?: IrrigationClass | null } = {},
): Promise<CompSelection> {
  const sqft = subject.sqft ?? 0
  // Land is priced per ACRE, not per square foot, so a land subject legitimately
  // has no living area and must not fall into the bail below. Selection used to
  // refuse it here, which meant the land pricing engine could never receive a
  // single comp. See lib/cma/land-pricing.ts.
  const land = landProduct(subject)
  if ((!sqft && !land) || !subject.city) {
    // A subject with no living area is not a house the MLS has a record of —
    // most often the address resolves to a LAND listing (property_sub_type
    // 'Residential Lots'), which no closed-SFR comp set can price.
    const note = !sqft
      ? `The MLS record for this address carries no living area (TotalLivingAreaSqFt is empty${
          subject.propertySubType ? `, and its property sub-type is "${subject.propertySubType}"` : ''
        }). A comparable-sales analysis prices a dwelling, so there is nothing to compare. If the property has since been built on, the MLS record has not caught up and the subject must be entered by the MLS number of the improved listing.`
      : 'The subject has no city on its MLS record, so no comp market could be identified.'
    return { comps: [], excludedOutliers: [], tiersUsed: [], trace: [note], diagnostics: emptyDiagnostics(subject, note) }
  }
  const trace: string[] = []
  const tiersUsed: string[] = []
  const ladder: CompTierTrace[] = []
  const excludedTotals = emptyExclusions()
  const byKey = new Map<string, CmaComp>()

  // Lot-character band for the QUERY. The in-memory lotCharacterCompatible check
  // is the authoritative exclusion (it also rejects an in-town lot for an acreage
  // subject and vice versa); this just narrows the pull when the subject is on
  // acreage so the 50-row cap is not spent on incomparable stock.
  const lotMin = subject.lotAcres != null && subject.lotAcres >= 1 ? +(subject.lotAcres * 0.4).toFixed(2) : null
  const lotMax = subject.lotAcres != null && subject.lotAcres >= 1 ? +(subject.lotAcres * 2.5).toFixed(2) : null
  // A platted lot pulled with no upper bound spends the row cap on acreage that
  // lotCharacterCompatible will reject in memory anyway. Cap the pull at the
  // same 1-acre line the exclusion uses.
  const landLotMax = land === 'lots' && lotMax == null ? ACREAGE_THRESHOLD_ACRES : lotMax
  // Land is MLS segment 'D' (REGISTRY §1). Pulling it against 'A' returns zero
  // rows and reads as "no comparable sales" rather than as a wrong query.
  const segment = land ? 'D' : 'A'

  // Null when the MLS holds a placeholder rather than a real subdivision.
  const subdivisionIlike = realSubdivision(subject.subdivision)

  // The subject's GIS market area, when it sits inside one. Null is a legitimate
  // answer (rural, or a city with no mesh) — those subjects fall back to distance.
  const subjectArea = resolveMarketArea(subject.latitude, subject.longitude)
  const subjectAreaName = marketAreaName(subjectArea)
  const subjectPoint = { lat: subject.latitude, lng: subject.longitude }
  trace.push(
    subjectArea
      ? `Subject market area: ${subjectAreaName} (City of Bend GIS neighborhood mesh, point-in-polygon).`
      : // The mesh is City of Bend only, so EVERY Redmond, Sisters, Sunriver,
        // La Pine and Prineville subject reaches this line. "Outside every
        // mapped polygon" reads to a homeowner like their property could not be
        // found (Matt 2026-08-25). State the two facts instead.
        'The neighborhood mesh covers the City of Bend. This property sits outside it, so comps are chosen by distance from the subject.',
  )


  const tiers = compTierLadder(subdivisionIlike)
  const ruralAcreage = isRuralAcreage(subject, subjectArea)
  const customOrNew = isCustomOrNewSubject({
    yearBuilt: subject.yearBuilt,
    newConstructionYn: subject.newConstructionYn,
    remarks: subject.publicRemarks,
  })

  const sqlSubType = compPoolPropertySubType(subject.propertySubType)
  const subTypeSql = sqlSubType ? ` AND property_sub_type='${sqlSubType}'` : ''

  for (const tier of tiers) {
    const skip =
      tier.name.startsWith('subdivision') && !tier.subdivisionIlike
        ? 'the subject has no usable SubdivisionName on its MLS record'
        : tier.sameArea && !subjectArea
          ? 'the subject sits outside every mapped neighborhood polygon'
          : tier.ruralOnly && !ruralAcreage
            ? 'this rung is reserved for rural acreage subjects outside every mapped neighborhood'
            : null
    const sqftMin = Math.round(sqft * (1 - tier.sqftBand))
    const sqftMax = Math.round(sqft * (1 + tier.sqftBand))
    const closeDateGte = isoMonthsAgo(tier.monthsBack)
    const geography = [
      tier.subdivisionIlike ? `SubdivisionName ILIKE '${tier.subdivisionIlike}'` : null,
      tier.ignoreCity ? 'any mailing city' : `City ILIKE '${subject.city}'`,
      tier.sameArea ? `market area = ${subjectAreaName}` : null,
      tier.maxMiles != null ? `within ${tier.maxMiles} miles of the subject` : null,
    ]
      .filter(Boolean)
      .join(', ')
    const rung: CompTierTrace = {
      tier: tier.name,
      ran: !skip,
      skipped_reason: skip,
      months_back: tier.monthsBack,
      sqft_min: sqftMin,
      sqft_max: sqftMax,
      lot_min: lotMin,
      lot_max: lotMax,
      geography,
      rows_returned: 0,
      comps_added: 0,
      running_total: byKey.size,
      excluded: emptyExclusions(),
    }
    if (skip) {
      ladder.push(rung)
      continue
    }
    // Push the tier's geography INTO the query. The row limit is applied
    // before any in-memory filter, so without this a polygon or radius tier
    // only sees whichever recent citywide sales happen to fall inside it.
    const tierBounds = tier.sameArea
      ? marketAreaBounds(subjectArea)
      : tier.maxMiles != null
        ? radiusBounds(subjectPoint, tier.maxMiles)
        : null
    const rows = await selectCmaCompsPool({
      cityIlike: tier.ignoreCity ? null : subject.city,
      subdivisionIlike: tier.subdivisionIlike ?? null,
      postalCode: null,
      closeDateGte,
      sqftMin: land ? null : sqftMin,
      sqftMax: land ? null : sqftMax,
      lotMin,
      lotMax: landLotMax,
      bounds: tierBounds,
      limit: tierBounds ? 500 : 100,
      propertySubType: sqlSubType,
      propertyType: segment,
    })
    rung.rows_returned = rows.length
    let added = 0
    for (const row of rows) {
      const comp = rowToComp(row, tier.name, Boolean(land))
      if (!comp) {
        rung.excluded.unusable_row++
        continue
      }
      if (subject.listingKey && comp.listingKey === subject.listingKey) {
        rung.excluded.self++
        continue
      }
      // Same street address is the subject ONLY when the unit matches too.
      // A condo building shares one address across every unit: 363 Bluff (the
      // Plaza) had 20 of its own building's sales — the best comp set a condo
      // has — dropped as "self" by the bare address equality, starving the
      // build to one comp. Unit vs unit decides; two absent units on an
      // ATTACHED subject are ambiguous and admit (the subject's true self is
      // already caught by ListingKey above), while on a detached subject the
      // bare address match stays self, which is what it always meant there.
      if (subject.streetAddress && comp.address.toLowerCase() === subject.streetAddress.toLowerCase()) {
        const su = (subject.unitNumber ?? '').trim().toLowerCase()
        const cu = (comp.unitNumber ?? '').trim().toLowerCase()
        const attached = !keepSameProductType('Single Family Residence', subject.propertySubType)
        const unitsDiffer = su !== cu
        const bothAbsentOnAttached = !su && !cu && attached
        if (!unitsDiffer && !bothAbsentOnAttached) {
          rung.excluded.self++
          continue
        }
      }
      if (byKey.has(comp.listingKey)) {
        rung.excluded.duplicate++
        continue
      }

      // HARD EXCLUSION at every tier (Matt 2026-07-28): acreage and in-town lots
      // are different products with different buyer pools, at any distance.
      if (customOrNew) {
        if (!customLotCompatible(subject.lotAcres, comp.lotAcres)) {
          rung.excluded.lot_character++
          continue
        }
      } else if (!lotCharacterCompatible(subject.lotAcres, comp.lotAcres)) {
        rung.excluded.lot_character++
        continue
      }

      // HARD EXCLUSION at every tier (Matt 2026-09-03): a dry 10-acre lot is
      // not a peer to an irrigated horse property with barns. Remarks are the
      // source — empty remarks fail open, same as unknown lot size.
      if (
        !acreageInfrastructureCompatible(
          {
            lotAcres: subject.lotAcres,
            remarks: subject.publicRemarks,
            irrigationClass: opts.subjectIrrigation,
          },
          { lotAcres: comp.lotAcres, remarks: comp.publicRemarks },
        )
      ) {
        rung.excluded.acreage_infrastructure++
        continue
      }

      // HARD EXCLUSION at every tier (Matt 2026-08-05, the no-brainer): a
      // resort-community sale (Crosswater, Caldera Springs, ...) only prices
      // a home in the SAME resort community — and a plain-town sale never
      // prices a resort subject. Registry-driven, symmetric.
      if (!resortCommunityCompatible(subject.subdivision, comp.subdivision)) {
        rung.excluded.resort_premium++
        continue
      }

      // HARD EXCLUSION at every tier (Never cross US-97 / Bend Parkway /
      // Deschutes — CMA_SUNSTONE_CONTRACT). The facts ladder has carried this
      // cut since divides.ts shipped; this FALLBACK ladder silently dropped it,
      // which is defect D5: 828 Florida (west of the Parkway) was priced from
      // Archie Briggs / Star Ridge / Rimrock sales across it, $481/sqft against
      // an Old Bend subject. Both sides must resolve to a mapped bank; an
      // unmapped point fails open, same as Path A.
      if (
        crossesMajorDivide(
          subjectArea,
          resolveMarketArea(comp.latitude, comp.longitude),
        ) ||
        (!customOrNew &&
          ruralAcreage &&
          unmappedCrossesKnownBank(subjectArea, resolveMarketArea(comp.latitude, comp.longitude)))
      ) {
        rung.excluded.crossed_divide++
        continue
      }

      // HARD EXCLUSION at every tier. SQL already eq's the subject's product
      // type; keepSameProductType is belt-and-suspenders if a mixed row slips in.
      if (
        !productTypeCompatible(subject.propertySubType, comp.propertySubType) ||
        !keepSameProductType(subject.propertySubType, comp.propertySubType)
      ) {
        rung.excluded.product_type++
        continue
      }

      // Custom/new: ±1 whole bath (Perspective 3 vs Rim View 4). Exact floor
      // match still holds for ordinary resale.
      if (customOrNew) {
        if (!customBathCompatible(subject.baths, comp.baths)) {
          rung.excluded.bath_count++
          continue
        }
      } else if (!bathCountCompatible(subject.baths, comp.baths)) {
        rung.excluded.bath_count++
        continue
      }

      // HARD EXCLUSION at every tier for custom / new-construction subjects
      // (Matt 2026-09-03, 19365 Rim View). Year-built and quality outrank a
      // tight radius. Widen geography or time; do not pad TARGET_COMPS with
      // a different construction generation. Ordinary resale subjects skip.
      if (
        !yearQualityCompatible(
          {
            yearBuilt: subject.yearBuilt,
            newConstructionYn: subject.newConstructionYn,
            remarks: subject.publicRemarks,
          },
          { yearBuilt: comp.yearBuilt, remarks: comp.publicRemarks },
        )
      ) {
        rung.excluded.year_quality++
        continue
      }

      const compArea = resolveMarketArea(comp.latitude, comp.longitude)
      if (tier.sameArea && compArea !== subjectArea) {
        rung.excluded.market_area++
        continue
      }

      const miles = distanceMiles(subjectPoint, { lat: comp.latitude, lng: comp.longitude })
      if (tier.maxMiles != null && miles != null && miles > tier.maxMiles) {
        rung.excluded.distance++
        continue
      }

      // Distance + direction on EVERY comp — Fannie Mae requires it reported.
      comp.proximity = proximityLabel(subjectPoint, { lat: comp.latitude, lng: comp.longitude })
      // Disclose a competing market area rather than quietly blending it in.
      comp.competingArea =
        tier.competing && compArea && compArea !== subjectArea ? marketAreaName(compArea) : null

      byKey.set(comp.listingKey, comp)
      added++
    }
    rung.comps_added = added
    rung.running_total = byKey.size
    addExclusions(excludedTotals, rung.excluded)
    ladder.push(rung)
    trace.push(
      `Tier ${tier.name}: listings WHERE StandardStatus ILIKE '%Closed%' AND PropertyType='${segment}'${subTypeSql} AND ClosePrice>0 AND CloseDate>='${closeDateGte}'${tier.ignoreCity ? '' : ` AND City ILIKE '${subject.city}'`}${tier.subdivisionIlike ? ` AND SubdivisionName ILIKE '${tier.subdivisionIlike}'` : ''}${land ? '' : ` AND TotalLivingAreaSqFt BETWEEN ${sqftMin} AND ${sqftMax}`}${lotMin != null ? ` AND lot_size_acres BETWEEN ${lotMin} AND ${landLotMax}` : landLotMax != null ? ` AND lot_size_acres <= ${landLotMax}` : ''}` +
        `${tier.sameArea ? ` AND market area = ${subjectAreaName}` : ''}${tier.maxMiles != null ? ` AND distance <= ${tier.maxMiles} miles` : ''}. Returned ${rows.length} rows, ${added} new comps.`,
    )
    if (added > 0) tiersUsed.push(tier.name)
    if (byKey.size >= TARGET_COMPS) break
  }

  const disclosures: string[] = []
  const x = excludedTotals
  if (x.product_type > 0) {
    trace.push(
      `Excluded ${x.product_type} comp(s) on product type. A townhome, condo, or manufactured home is not comparable to a detached house at any distance, per Fannie Mae B4-1.3-08.`,
    )
  }
  if (x.bath_count > 0) {
    trace.push(
      `Excluded ${x.bath_count} sale(s) on bathroom count. A one-bath house is not priced from a two-bath sale.`,
    )
  }
  if (x.lot_character > 0) {
    trace.push(`Excluded ${x.lot_character} comp(s) on lot character (acreage vs in-town lot is not comparable at any distance).`)
  }
  if (x.market_area > 0) trace.push(`Excluded ${x.market_area} comp(s) outside the subject's market area.`)
  if (x.distance > 0) trace.push(`Excluded ${x.distance} comp(s) beyond the tier's distance bound.`)
  if (subject.subdivision && !subdivisionIlike) {
    trace.push(
      `The subject's SubdivisionName is "${subject.subdivision}", an MLS placeholder rather than a named subdivision, so the subdivision tiers were skipped and the ladder started at the neighborhood. Selecting on that placeholder would have matched unrelated sales across the whole city and labeled them same-subdivision comps.`,
    )
  }
  if (tiersUsed.some((t) => t.includes('12mo') || t.includes('24mo'))) {
    const older =
      'Comps older than 6 months were used because the 6-month set did not reach the minimum. Fannie Mae B4-1.3-08 requires this be stated.'
    trace.push(older)
    disclosures.push(older)
  }
  for (const t of tiers) {
    if (t.disclosure && tiersUsed.includes(t.name)) {
      trace.push(t.disclosure)
      disclosures.push(t.disclosure)
    }
  }
  const competingCount = [...byKey.values()].filter((c) => c.competingArea).length
  if (competingCount > 0) {
    const d = `${competingCount} comp(s) come from a COMPETING market area and are labeled as such on the report, per Fannie Mae B4-1.3-08.`
    trace.push(d)
    disclosures.push(d)
  }

  let comps = Array.from(byKey.values())
  const candidateCount = comps.length

  // Outlier exclusion: drop $/sqft beyond 2 standard deviations, only when the
  // set stays at or above MIN_COMPS afterward.
  const excludedOutliers: CompSelection['excludedOutliers'] = []
  if (comps.length >= TARGET_COMPS) {
    const ppsfs = comps.map((c) => unitRate(c, Boolean(land)))
    const mean = ppsfs.reduce((a, b) => a + b, 0) / ppsfs.length
    const sd = Math.sqrt(ppsfs.reduce((a, b) => a + (b - mean) ** 2, 0) / ppsfs.length)
    if (sd > 0) {
      const kept: CmaComp[] = []
      for (const c of comps) {
        const ppsf = unitRate(c, Boolean(land))
        if (Math.abs(ppsf - mean) > 2 * sd && comps.length - excludedOutliers.length > MIN_COMPS) {
          excludedOutliers.push({
            address: c.address,
            closePrice: c.closePrice,
            ppsf: Math.round(ppsf),
            reason: `$${Math.round(ppsf)}/${land ? 'acre' : 'sqft'} is more than 2 standard deviations from the set mean of $${Math.round(mean)}/${land ? 'acre' : 'sqft'}`,
          })
        } else {
          kept.push(c)
        }
      }
      comps = kept
      if (excludedOutliers.length > 0) {
        trace.push(
          `Excluded ${excludedOutliers.length} $/${land ? 'acre' : 'sqft'} outlier(s) beyond 2 standard deviations of the set mean.`,
        )
      }
    }
  }

  // Rank by similarity (size proximity x recency) and cap.
  const rankBy = land ? (subject.lotAcres ?? 0) : sqft
  comps.sort((a, b) => similarityScore(rankBy, b, Boolean(land)) - similarityScore(rankBy, a, Boolean(land)))
  comps = comps.slice(0, MAX_COMPS)
  // Present most recent first (matches the exemplar ordering).
  comps.sort((a, b) => b.closeDate.localeCompare(a.closeDate))

  trace.push(`Final comp set: ${comps.length} closed sales (tiers: ${tiersUsed.join(', ') || 'none'}).`)

  const ran = ladder.filter((t) => t.ran)
  const reachedTarget = candidateCount >= TARGET_COMPS
  const diagnostics: CompSelectionDiagnostics = {
    market_area: subjectAreaName,
    market_area_resolved: subjectArea != null,
    rural_acreage: ruralAcreage,
    subject: {
      sqft: subject.sqft ?? null,
      lot_acres: subject.lotAcres ?? null,
      subdivision: subdivisionIlike,
      subdivision_raw: subject.subdivision ?? null,
      product_sub_type: subject.propertySubType ?? null,
    },
    ladder,
    tiers_used: tiersUsed,
    reached_target: reachedTarget,
    starved: !reachedTarget,
    starved_at: reachedTarget ? null : (ran[ran.length - 1]?.tier ?? null),
    starved_reason: null,
    target_comps: TARGET_COMPS,
    min_comps: MIN_COMPS,
    candidates: candidateCount,
    excluded_totals: excludedTotals,
    outliers_excluded: excludedOutliers.length,
    final_count: comps.length,
    final_tier_counts: countByTier(comps),
    disclosures,
  }
  diagnostics.starved_reason = diagnoseStarvation(diagnostics)
  if (diagnostics.starved_reason && comps.length < MIN_COMPS) trace.push(diagnostics.starved_reason)
  return { comps, excludedOutliers, tiersUsed, trace, diagnostics }
}

/**
 * Build a comp selection from an explicit, broker-curated set of ListingKeys.
 * The broker has already vetted these for location / acreage / age / condition,
 * so the auto-tier widening + outlier drop + similarity cap are skipped. Rows
 * map through the SAME rowToComp mapper as selectComps, and the downstream
 * pipeline (judge narrative + weighting, adjustments, audit, contract, render)
 * is unchanged — this only replaces the SELECTION step.
 */
export async function selectCompsByKeys(subject: CmaSubject, keys: string[]): Promise<CompSelection> {
  const requested = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)))
  const rows = await selectCmaCompsByKeys(requested)
  const byKey = new Map<string, CmaComp>()
  for (const row of rows) {
    const comp = rowToComp(row, 'broker-selected')
    if (!comp) continue
    if (subject.listingKey && comp.listingKey === subject.listingKey) continue
    if (
      !productTypeCompatible(subject.propertySubType, comp.propertySubType) ||
      !keepSameProductType(subject.propertySubType, comp.propertySubType)
    )
      continue
    if (!bathCountCompatible(subject.baths, comp.baths)) continue
    if (!byKey.has(comp.listingKey)) byKey.set(comp.listingKey, comp)
  }
  // Most-recent-first, matching the exemplar ordering. No cap, no outlier drop.
  const comps = Array.from(byKey.values()).sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  const found = new Set(comps.map((c) => c.listingKey))
  const missing = requested.filter((k) => !found.has(k))
  const note = `Broker-selected comp set: ${comps.length} of ${requested.length} requested ListingKey(s) resolved as valid closed SFR${
    missing.length ? ` (unresolved: ${missing.join(', ')})` : ''
  }.`
  const diagnostics: CompSelectionDiagnostics = {
    ...emptyDiagnostics(subject, comps.length >= MIN_COMPS ? null : note),
    ladder: [
      {
        tier: 'broker-selected',
        ran: true,
        skipped_reason: null,
        months_back: 0,
        sqft_min: null,
        sqft_max: null,
        lot_min: null,
        lot_max: null,
        geography: `explicit ListingKey set (${requested.length} requested)`,
        rows_returned: rows.length,
        comps_added: comps.length,
        running_total: comps.length,
        excluded: emptyExclusions(),
      },
    ],
    tiers_used: ['broker-selected'],
    reached_target: comps.length >= MIN_COMPS,
    starved: comps.length < MIN_COMPS,
    starved_at: comps.length < MIN_COMPS ? 'broker-selected' : null,
    candidates: comps.length,
    final_count: comps.length,
    final_tier_counts: countByTier(comps),
  }
  return { comps, excludedOutliers: [], tiersUsed: ['broker-selected'], trace: [note], diagnostics }
}
