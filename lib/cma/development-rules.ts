/**
 * Per-jurisdiction development rules for the CMA development section.
 * Split out of lib/cma/development.ts to hold the per-file size budget.
 *
 * Every rule string traces to a fact verified against its PRIMARY source. Do
 * not edit a rule without re-verifying against the source. The verification
 * history and the four 2026-07-30 corrections are documented in
 * lib/cma/development.ts and inline below.
 */
import type { DevItem, DevVerdict } from '@/lib/cma/development-types'
import { V1, V2 } from '@/lib/cma/development-types'
import { normalizeRedmond } from '@/lib/cma/zoning-explainer'

const usd0 = (n: number) => n.toLocaleString('en-US')

/** Normalize a GIS zone string to the registry vocabulary. The county layer
 *  returns e.g. "SR2-1/2" for SR-2½ — alias it (audit finding 2026-07-14). */
export function canonicalZone(zone: string): string {
  const z = zone.toUpperCase().replace(/\s+/g, '')
  if (z === 'SR2-1/2' || z === 'SR21/2' || z === 'SR2.5' || z === 'SR-2.5') return 'SR2.5'
  return z.replace(/-/g, '') === 'RM10' ? 'RM-10' : z
}

/** County registry key for a canonical zone string. */
export function countyZoneKey(canonical: string): string {
  return canonical === 'SR2.5' ? 'SR2.5' : canonical.replace(/-/g, '')
}

export interface ZoneResult {
  items: DevItem[]
  /** Conforming lots the code arithmetic supports, when it can be computed. */
  potentialLots: number | null
}

// ── The verified registry, applied per zone ─────────────────────────────────
/* Every rule string below traces to a fact verified against its primary source.
 * Do not edit a rule without re-verifying against the source. */

// Bend residential districts. BDC Table 2.1.200 lists ADUs 'P' in all six.
const BEND_RESIDENTIAL = new Set(['UAR', 'RL', 'RS', 'RM-10', 'RM', 'RH'])

export function bendItems(zone: string, lotSqft: number | null, acres: number | null): ZoneResult {
  const items: DevItem[] = []
  const z = canonicalZone(zone)
  let potentialLots: number | null = null

  // Minimum single-unit lot areas + density (BDC Table 2.1.500 / 2.1.600),
  // re-read verbatim 2026-07-30.
  const minLot: Record<string, number | null> = { RS: 4000, 'RM-10': 4000, RL: 10000, RM: 2500, RH: null }
  const density: Record<string, string> = {
    RL: '1.1 to 4.0 units per gross acre',
    RS: '4.0 to 7.3 units per gross acre',
    'RM-10': '6.0 to 10.0 units per gross acre',
    RM: '7.3 to 21.7 units per gross acre',
    RH: '21.7 units per gross acre minimum, no maximum',
  }
  // Max density (units per gross acre) caps the division arithmetic so the
  // headline never prints a count Table 2.1.600 forbids (audit finding).
  const maxDensity: Record<string, number | null> = { RL: 4.0, RS: 7.3, 'RM-10': 10.0, RM: 21.7, RH: null }

  if (z === 'UAR') {
    const couldFit = acres != null ? Math.floor(acres / 10) : 0
    potentialLots = acres != null ? couldFit : null
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage carries ${couldFit} lots at the 10-acre minimum. A planning conversation decides the rest.`
          : 'This parcel stays a single holding until the land urbanizes, which is what keeps the density where it is.',
      detail: `Urban Area Reserve requires a 10-acre minimum lot for a single-unit dwelling, and the density standard is one unit per 10 gross acres, minimum and maximum.${acres != null ? ` This parcel is ${acres} acres.` : ''} UAR is a holding zone for future urban development, so a division into urban-size lots follows annexation and a plan amendment rather than the current zone. The practical next step for a buyer interested in that horizon is a pre-application conference with Bend Planning.`,
      citation: 'Bend Development Code Table 2.1.100, Table 2.1.500, Table 2.1.600',
      url: 'https://bend.municipal.codes/BDC/2.1.500',
      verifiedOn: V2,
    })
  } else if (z === 'RH') {
    // CORRECTION 2026-07-30. The prior encoding read Table 2.1.500's "Not
    // applicable" for RH single-unit lot area as "RH has no minimum lot area"
    // and told the reader division turned only on density and infrastructure.
    // That inverted the meaning. Table 2.1.200 lists Single-unit detached
    // dwelling as "N" (not permitted) in RH, which is WHY the lot-area cell is
    // "Not applicable". Division in RH runs through attached and multi-unit
    // housing types, not single-unit lots.
    items.push({
      topic: 'Subdivide or partition',
      verdict: 'confirm',
      headline: 'Division here runs through townhomes and middle housing rather than single-unit lots.',
      detail:
        'High Density Residential does not list a single-unit detached dwelling as a permitted use, so Table 2.1.500 shows no single-unit lot area for the zone. The lot standards that do apply are a 1,250 sqft minimum for a duplex, 2,500 sqft for a triplex or quadplex, a 1,200 sqft average per unit for townhomes, and no minimum lot area at all for multi-unit development. Minimum density is 21.7 units per gross acre with no maximum. A land division here is a townhome or middle-housing division, and the real number turns on access, utilities, and design review. Worth a planning conversation before you price the upside.',
      citation: 'Bend Development Code Table 2.1.200, Table 2.1.500, Table 2.1.600',
      url: 'https://bend.municipal.codes/BDC/2.1.500',
      verifiedOn: V2,
    })
  } else if (z in minLot) {
    const min = minLot[z]
    if (min != null && lotSqft != null) {
      const byLot = Math.floor(lotSqft / min)
      const maxD = maxDensity[z]
      const byDensity = maxD != null && acres != null ? Math.floor(acres * maxD) : byLot
      const couldFit = Math.min(byLot, byDensity)
      potentialLots = couldFit
      items.push({
        topic: 'Subdivide or partition',
        verdict: couldFit >= 2 ? 'conditional' : 'no',
        headline:
          couldFit >= 2
            ? `This lot carries up to ${couldFit} conforming lots on the code arithmetic. Access and utilities set the real number.`
            : `This is a single conforming lot in ${z}, held to the same ${usd0(min)} sqft minimum as every lot around it.`,
        detail: `${z} requires a ${usd0(min)} sqft minimum lot for a single-unit dwelling, with density of ${density[z]}. This parcel is ${usd0(Math.round(lotSqft))} sqft${acres != null ? `, or ${acres} acres` : ''}. ${
          couldFit >= 2
            ? `That supports up to ${couldFit} conforming lots inside both the lot minimum and the density ceiling. A buyer would take a land-division application to Bend Planning, and street access, utility capacity, and any overlays govern what actually plats. A townhome division goes further, at a 1,500 sqft average per unit. Fractional units round down for maximum density.`
            : `Two conforming single-unit lots do not fit at the code minimum, so the value here is the house and the lot as they stand. A second unit is still available through an ADU or a middle-housing configuration, both covered below.`
        }`,
        citation: 'Bend Development Code Table 2.1.500 (lot areas) and Table 2.1.600 (density)',
        url: 'https://bend.municipal.codes/BDC/2.1.500',
        verifiedOn: V2,
      })
    }
  }

  // ADU — permitted in all six residential districts (BDC Table 2.1.200).
  // Standards re-read from BDC 3.6.200(B) on 2026-07-30.
  if (BEND_RESIDENTIAL.has(z)) {
    items.push({
      topic: 'ADU',
      verdict: 'yes',
      headline: 'Allowed outright, up to two accessory dwelling units on this lot.',
      detail:
        'An ADU is a permitted use in every Bend residential district on a lot with a single-unit dwelling. The first ADU is capped at 800 sqft of floor area and a second at 500 sqft, and ADUs are exempt from the zone\'s maximum density. Oregon law bars the city from imposing an owner-occupancy requirement or an added off-street parking requirement. A detached ADU sits at least six feet from other dwelling units on the lot. Two limits to know: a second ADU that pushes the lot past the zone density triggers a sewer-capacity analysis, and ADUs are not permitted on a lot created by a middle-housing land division or in a cottage development. Cities keep the ability to require owner-occupancy or parking where the unit is used for vacation occupancy.',
      citation: 'Bend Development Code 3.6.200(B) and Table 2.1.200; ORS 197A.425(1)(b)(B), 197A.425(2)',
      url: 'https://bend.municipal.codes/BDC/3.6.200',
      verifiedOn: V2,
    })
  }

  // Short-term rental — BDC 3.6.500 (Ord. NS-2541, 2025) and BC Ch. 7.16.
  // Subsections (A) through (G) re-read verbatim 2026-07-30.
  const BEND_STR_BUFFER_ZONES = new Set(['SR2.5', 'RL', 'RS', 'RM', 'RM-10', 'RH', 'MR'])
  const BEND_STR_COMMERCIAL = new Set(['CL', 'CG', 'CC', 'CB', 'CN', 'ME', 'MU', 'MN'])
  if (BEND_STR_BUFFER_ZONES.has(z)) {
    items.push({
      topic: 'Short-term rental',
      verdict: 'conditional',
      headline: 'A hosted rental is obtainable here. A whole-house permit depends on what the neighbors already hold.',
      detail:
        'Bend short-term rentals take two authorizations, a land use permit and an annual operating license. An owner-occupied hosted rental of up to two rooms is processed administratively as a Type I application and is exempt from the separation rule, as is an infrequent whole-house rental under 30 days a year across no more than four rental periods. A regular whole-house rental in the residential zones is a Type II permit, and the code requires at least 500 feet of radial separation from any property zoned RL, RS, RM, RH, or MR outside the Old Mill District that already holds a valid Type II application, permit, or pre-2015 approval. Availability at this address therefore turns on nearby permits, so check the city map before you price it in. Maximum occupancy is two people per bedroom plus two. A permit does not run with the land: it terminates on sale, and the buyer applies fresh under the rules then in effect, including the separation test. Where a property holds more than one dwelling unit, applications after November 4, 2021 allow only one of those units to be permitted. Mount Bachelor Village, Deschutes Landing, and Courtyards at Broken Top lots 1 to 8 and 21 to 32 are exempt from the land use permit and the separation rule, and the operating license still applies.',
      citation: 'Bend Development Code 3.6.500(A), (C), (E), (F), (G); Bend Code Ch. 7.16',
      url: 'https://bend.municipal.codes/BDC/3.6.500',
      verifiedOn: V2,
    })
  } else if (BEND_STR_COMMERCIAL.has(z)) {
    items.push({
      topic: 'Short-term rental',
      verdict: 'yes',
      headline: 'Allowed administratively, and exempt from the separation rule.',
      detail:
        'In Bend\'s commercial and mixed-use zones a short-term rental is processed as a Type I administrative application and is expressly exempt from the 500-foot concentration limit. Whole-dwelling rental is allowed with no annual day cap. The land use permit and the annual operating license are both still required, maximum occupancy is two people per bedroom plus two, and a permit terminates on sale of the property rather than running with the land.',
      citation: 'Bend Development Code 3.6.500(C)(1), (E), (F), (G); Bend Code Ch. 7.16',
      url: 'https://bend.municipal.codes/BDC/3.6.500',
      verifiedOn: V2,
    })
  }

  // Middle housing / second dwelling (BDC Table 2.1.200, 2.1.200(D), 3.8.900).
  if (['RL', 'RS', 'RM-10', 'RM', 'RH'].includes(z)) {
    items.push({
      topic: 'Middle housing',
      verdict: 'yes',
      headline: `Duplex through quadplex and townhomes are permitted uses in ${z}.`,
      detail: `Under Oregon's middle-housing law, Bend lists duplexes, triplexes, quadplexes, and townhomes as permitted uses in ${z}. Cottage clusters are permitted in RL, RS, RM-10, and RM. All of these are exempt from the zone's maximum density, so the binding constraint is the lot-area standard rather than the density ceiling. A townhome land division runs on a 1,500 sqft average per unit in RL, RS, RM-10, and RM, and 1,200 sqft in RH. Site standards and design review apply, and a lot created by a middle-housing land division cannot be divided again or carry an ADU.`,
      citation: 'Bend Development Code Table 2.1.200; BDC 2.1.600(B)(2); BDC 3.6.200(A); ORS 197A.420',
      url: 'https://bend.municipal.codes/BDC/2.1.200',
      verifiedOn: V2,
    })
    items.push({
      topic: 'Second dwelling',
      verdict: 'yes',
      headline: 'A second unit is achievable here, either as an ADU or by converting to a duplex.',
      detail:
        'Bend gives this lot two routes to a second unit. The first is an ADU, up to two of them, covered above. The second is a conversion: the code expressly allows converting an existing single-unit detached dwelling to a duplex, and a single-unit dwelling or duplex to a triplex or quadplex, provided the conversion does not increase nonconformance. Both routes are permitted uses in this zone subject to the development standards, so neither one needs a conditional use permit.',
      citation: 'Bend Development Code 2.1.200(D)(1), (D)(2), Table 2.1.200, and 3.6.200(B)',
      url: 'https://bend.municipal.codes/BDC/2.1.200',
      verifiedOn: V2,
    })
  }
  return { items, potentialLots }
}

export function redmondItems(zone: string, lotSqft: number | null): ZoneResult {
  const items: DevItem[] = []
  const z = normalizeRedmond(canonicalZone(zone))
  let potentialLots: number | null = null
  // RDC Sec. 8.140 Table B, re-read verbatim 2026-07-30.
  const minLot: Record<string, number> = { 'R-1': 9000, 'R-2': 9000, 'R-3': 7500, 'R-3A': 7500, 'R-4': 5500, 'R-5': 5500 }
  const maxSfDensity: Record<string, number> = { 'R-1': 5, 'R-2': 5, 'R-3': 5.8, 'R-3A': 5.8, 'R-4': 8, 'R-5': 8 }

  // Residential zones only — a commercial/industrial Redmond parcel gets no
  // parcel-level residential claims (audit finding 2026-07-14). Empty items →
  // the section is omitted for that parcel.
  if (!(z in minLot)) return { items, potentialLots }

  if (lotSqft != null) {
    const min = minLot[z]!
    const couldFit = Math.floor(lotSqft / min)
    potentialLots = couldFit
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `This lot carries up to ${couldFit} conforming lots on the code arithmetic. Access and utilities set the real number.`
          : `This is a single conforming lot in ${z}, held to the same ${usd0(min)} sqft minimum as every lot around it.`,
      detail: `${z} requires a ${usd0(min)} sqft minimum lot for a single-family home, duplex, or triplex, and caps single-family density at ${maxSfDensity[z]} units per net acre. This parcel is ${usd0(Math.round(lotSqft))} sqft. ${
        couldFit >= 2
          ? `That supports up to ${couldFit} conforming lots. A partition creates up to three parcels in a calendar year and a subdivision four or more. Because Redmond measures density on NET acres, land taken for right-of-way comes out of the calculation first, so street dedication is the usual reason a plat yields fewer lots than the raw arithmetic. A townhouse division goes further, at a 1,500 sqft minimum per unit lot.`
          : `Two conforming lots do not fit at the code minimum, so the value here is the house and the lot as they stand. A second unit is still available through an ADU or a middle-housing configuration, both covered below.`
      }`,
      citation: 'Redmond Development Code Ch. 8, Sec. 8.140 Table B',
      url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_REUSZO_S8.140TABMIST',
      verifiedOn: V2,
    })
  }
  items.push({
    topic: 'ADU',
    verdict: 'yes',
    headline: 'Allowed outright in every Redmond residential zone.',
    detail:
      'Redmond lists an accessory dwelling unit as permitted outright in R-1 through R-5 and in R-3A. A stand-alone ADU runs between 300 and 900 sqft of gross floor area and must work as a genuine separate dwelling: its own exterior entrance, its own kitchen, and its own bathroom. It cannot sit forward of the primary home\'s forward-most façade, and an ADU above a garage cannot exceed the garage footprint. Maximum height matches the zone, 32 ft in R-1 through R-3A and 45 ft in R-4 and R-5. The primary home keeps its own minimum parking after the ADU is added. A guest house is the separate, related option: 300 to 1,200 sqft, and no kitchen.',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.135 Table A, Sec. 8.137, and Sec. 8.325',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_SUPR_S8.325ACDWUNGUHO',
    verifiedOn: V2,
  })
  items.push({
    topic: 'Middle housing',
    verdict: 'yes',
    headline: 'Duplex, triplex, quadplex, townhouse, and cottage cluster are all permitted outright here.',
    detail:
      'Redmond lists duplexes, triplexes, quadplexes, townhouses, and cottage clusters as outright uses in every residential zone, with middle-housing land divisions available to put each unit on its own lot. There is no maximum density for a duplex, triplex, quadplex, or cottage cluster: the binding standard is minimum lot size. A quadplex or cottage cluster needs 9,000 sqft in R-1 and R-2, 7,500 sqft in R-3 and R-3A, and 7,000 sqft in R-4 and R-5. A townhouse lot needs 1,500 sqft. Cottage clusters run at four or more units per cluster, a 900 sqft maximum footprint each, and a shared common courtyard.',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.135 Table A, Sec. 8.140 Table B, Sec. 8.143; ORS 197A.420',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_REUSZO_S8.140TABMIST',
    verifiedOn: V2,
  })
  items.push({
    topic: 'Second dwelling',
    verdict: 'yes',
    headline: 'A second unit is achievable here, either as an ADU or by converting to a duplex.',
    detail:
      'Redmond gives this lot two routes to a second unit. The first is an ADU under Sec. 8.325, covered above. The second is a conversion: the code expressly allows converting an existing single-family detached dwelling to a duplex, triplex, or quadplex, provided the conversion does not increase nonconformance with the underlying zone. Both are outright uses subject to the development standards.',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.325, Sec. 8.135 Table A, and Sec. 8.141(5)(10)',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_SUPR_S8.325ACDWUNGUHO',
    verifiedOn: V2,
  })
  // Short-term rental — Redmond City Code Secs. 7.132 to 7.140, verified
  // 2026-07-14. NOT re-read on 2026-07-30, so the date below stays V1.
  items.push({
    topic: 'Short-term rental',
    verdict: 'conditional',
    headline: 'Allowed in the residential zones with a city permit, and Redmond sets no separation rule or cap.',
    detail:
      'Redmond permits short-term rentals in residential zones, and in the Mixed Use Neighborhood and C2 zones, with a city STR permit, a business license, and the 9% lodging tax. The standards are straightforward: one extra off-street parking space, occupancy caps, no signage. Housing type is the real gate. No short-term rental is allowed in a triplex, quadplex, cottage development, or multi-family complex. A duplex qualifies only when the other unit is owner-occupied or a long-term rental, and where a home and an ADU share a lot only one of the two may rent short-term. Unlike Bend there is no separation rule, cap, or waitlist, so a conforming property that meets the standards qualifies.',
    citation: 'Redmond City Code Secs. 7.132 to 7.140 (STR permit, zones, standards); Secs. 7.100 to 7.130 (lodging tax)',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances',
    verifiedOn: V1,
  })
  return { items, potentialLots }
}

const DC_BOOK = 'https://deschutescounty.municipalcodeonline.com'

export function countyItems(zone: string, acres: number | null, overlays: string[]): ZoneResult {
  const items: DevItem[] = []
  let potentialLots: number | null = null
  // Canonical + dash-stripped forms so real GIS strings ("SR2-1/2", "RR-10")
  // hit the registry keys (audit finding 2026-07-14).
  const z = canonicalZone(zone)
  const zKey = z === 'SR2.5' ? 'SR2.5' : z.replace(/-/g, '')
  const isEfu = /^EFU/.test(z)
  const isForest = zKey === 'F1' || zKey === 'F2'
  const waOverlay = overlays.includes('WA')
  // Title 18 rural zones use DCC 18.116.355 for the residential ADU and
  // 18.116.350 for the historic-home ADU. Title 19 zones use DCC 19.92.160 and
  // 19.92.150. CORRECTION 2026-07-30: the prior encoding applied 18.116.355 to
  // all four zones. Its own section heading is "Accessory Dwelling Units In The
  // RR-10 And MUA Zones" and its operative sentence reads "permitted outright
  // on a lot or parcel zoned RR-10 or MUA-10". UAR-10 and SR-2 1/2 are Title 19
  // zones and take their ADU authority from DCC 19.92.160.
  const TITLE18_ADU = ['MUA10', 'RR10']
  const TITLE19_ADU = ['UAR10', 'SR2.5']
  const isAduZone = TITLE18_ADU.includes(zKey) || TITLE19_ADU.includes(zKey)
  const aduCite = TITLE18_ADU.includes(zKey)
    ? 'Deschutes County Code 18.116.355 (Ord. 2025-015, 2025-08-13); ORS 215.501'
    : 'Deschutes County Code 19.92.160; ORS 215.501'
  const historicCite = TITLE18_ADU.includes(zKey)
    ? 'Deschutes County Code 18.116.350'
    : 'Deschutes County Code 19.92.150'

  // ── Subdivide ─────────────────────────────────────────────────────────────
  // CORRECTION 2026-07-30: the Wildlife Area overlay was previously encoded as
  // a flat 40-acre floor. DCC 18.88.050 sets 40 acres in the Tumalo, Metolius,
  // North Paulina and Grizzly DEER WINTER ranges, 160 acres in significant ELK
  // habitat, and 320 acres in ANTELOPE range. On top of that, a residential
  // land division in deer winter range over RR-10 or MUA-10 is available only
  // as a planned or cluster development retaining 80% open space, and under the
  // clear-and-objective track at DCC 18.88.051 (Ord. 2025-009, effective
  // 2025-07-01) a division creating a dwelling-eligible lot there is not
  // permitted at all. Our data knows only that SOME wildlife overlay applies,
  // not which range, so the honest verdict is `confirm` and never a lot count.
  if (waOverlay && !isEfu && !isForest) {
    items.push({
      topic: 'Subdivide or partition',
      verdict: 'confirm',
      headline: 'The Wildlife Area overlay governs division here, and the county decides the standard by range.',
      detail: `${zone} sets the base minimum lot area, and the Wildlife Area combining zone sets a stricter one that depends on which mapped range the parcel falls in: 40 acres in the Tumalo, Metolius, North Paulina, and Grizzly deer winter ranges, 160 acres in significant elk habitat, and 320 acres in antelope range.${acres != null ? ` This parcel is ${acres} acres.` : ''} In deer winter range over RR-10 or MUA-10, a residential division is available only as a planned or cluster development that keeps at least 80 percent of the land as open space, and the county's clear-and-objective track does not permit a division that creates a dwelling-eligible lot there. The Bend and La Pine deer migration corridor over RR-10 runs on a 20-acre cluster standard. Which range applies is a map question the county answers directly, so confirm it with Deschutes County Planning before you price any division potential. The same overlay is why the surrounding land stays open.`,
      citation: 'Deschutes County Code 18.88.050 and 18.88.051 (Ord. 2025-009, effective 2025-07-01)',
      url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.88_WILDLIFE_AREA_COMBINING_ZONE%3B_WA`,
      verifiedOn: V2,
    })
  } else if (isEfu) {
    const couldFit = acres != null ? Math.floor(acres / 80) : 0
    potentialLots = acres != null ? couldFit : null
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage clears the 80-acre state minimum for ${couldFit} parcels. Subzone standards and farm-use tests decide the rest.`
          : 'This tract stays whole, which is exactly what the farm zone is written to protect.',
      detail: `Oregon law sets the minimum new parcel in an Exclusive Farm Use zone at 80 acres on land not designated rangeland, and 160 acres on designated rangeland. Deschutes County layers subzone standards on top, expressed as irrigated acres per resulting parcel: 130 in Lower Bridge, 63 in Sisters and Cloverdale, 35 in Terrebonne, and 23 in the Tumalo, Redmond, and Bend subzone.${acres != null ? ` This parcel is ${acres} acres.` : ''} A division below the minimum is not available outside narrow statutory exceptions. The upside on EFU land is the farm use itself, along with the right-to-farm protection Oregon attaches to it.`,
      citation: 'ORS 215.780(1); Deschutes County Code 18.16.065',
      url: 'https://oregon.public.law/statutes/ors_215.780',
      verifiedOn: V2,
    })
  } else if (isForest) {
    const couldFit = acres != null ? Math.floor(acres / 80) : 0
    potentialLots = acres != null ? couldFit : null
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage clears the 80-acre minimum for ${couldFit} parcels. A county land-use application decides the rest.`
          : 'This tract stays whole, which is what keeps the surrounding forest land intact.',
      detail: `The minimum lot area in the F-1 and F-2 forest zones is 80 acres.${acres != null ? ` This parcel is ${acres} acres.` : ''} A smaller division is available only for specific listed uses approved under the county's conditional-use standards, and then only at the minimum area that use requires. Maximum structure height is 30 feet.`,
      citation: 'Deschutes County Code 18.36.090 (F-1) and 18.40.090 (F-2)',
      url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.36_FOREST_USE_ZONE%3B_F-1`,
      verifiedOn: V2,
    })
  } else {
    const mins: Record<string, { min: number; cite: string; url: string }> = {
      MUA10: {
        min: 10,
        cite: 'Deschutes County Code 18.32.040',
        url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.32_MULTIPLE_USE_AGRICULTURAL_ZONE%3B_MUA`,
      },
      RR10: {
        min: 10,
        cite: 'Deschutes County Code 18.60.060',
        url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.60_RURAL_RESIDENTIAL_ZONE%3B_RR-10`,
      },
      UAR10: {
        min: 10,
        cite: 'Deschutes County Code 19.12.050',
        url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_19.12_URBAN_AREA_RESERVE_ZONE_UAR-10`,
      },
      'SR2.5': {
        min: 2.5,
        cite: 'Deschutes County Code 19.20.050 and 19.20.055',
        url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_19.20_SUBURBAN_LOW_DENSITY_RESIDENTIAL_ZONE%3B_SR_2_1%2F2`,
      },
    }
    const m = mins[zKey] ?? mins[z]
    if (m && acres != null) {
      const couldFit = Math.floor(acres / m.min)
      potentialLots = couldFit
      const sr = zKey === 'SR2.5'
      items.push({
        topic: 'Subdivide or partition',
        verdict: couldFit >= 2 ? 'conditional' : 'no',
        headline:
          couldFit >= 2
            ? `The acreage carries ${couldFit} parcels at the ${m.min}-acre minimum. A county land-use application decides the rest.`
            : `This is a single conforming parcel, held to the same ${m.min}-acre minimum that keeps the whole zone at this density.`,
        detail: `${zone} requires ${m.min} acres per new parcel. This parcel is ${acres} acres${
          couldFit >= 2
            ? `, which supports ${couldFit} parcels arithmetically. Road access, septic feasibility on each resulting parcel, and any overlay setbacks govern the actual outcome, so the first step is a pre-application conversation with Deschutes County Planning.`
            : '.'
        }${
          sr
            ? ' SR-2 1/2 also runs a specific two-lot partition rule: the segregated parcel is capped at 2.5 acres with the balance staying as the larger parent parcel, street frontage is improved to urban standards or covered by a recorded development agreement, and a restrictive covenant is recorded barring further division until the land can be served by a permitted community or municipal sewer system and urban-standard roads.'
            : ''
        }`,
        citation: m.cite,
        url: m.url,
        verifiedOn: V2,
      })
    }
  }

  // ── ADU / second dwelling ─────────────────────────────────────────────────
  if (isEfu) {
    items.push({
      topic: 'ADU',
      verdict: 'no',
      headline: 'The rural ADU ordinance does not reach EFU land.',
      detail:
        'Deschutes County\'s residential accessory dwelling unit provisions apply in the RR-10 and MUA-10 zones under DCC 18.116.355 and in the UAR-10, SR-2 1/2, and WTZ zones under DCC 19.92.160. Exclusive Farm Use parcels sit outside both. A second dwelling on farm land runs through the EFU pathways below instead.',
      citation: 'Deschutes County Code 18.116.355 and 19.92.160; ORS 215.495',
      url: DC_BOOK,
      verifiedOn: V2,
    })
    items.push({
      topic: 'Second dwelling',
      verdict: 'conditional',
      headline: 'Available through a named EFU pathway, each with its own test.',
      detail:
        'A second dwelling on EFU land runs through a specific approval: a relative farm-assistance dwelling for a relative whose help the farm operation requires, a nonfarm dwelling as a conditional use on soils the statute treats as unsuitable for farming, or a lot-of-record dwelling on a qualifying pre-existing lot. Each carries its own tests and none is by right. Replacing a lawfully established dwelling under ORS 215.291 is permitted outright but does not create a second unit. A buyer who wants a second dwelling here starts with a soils analysis and a pre-application conference.',
      citation: 'Deschutes County Code 18.16.025, 18.16.030, 18.16.040, 18.16.050; ORS 215.291',
      url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.16_EXCLUSIVE_FARM_USE_ZONES`,
      verifiedOn: V2,
    })
  } else if (isForest) {
    items.push({
      topic: 'ADU',
      verdict: 'no',
      headline: 'The forest zones run one dwelling per tract.',
      detail:
        'One dwelling per tract, and that dwelling is itself a conditional use in F-1 and F-2. No second dwelling or rural ADU is available. What the zone protects instead is the forest setting itself, at an 80-acre minimum lot area.',
      citation: 'Deschutes County Code 18.36.050 (F-1) and 18.40.050 (F-2)',
      url: `${DC_BOOK}/book/print?type=ordinances&name=CHAPTER_18.36_FOREST_USE_ZONE%3B_F-1`,
      verifiedOn: V2,
    })
  } else if (isAduZone) {
    // Acres unknown = confirm, never an affirmative eligibility claim.
    // CORRECTION 2026-07-30 (two facts): the 5-acre threshold is NOT a
    // "wildfire-mapped area" rule. DCC 18.116.355(B)(6) and 19.92.160(B)(6)
    // set it for "those unsewered areas between Sunriver and the Klamath County
    // border", defined as the unincorporated parts of Townships 19S, 20S, 21S,
    // 22S and Ranges 9E, 10E, 11E. And the current text carries no
    // "wildfire-hardening and defensible-space standards": the fire-related
    // requirement is a fire protection service provider plus documented
    // emergency access.
    const verdict: DevVerdict = acres == null ? 'confirm' : acres >= 2 ? 'conditional' : 'unlikely'
    items.push({
      topic: 'ADU',
      verdict,
      headline:
        verdict === 'confirm'
          ? 'A rural accessory dwelling unit is available in this zone. Confirm the parcel is at least 2 acres.'
          : verdict === 'conditional'
            ? 'One rural accessory dwelling unit is permitted outright here, with real conditions attached.'
            : 'The parcel sits under the 2-acre floor the rural ADU rule sets.',
      detail: `Deschutes County permits one residential accessory dwelling unit outright in ${zone} on a lot of at least 2 acres that already holds a single-family dwelling. The threshold rises to 5 acres only in the unsewered area between Sunriver and the Klamath County border, defined by township and range in the ordinance.${acres != null ? ` This parcel is ${acres} acres.` : ''} The conditions have teeth and a buyer should price them in: the unit is capped at 900 sqft of useable floor area, it sits within 100 feet of the existing house, it carries a 100-foot setback from any lot line abutting F-1, F-2, or EFU land, it needs sewer or county Onsite Wastewater approval BEFORE the application, the parcel must be served by a qualifying fire protection provider with written confirmation that access meets fire district requirements, and no guest house or temporary dwelling can already exist on the lot. Two consequences matter at resale: a recorded restrictive covenant bars vacation occupancy for BOTH the ADU and the primary house, and the lot becomes ineligible for a division or property line adjustment that would separate the two dwellings.`,
      citation: aduCite,
      url: DC_BOOK,
      verifiedOn: V2,
    })
    // The historic-home ADU pathway carries the SAME 2-acre floor as the
    // residential ADU, so a sub-2-acre parcel does not reach either one.
    items.push({
      topic: 'Second dwelling',
      verdict: acres == null ? 'confirm' : acres >= 2 ? 'conditional' : 'unlikely',
      headline:
        acres != null && acres < 2
          ? 'Both county second-dwelling pathways start at 2 acres, and a temporary hardship dwelling is the remaining route.'
          : 'The rural ADU is the main route, and a historic-home ADU is the narrow second one.',
      detail: `Beyond the rural ADU above, a separate pathway exists for a lot of at least 2 acres holding a historic home, under ${historicCite}.${
        acres != null && acres < 2
          ? ` This parcel is ${acres} acres, which is under the 2-acre floor both pathways share.`
          : ''
      } Manufactured-home secondary dwellings run as accessory uses in limited cases, and a temporary hardship dwelling is its own outright use with its own standards and no acreage floor of its own. Each is a separate application with its own criteria, so confirm the current standards with Deschutes County Planning before you count on one.`,
      citation: `${historicCite}; Deschutes County Code 18.116.090 and 19.88.320; ORS 215.501`,
      url: DC_BOOK,
      verifiedOn: V2,
    })
  }

  // Short-term rental — DCC Ch. 4.08 (Ord. 2025-006, effective 2025-09-01) and
  // DCC 18.113, verified 2026-07-14. NOT re-read on 2026-07-30.
  if (isEfu || isForest) {
    items.push({
      topic: 'Short-term rental',
      verdict: 'no',
      headline: 'Not available on farm or forest land.',
      detail:
        'Deschutes County prohibits short-term rentals on Exclusive Farm Use and Forest Use zoned land. The county code states it plainly: a short-term rental is not allowed in Forest Use Zones or Exclusive Farm Use Zones, effective September 1, 2025. Long-term rental of a lawfully established dwelling is unaffected.',
      citation: 'Deschutes County Code 4.08.071 (Ord. 2025-006, effective 2025-09-01)',
      url: `${DC_BOOK}/book?type=ordinances#name=CHAPTER_4.08_TRANSIENT_ROOM_TAX`,
      verifiedOn: V1,
    })
  } else if (isAduZone || z === 'DR' || /^UAR/.test(z)) {
    items.push({
      topic: 'Short-term rental',
      verdict: 'conditional',
      headline: 'Allowed. The county asks for tax registration rather than a land-use permit.',
      detail:
        'Unincorporated Deschutes County imposes no short-term rental land-use permit, density cap, separation rule, or waitlist in the rural residential zones. A lawfully established dwelling may rent short-term after registering with the County Tax Office within 15 days of starting, displaying a Certificate of Authority in the unit, and collecting the 8% county room tax. Two carve-outs matter. Short-term rentals are prohibited on EFU and Forest land, and a property that adds a rural ADU records a covenant that gives up vacation-rental use of both units. Inside a destination resort such as Sunriver, Black Butte Ranch, Caldera Springs, Eagle Crest, Juniper Preserve, or Tetherow, nightly rental is a built-in resort use, with the resort association layer governing on top through rental registration, access fees, and quiet hours. Confirm any association or CC&R restriction on the specific property.',
      citation:
        'Deschutes County Code 4.08.071, 4.08.090, 4.08.140 (Ord. 2025-006, effective 2025-09-01); DCC 18.113 (destination resorts); DCC 18.116.355 and 19.92.160 (rural-ADU vacation-occupancy covenant)',
      url: `${DC_BOOK}/book?type=ordinances#name=CHAPTER_4.08_TRANSIENT_ROOM_TAX`,
      verifiedOn: V1,
    })
  }
  return { items, potentialLots }
}
