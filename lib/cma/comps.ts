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
 * vs in-town lot) is never comparable regardless of distance.
 */

import { selectCmaCompsPool, selectCmaCompsByKeys } from '@/lib/data'
import type { CmaListingRow } from '@/lib/data'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import { saneYearBuilt } from '@/lib/cma/subject'
import {
  distanceMiles,
  lotCharacterCompatible,
  productTypeCompatible,
  marketAreaBounds,
  radiusBounds,
  marketAreaName,
  proximityLabel,
  resolveMarketArea,
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

function rowToComp(row: CmaListingRow, tier: string): CmaComp | null {
  const closePrice = num(row['ClosePrice'])
  const sqft = num(row['TotalLivingAreaSqFt'])
  const closeDate = str(row['CloseDate'])
  const listingKey = str(row['ListingKey'])
  if (!closePrice || closePrice <= 0 || !sqft || sqft < 300 || !closeDate || !listingKey) return null
  const pendingTs = str(row['pending_timestamp'])
  const onMarket = str(row['OnMarketDate']) ?? str(row['ListDate'])
  let daysToOffer = num(row['days_to_pending'])
  if (daysToOffer == null && pendingTs && onMarket) {
    const ms = new Date(pendingTs).getTime() - new Date(onMarket).getTime()
    if (Number.isFinite(ms) && ms >= 0) daysToOffer = Math.round(ms / 86_400_000)
  }
  return {
    listingKey,
    mlsNumber: str(row['ListNumber']),
    address: `${str(row['StreetNumber']) ?? ''} ${str(row['StreetName']) ?? ''}`.trim(),
    city: str(row['City']) ?? '',
    subdivision: str(row['SubdivisionName']),
    latitude: num(row['Latitude']),
    longitude: num(row['Longitude']),
    beds: num(row['BedroomsTotal']),
    baths: num(row['BathroomsTotal']),
    sqft,
    lotAcres: num(row['lot_size_acres']),
    propertySubType: str(row['property_sub_type']),
    yearBuilt: saneYearBuilt(num(row['year_built'])),
    photoUrl: str(row['PhotoURL']),
    publicRemarks: str(row['public_remarks']),
    viewDescription: str(row['view_description']),
    taxAnnual: num(row['tax_annual_amount']),
    listPrice: num(row['ListPrice']),
    closePrice,
    closeDate: closeDate.slice(0, 10),
    daysToOffer,
    domTotal: num(row['CumulativeDaysOnMarket']) ?? num(row['DaysOnMarket']),
    selectionTier: tier,
  }
}

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}


function similarityScore(subjectSqft: number, comp: CmaComp): number {
  const sizeProximity = 1 / (1 + Math.abs(subjectSqft - comp.sqft) / subjectSqft)
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
export async function selectComps(subject: CmaSubject): Promise<CompSelection> {
  const sqft = subject.sqft ?? 0
  if (!sqft || !subject.city) {
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
      : 'Subject is outside every mapped neighborhood polygon, so comps fall back to distance from the subject.',
  )


  const tiers = compTierLadder(subdivisionIlike)
  const ruralAcreage = isRuralAcreage(subject, subjectArea)

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
      sqftMin,
      sqftMax,
      lotMin,
      lotMax,
      bounds: tierBounds,
      limit: tierBounds ? 500 : 100,
    })
    rung.rows_returned = rows.length
    let added = 0
    for (const row of rows) {
      const comp = rowToComp(row, tier.name)
      if (!comp) {
        rung.excluded.unusable_row++
        continue
      }
      if (subject.listingKey && comp.listingKey === subject.listingKey) {
        rung.excluded.self++
        continue
      }
      if (subject.streetAddress && comp.address.toLowerCase() === subject.streetAddress.toLowerCase()) {
        rung.excluded.self++
        continue
      }
      if (byKey.has(comp.listingKey)) {
        rung.excluded.duplicate++
        continue
      }

      // HARD EXCLUSION at every tier (Matt 2026-07-28): acreage and in-town lots
      // are different products with different buyer pools, at any distance.
      if (!lotCharacterCompatible(subject.lotAcres, comp.lotAcres)) {
        rung.excluded.lot_character++
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

      // HARD EXCLUSION at every tier: a townhome, condo, or manufactured home
      // does not compete with a detached house for the same buyer. PropertyType
      // 'A' mixes all of them, so without this the selector hands the judge a
      // contaminated set and the audit fails the build after the fact.
      if (!productTypeCompatible(subject.propertySubType, comp.propertySubType)) {
        rung.excluded.product_type++
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
      `Tier ${tier.name}: listings WHERE StandardStatus ILIKE '%Closed%' AND PropertyType='A' AND ClosePrice>0 AND CloseDate>='${closeDateGte}'${tier.ignoreCity ? '' : ` AND City ILIKE '${subject.city}'`}${tier.subdivisionIlike ? ` AND SubdivisionName ILIKE '${tier.subdivisionIlike}'` : ''} AND TotalLivingAreaSqFt BETWEEN ${sqftMin} AND ${sqftMax}${lotMin != null ? ` AND lot_size_acres BETWEEN ${lotMin} AND ${lotMax}` : ''}` +
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
    const ppsfs = comps.map((c) => c.closePrice / c.sqft)
    const mean = ppsfs.reduce((a, b) => a + b, 0) / ppsfs.length
    const sd = Math.sqrt(ppsfs.reduce((a, b) => a + (b - mean) ** 2, 0) / ppsfs.length)
    if (sd > 0) {
      const kept: CmaComp[] = []
      for (const c of comps) {
        const ppsf = c.closePrice / c.sqft
        if (Math.abs(ppsf - mean) > 2 * sd && comps.length - excludedOutliers.length > MIN_COMPS) {
          excludedOutliers.push({
            address: c.address,
            closePrice: c.closePrice,
            ppsf: Math.round(ppsf),
            reason: `$${Math.round(ppsf)}/sqft is more than 2 standard deviations from the set mean of $${Math.round(mean)}/sqft`,
          })
        } else {
          kept.push(c)
        }
      }
      comps = kept
      if (excludedOutliers.length > 0) {
        trace.push(`Excluded ${excludedOutliers.length} $/sqft outlier(s) beyond 2 standard deviations of the set mean.`)
      }
    }
  }

  // Rank by similarity (size proximity x recency) and cap.
  comps.sort((a, b) => similarityScore(sqft, b) - similarityScore(sqft, a))
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
