/**
 * Fetch + walk. The CMA / BPO / expired path calls this instead of scanning
 * listings for comps once sale_pricing_facts is populated.
 */

import { isRuralAcreage } from '@/lib/cma/comp-tiers'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import type { CmaSubject } from '@/lib/cma/types'
import {
  assignCommunitySlugs,
  assignSubdivisionSlugs,
  getSubdivisionRing,
  nextRowSubdivisionSlugs,
  readNeighborRings,
  touchingPlatsForSearch,
} from '@/lib/data/geo/subdivision-ring'
import { resolveSaleZones } from '@/lib/pricing/sale-zoning'
import {
  classifyHoa,
  classifyLot,
  classifyProduct,
  classifySewer,
  classifyStory,
  classifyWater,
  CENTRAL_OREGON_CITIES,
  citySlug,
  isCustomOrNewSubject,
  multiUnitFromRemarks,
  normSubdivision,
  type IrrigationClass,
  type StoryClass,
} from '@/lib/pricing/classes'
import {
  catchUpRecentPricingFacts,
  closeDayBefore,
  countSalePricingFacts,
  getListingWaterSource,
  getPricingMarketIndex,
  getPricingSubdivisionCells,
  selectPricingFactsNear,
  selectPricingFactsPool,
  selectSeniorCommunityListingKeys,
  selectListingBathSplits,
  RECENT_CLOSE_CATCH_UP_DAYS,
  type PricingFactsCatchUp,
} from '@/lib/data/pricing/facts'
import { estimateClosePrice, pricingSaleToCmaComp } from '@/lib/pricing/estimate'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import type { CompSelection } from '@/lib/cma/comps'
import { emptyExclusions } from '@/lib/cma/comp-trace'
import {
  FACTS_STANDALONE_MIN,
  factsPoolCloseAfter,
  LOCAL_POOL_RADIUS_MILES,
  PRICING_MIN_COMPS,
  PRICING_TARGET_COMPS,
} from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingMatchResult, type PricingSubject } from '@/lib/pricing/match'
import type { CmaMarketContext, CmaPricing } from '@/lib/cma/types'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'

export function cmaSubjectToPricing(
  subject: CmaSubject,
  extras: {
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    storyClass?: StoryClass
    zoning?: string | null
    irrigationClass?: IrrigationClass | null
  } = {},
): PricingSubject {
  const area = resolveMarketArea(subject.latitude, subject.longitude)
  const zoningFromSubject =
    'zoning' in subject ? (subject as CmaSubject & { zoning?: string | null }).zoning : undefined
  return {
    listingKey: subject.listingKey,
    streetAddress: subject.streetAddress,
    city: subject.city,
    citySlug: citySlug(subject.city),
    subdivision: subject.subdivision,
    subdivisionNorm: normSubdivision(subject.subdivision),
    latitude: subject.latitude,
    longitude: subject.longitude,
    beds: subject.beds,
    baths: subject.baths,
    bathsFull: subject.bathsFull ?? null,
    bathsHalf: subject.bathsHalf ?? null,
    sqft: subject.sqft ?? 0,
    lotAcres: subject.lotAcres,
    yearBuilt: subject.yearBuilt,
    storyClass: extras.storyClass ?? classifyStory(extras.levelsRaw ?? subject.levelsRaw, null),
    // A subject the remarks call a duplex is priced from multi-unit sales only.
    productClass: multiUnitFromRemarks(subject.publicRemarks) ? 'multi-unit' : classifyProduct(subject.propertySubType),
    waterClass: classifyWater(extras.waterRaw ?? subject.waterRaw),
    sewerClass: classifySewer(extras.sewerRaw ?? subject.sewerRaw),
    hoaClass: classifyHoa(subject.associationYn ?? null, subject.associationFee ?? subject.hoaMonthly ?? null),
    lotClass: classifyLot(subject.lotAcres),
    ruralAcreage: isRuralAcreage(subject, area),
    marketArea: area,
    newConstruction: subject.newConstructionYn ?? null,
    propertySubType: subject.propertySubType,
    zoning: extras.zoning ?? zoningFromSubject ?? null,
    publicRemarks: subject.publicRemarks,
    seniorCommunityYn: subject.seniorCommunityYn ?? null,
    irrigationClass: extras.irrigationClass ?? null,
  }
}

export async function selectPricingComps(
  subject: CmaSubject,
  opts: {
    /** The subject's county base zone (lib/cma/county.ts), for the rural zoning-class split. */
    subjectZoning?: string | null
    asOf?: string
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    subjectIrrigation?: IrrigationClass | null
    /**
     * Rebuild missing recent closes before reading the pool (default true).
     * Only the facts cron's listing stamp passes false: the same run has just
     * caught up every Central Oregon close of the window citywide.
     */
    catchUpRecent?: boolean
  } = {},
): Promise<PricingMatchResult & { factsReady: boolean }> {
  const factsReady = (await countSalePricingFacts()) >= 1000
  if (!factsReady) {
    return {
      comps: [],
      tiersUsed: [],
      trace: ['sale_pricing_facts is still backfilling. The listings ladder is the fallback.'],
      reachedTarget: false,
      starved: true,
      rungs: [],
      factsReady: false,
    }
  }
  let waterRaw = opts.waterRaw
  if (waterRaw == null && subject.listingKey) {
    waterRaw = await getListingWaterSource(subject.listingKey)
  }
  const pricingSubject = cmaSubjectToPricing(subject, {
    waterRaw,
    sewerRaw: opts.sewerRaw,
    levelsRaw: opts.levelsRaw,
    irrigationClass: opts.subjectIrrigation,
    zoning: opts.subjectZoning ?? null,
  })
  const asOf = (opts.asOf ?? new Date().toISOString()).slice(0, 10)
  const asOfYear = Number(asOf.slice(0, 4))
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: pricingSubject.yearBuilt,
      newConstructionYn: pricingSubject.newConstruction,
      remarks: pricingSubject.publicRemarks,
      propertySubType: subject.propertySubType,
      standardStatus: subject.standardStatus,
    },
    asOfYear,
  )
  // Ordinary: 24 months, the longest ordinary rung, and no further. Custom/new
  // stays at 30 so those 24-month rungs still have a pool. Do not shrink the 30.
  const closeAfterIso = factsPoolCloseAfter(asOf, customOrNew)
  const sqft = pricingSubject.sqft
  // THE POOL IS NEVER OLDER THAN THE CHARTS (2026-10-07, 3037 Purcell). The
  // letter's hero chart and subdivision box read live listings; the pool
  // below reads sale_pricing_facts, whose sweep reaches a new close only when
  // it next passes the end of the keyspace. Before reading, every close of the
  // last RECENT_CLOSE_CATCH_UP_DAYS in the subject's box and city that has no
  // facts row is rebuilt into the table by the facts SQL itself, so the pool
  // holds every sale those charts can print.
  const catchUpTrace =
    opts.catchUpRecent === false
      ? []
      : catchUpTraceLines(
          await catchUpRecentPricingFacts({
            since: closeDayBefore(asOf, RECENT_CLOSE_CATCH_UP_DAYS),
            cities: pricingSubject.ruralAcreage ? CENTRAL_OREGON_CITIES : [subject.city].filter(Boolean),
            near:
              pricingSubject.latitude != null && pricingSubject.longitude != null
                ? { latitude: pricingSubject.latitude, longitude: pricingSubject.longitude, radiusMiles: LOCAL_POOL_RADIUS_MILES }
                : null,
            maxRefresh: BUILD_CATCH_UP_MAX_REFRESH,
          }),
        )
  // THE SUBJECT'S OWN GROUND, COMPLETE, ALONGSIDE THE CITYWIDE READ (Matt
  // 2026-09-10). The citywide pool below is ordered newest-first and capped at
  // 800 rows, so for a Bend subject it reaches back about six months against
  // the eighteen it asked for that day — 2,471 sales matched, 800 came back. Every rung
  // under that line walked an empty older pool, so the ladder left the
  // neighborhood while the report said the neighborhood was exhausted. This
  // read covers the rungs containment actually depends on — the plat, the
  // plats beside it, the community, the 1- and 2-mile rings — across the whole
  // window and paged, so nothing local is lost to a row cap.
  const nearPool =
    pricingSubject.latitude != null && pricingSubject.longitude != null
      ? selectPricingFactsNear({
          latitude: pricingSubject.latitude,
          longitude: pricingSubject.longitude,
          radiusMiles: LOCAL_POOL_RADIUS_MILES,
          closeBefore: asOf,
          closeAfter: closeAfterIso,
          sqftMin: Math.round(sqft * 0.6),
          sqftMax: Math.round(sqft * 1.4),
          productClass: pricingSubject.productClass,
        })
      : Promise.resolve([])
  const [pool, localPool, ruralPool, cells, ring] = await Promise.all([
    selectPricingFactsPool({
      citySlug: pricingSubject.citySlug,
      closeBefore: asOf,
      closeAfter: closeAfterIso,
      sqftMin: Math.round(sqft * 0.6),
      sqftMax: Math.round(sqft * 1.4),
      productClass: pricingSubject.productClass,
      limit: 800,
    }),
    nearPool,
    pricingSubject.ruralAcreage
      ? selectPricingFactsPool({
          citySlug: null,
          ignoreCity: true,
          closeBefore: asOf,
          closeAfter: closeAfterIso,
          sqftMin: Math.round(sqft * 0.6),
          sqftMax: Math.round(sqft * 1.4),
          productClass: pricingSubject.productClass,
          limit: 800,
        })
      : Promise.resolve([]),
    getPricingSubdivisionCells(pricingSubject.citySlug),
    getSubdivisionRing(subject.latitude, subject.longitude),
  ])
  const byKey = new Map(pool.map((s) => [s.listingKey, s]))
  for (const s of localPool) if (!byKey.has(s.listingKey)) byKey.set(s.listingKey, s)
  for (const s of ruralPool) if (!byKey.has(s.listingKey)) byKey.set(s.listingKey, s)
  // AGE-RESTRICTED EVIDENCE THE FACTS TABLE DOES NOT CARRY. sale_pricing_facts
  // has no SeniorCommunityYN, and the age wall and the plat-majority share read
  // it (lib/pricing/age-restricted.ts), so the pool's true flags come from
  // listings. Only TRUE is read: false and null are the MLS default and are not
  // evidence either way.
  // The MLS full / half bath split, also only on listings: the room rule
  // compares full baths, and facts `baths` counts a powder room whole.
  const [seniorKeys, bathSplits] = await Promise.all([
    selectSeniorCommunityListingKeys([...byKey.keys()]),
    selectListingBathSplits([...byKey.keys()]),
  ])
  const sales = [...byKey.values()].map((s) => ({
    ...s,
    marketArea: s.marketArea ?? resolveMarketArea(s.latitude, s.longitude),
    seniorCommunityYn: seniorKeys.has(s.listingKey) ? true : null,
    bathsFull: bathSplits.get(s.listingKey)?.full ?? null,
    bathsHalf: bathSplits.get(s.listingKey)?.half ?? null,
  }))
  // Touching plats, closest first. When this home has a neighborhood, a plat
  // with inNeighborhood false stays out. Null means no polygon was tested and
  // does not exclude. The next row is only the plats that touch those plats.
  // A plat that merely sits in the parent is not in that row. The walk still
  // refuses a plat outside the parent community.
  if (ring) {
    const hasNeighborhood = Boolean(ring.neighborhoodSlug) || Boolean(pricingSubject.marketArea)
    const touching = touchingPlatsForSearch(ring.ring, hasNeighborhood)
    pricingSubject.subdivisionSlug = ring.homeSlug
    subject.subdivisionSlug = ring.homeSlug
    pricingSubject.platLabel = ring.homeLabel
    pricingSubject.adjacentSubdivisionSlugs = touching.map((p) => p.slug)
    const [neighborRings, slugs] = await Promise.all([
      readNeighborRings(touching),
      assignSubdivisionSlugs(sales.map((s) => ({ lat: s.latitude, lng: s.longitude }))),
    ])
    pricingSubject.closerSubdivisionSlugs = nextRowSubdivisionSlugs({
      subjectSlug: ring.homeSlug,
      firstRingSlugs: touching.map((p) => p.slug),
      neighborRings,
      subjectHasNeighborhood: hasNeighborhood,
    })
    sales.forEach((s, i) => {
      s.subdivisionSlug = slugs[i]
    })
  }
  // Community membership is the boundary that contains the address, for every
  // community. A failed read leaves the registry-name fallback in place.
  const communityPoints = [
    { lat: pricingSubject.latitude, lng: pricingSubject.longitude },
    ...sales.map((s) => ({ lat: s.latitude, lng: s.longitude })),
  ]
  const communitySlugs = await assignCommunitySlugs(communityPoints)
  if (communitySlugs) {
    pricingSubject.communityLocated = true
    pricingSubject.communitySlug = communitySlugs[0]
    sales.forEach((s, i) => {
      s.communityLocated = true
      s.communitySlug = communitySlugs[i + 1] ?? null
    })
    subject.communityLocated = true
    subject.communitySlug = communitySlugs[0] ?? null
  }
  // Delta 4 (Matt 2026-09-09): a rural sale's zoning class is a hard split,
  // and the facts table carries no zone. Nearest rural sales first, county
  // GIS through the cache, at most MAX_ZONE_LOOKUPS live queries a build.
  if (pricingSubject.ruralAcreage || (pricingSubject.lotAcres ?? 0) >= 1) {
    const sLat = pricingSubject.latitude ?? 0
    const sLng = pricingSubject.longitude ?? 0
    const rural = sales
      .filter((x) => (x.lotAcres ?? 0) >= 1 && x.latitude != null && x.longitude != null)
      .sort((a, b) => ((a.latitude! - sLat) ** 2 + (a.longitude! - sLng) ** 2) - ((b.latitude! - sLat) ** 2 + (b.longitude! - sLng) ** 2))
      .slice(0, 160)
    const zones = await resolveSaleZones(rural.map((x) => ({ listingKey: x.listingKey, latitude: x.latitude, longitude: x.longitude })))
    for (const x of sales) {
      const z = zones.get(x.listingKey)
      if (z !== undefined) x.zoning = z
    }
  }
  const walked = walkPricingLadder(pricingSubject, sales, { asOf, cells })
  return { ...walked, trace: [...catchUpTrace, ...walked.trace], factsReady: true }
}

/** Missing recent closes one comp search may rebuild before it reads (the 6-hourly cron takes the rest). */
export const BUILD_CATCH_UP_MAX_REFRESH = 60

/**
 * The search's own record of the catch-up: what it added, and what it could
 * not, so a reviewer can tell a pool that holds the charts' sales from one
 * that may not.
 */
export function catchUpTraceLines(c: PricingFactsCatchUp): string[] {
  const lines: string[] = []
  if (c.refreshed.length > 0) {
    lines.push(
      `Recent closes caught up: ${c.refreshed.length} sale(s) closed since ${c.since} had no row in sale_pricing_facts and were added before the search (${c.refreshed.join(', ')}).`,
    )
  }
  const short = c.failed.length + c.deferred.length
  if (short > 0 || c.error) {
    const keys = [...c.failed.map((f) => f.listingKey), ...c.deferred]
    lines.push(
      `Recent closes NOT caught up: ${short} sale(s) closed since ${c.since} are in listings but not in sale_pricing_facts${
        keys.length > 0 ? ` (${keys.slice(0, 20).join(', ')}${keys.length > 20 ? ', ...' : ''})` : ''
      }${c.error ? `; ${c.error}` : ''}. The charts can print a sale this search did not see.`,
    )
  }
  return lines
}

export async function priceSubjectFromFacts(
  subject: CmaSubject,
  opts: {
    asOf?: string
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    market?: CmaMarketContext | null
    subjectIrrigation?: IrrigationClass | null
    /** See selectPricingComps. */
    catchUpRecent?: boolean
  } = {},
): Promise<{
  match: PricingMatchResult & { factsReady: boolean }
  pricing: CmaPricing | null
  predictedClose: number | null
  compsImpliedClose: number | null
  recommendedList: number | null
  medianDaysToOffer: number | null
  pathNotes: string[]
  regime: string
  index: MarketIndexPoint[]
}> {
  const asOf = (opts.asOf ?? new Date().toISOString()).slice(0, 10)
  const match = await selectPricingComps(subject, opts)
  let waterRaw = opts.waterRaw
  if (waterRaw == null && subject.listingKey) {
    waterRaw = await getListingWaterSource(subject.listingKey)
  }
  const pricingSubject = cmaSubjectToPricing(subject, {
    waterRaw,
    sewerRaw: opts.sewerRaw,
    levelsRaw: opts.levelsRaw,
    irrigationClass: opts.subjectIrrigation,
  })
  const index = await getPricingMarketIndex(pricingSubject.citySlug)
  const est = estimateClosePrice({
    subject,
    subjectStory: pricingSubject.storyClass,
    comps: match.comps,
    compStories: match.comps.map((c) => c.storyClass),
    points: index,
    asOf,
    market: opts.market ?? null,
  })
  return { match, ...est, index }
}

/**
 * The geographic bound a rung searched, in plain language. The listings ladder
 * writes a SQL-shaped string here; the facts ladder has no per-rung query, so
 * this names the same bound from the tier itself.
 */
function ladderGeography(tier: string, subject: CmaSubject): string {
  const sub = (subject.subdivision ?? '').trim()
  const city = (subject.city ?? '').trim()
  if (tier.startsWith('subdivision-')) {
    return sub ? `subdivision ${sub}${city ? `, ${city}` : ''}` : 'the subject subdivision'
  }
  if (tier.startsWith('pocket-')) {
    return `mapped pockets within a quarter mile${city ? `, ${city}` : ''}`
  }
  const miles = tier.match(/(\d+(?:\.\d+)?)mi/)?.[1] ?? null
  if (tier.startsWith('rural-')) {
    return miles ? `within ${miles} miles, any mailing city` : 'rural, any mailing city'
  }
  if (tier.startsWith('similar-sub')) {
    return `subdivisions within 30% of the subject subdivision's median $/sqft${city ? `, ${city}` : ''}`
  }
  if (miles) return `within ${miles} miles of the subject${city ? `, ${city}` : ''}`
  return city || 'the subject market'
}

export function matchToCompSelection(
  subject: CmaSubject,
  match: PricingMatchResult,
  opts: { customOrNew?: boolean } = {},
): CompSelection & { pricingSales: SelectedPricingComp[] } {
  const area = resolveMarketArea(subject.latitude, subject.longitude)
  const customOrNew =
    opts.customOrNew ??
    isCustomOrNewSubject({
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstructionYn,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
      standardStatus: subject.standardStatus,
    })
  // The floor and the target are one number (PRICING_MIN_COMPS equals
  // PRICING_TARGET_COMPS, Matt 2026-10-07), so a starved set is a short set.
  const underMin = match.comps.length < PRICING_MIN_COMPS
  const starvedReason = underMin
    ? `facts path: only ${match.comps.length} price-setting sale(s) after the full pricing ladder (minimum ${PRICING_MIN_COMPS}). Comp shortage. Custom/new stays on facts; listings SQL tiers are not a fallback.`
    : null
  const bench = match.bench ?? []
  return {
    comps: match.comps.map(pricingSaleToCmaComp),
    excludedOutliers: [],
    tiersUsed: match.tiersUsed,
    trace: match.trace,
    pricingSource: 'facts',
    pricingSales: match.comps,
    ownPlatAgeRestrictedShare: match.ownPlatAgeRestrictedShare ?? null,
    // Refill from the same rung (Matt 2026-10-08): the reach rung's remaining
    // qualifying sales, in the rung's order, for the comparability review.
    refill: {
      rung: match.reachedOnTier ?? null,
      widening: match.reachedOnWidening === true,
      comps: bench.map(pricingSaleToCmaComp),
      pricingSales: bench,
    },
    diagnostics: {
      refill_bench: { rung: match.reachedOnTier ?? null, widening: match.reachedOnWidening === true, held: bench.length },
      market_area: marketAreaName(area),
      market_area_resolved: area != null,
      rural_acreage: isRuralAcreage(subject, area),
      pricing_source: 'facts',
      custom_or_new: customOrNew,
      subject: {
        sqft: subject.sqft ?? null,
        lot_acres: subject.lotAcres ?? null,
        subdivision: match.inferredPocket?.subdivision ?? subject.subdivision ?? null,
        subdivision_raw: subject.subdivision ?? null,
        product_sub_type: subject.propertySubType ?? null,
      },
      // THE LADDER, FILLED ON THE FACTS PATH TOO (round four, class E). This
      // was an empty array, so every counted question about the search —
      // "what did the subdivision rungs actually return" — had no answer on
      // the path all four round-four exemplars took, and the seller-facing
      // story was written from the tier names alone. `excluded` stays at zero
      // here because the facts ladder rejects inside passesTier without
      // categorising the reason, the same convention `excluded_totals` above
      // already carries on this path. It is "not counted", never "none".
      ladder: match.rungs.map((r) => ({
        tier: r.tier,
        ran: r.ran,
        skipped_reason: r.skippedReason,
        months_back: r.monthsBack,
        sqft_min: null,
        sqft_max: null,
        lot_min: null,
        lot_max: null,
        geography: ladderGeography(r.tier, subject),
        rows_returned: r.scanned,
        comps_added: r.added,
        running_total: r.runningTotal,
        excluded: emptyExclusions(),
        not_setting: r.notSetting,
      })),
      price_anchor: match.priceAnchor
        ? { ppsf: Math.round(match.priceAnchor.ppsf), n: match.priceAnchor.n }
        : null,
      tiers_used: match.tiersUsed,
      reached_target: match.reachedTarget,
      starved: match.starved,
      starved_at: match.starved ? match.tiersUsed[match.tiersUsed.length - 1] ?? null : null,
      starved_reason: starvedReason,
      target_comps: PRICING_TARGET_COMPS,
      min_comps: PRICING_MIN_COMPS,
      candidates: match.comps.length,
      // The facts ladder rejects inside passesTier without a reason, so the
      // totals stay at zero — except the acreage splits, which the walk counts
      // once over the rural pool for the reader's story (Delta 4).
      excluded_totals: { ...emptyExclusions(), ...(match.ruralSplits ?? {}) },
      not_price_setting: match.rungs.reduce((n, r) => n + (r.notSetting ?? 0), 0),
      outliers_excluded: 0,
      final_count: match.comps.length,
      final_tier_counts: Object.fromEntries(
        match.tiersUsed.map((t) => [t, match.comps.filter((c) => c.selectionTier === t).length]),
      ),
      disclosures: match.trace.filter((t) => t.includes('Fannie') || t.includes('subdivision')),
    },
  }
}

/**
 * Facts win when they produced a priceable set. Under five price-setting
 * sales (FACTS_STANDALONE_MIN, equal to PRICING_MIN_COMPS since 2026-10-07),
 * ordinary resale falls back to the listings ladder; under five on both
 * ladders the build fails as a comp shortage.
 *
 * Custom/new must NOT fall back: the listings ladder still uses
 * unmappedCrossesKnownBank, which re-starves Perspective-class peers and can
 * pad TARGET_COMPS with 1970s stock the facts year-quality gate already refused
 * (live Rim View after a8ab9ded). Stay on facts even at 1–2 comps so the build
 * fails cleanly and recordBuildFailure can clear the stale kept-set draft.
 */
export function pickCompSource(match: {
  factsReady: boolean
  comps?: unknown[]
  customOrNew?: boolean
}): 'facts' | 'listings' {
  // Custom/new NEVER falls back to listings — even when facts are not ready.
  // The listings ladder still uses unmappedCrossesKnownBank and can pad
  // TARGET_COMPS with 1970s stock (live Rim View 144→2, 47/34/33).
  // Stay on facts and fail clean so recordBuildFailure clears the stale draft.
  if (match.customOrNew) return 'facts'
  if (!match.factsReady) return 'listings'
  const n = match.comps?.length ?? 0
  if (n >= FACTS_STANDALONE_MIN) return 'facts'
  return 'listings'
}

// factsOutlastShortListings was deleted 2026-10-07. It let a three- or
// four-sale facts set price when the listings ladder found fewer (1648
// Pheasant: facts held 3, listings held 1). With PRICING_MIN_COMPS equal to
// FACTS_STANDALONE_MIN (5), pickCompSource already keeps a five-sale facts
// set, and under five on both ladders the build fails as a comp shortage.

export async function selectCompsPreferringFacts(
  subject: CmaSubject,
  opts: {
    subjectIrrigation?: IrrigationClass | null
    subjectZoning?: string | null
    asOf?: string
  } = {},
): Promise<CompSelection> {
  // Classify BEFORE any ladder. Custom/new must never load listings SQL tiers
  // (subdivision / competing-area / citywide) — live Rim View after #187 still
  // showed those when the refuse lived only after selectPricingComps returned.
  const customOrNew = isCustomOrNewSubject({
    yearBuilt: subject.yearBuilt,
    newConstructionYn: subject.newConstructionYn,
    remarks: subject.publicRemarks,
    propertySubType: subject.propertySubType,
    standardStatus: subject.standardStatus,
  })
  if (customOrNew) {
    const match = await selectPricingComps(subject, opts)
    return matchToCompSelection(subject, match, { customOrNew })
  }
  const { selectComps } = await import('@/lib/cma/comps')
  const match = await selectPricingComps(subject, opts)
  if (pickCompSource({ ...match, customOrNew }) === 'facts') {
    return matchToCompSelection(subject, match, { customOrNew })
  }
  return selectComps(subject, opts)
}
