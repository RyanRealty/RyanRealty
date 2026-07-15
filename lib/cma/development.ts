/**
 * Development opportunities — can this parcel be subdivided, carry an ADU, a
 * second dwelling, middle housing, or a short-term rental? (Matt directives
 * 2026-07-14.) 100% factual per the city and county code: every rule below was
 * researched against the PRIMARY source (Bend Development Code, Redmond
 * Development Code, Deschutes County Code, Oregon ORS) and independently
 * re-verified against that source before being encoded (58-fact adversarial
 * verification pass, 2026-07-14; zero rejected facts encoded).
 *
 * PURE FUNCTION over data the property-intelligence resolver already fetched
 * (zone, acreage, overlays, jurisdiction). No LLM. No new network calls. Every
 * item carries its code citation + source URL, and the section always renders
 * with the verify-it-yourself disclaimer + hyperlinked agency directory.
 *
 * These are PRELIMINARY reads of the code as of the verification date — never
 * an entitlement determination. The disclaimer says so, in plain language.
 */

import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaSubject } from '@/lib/cma/types'

export type DevVerdict = 'yes' | 'conditional' | 'unlikely' | 'no' | 'confirm'

export interface DevItem {
  topic: 'Subdivide or partition' | 'ADU' | 'Second dwelling' | 'Middle housing' | 'Short-term rental'
  verdict: DevVerdict
  /** One-line answer in plain language. */
  headline: string
  /** The rule + how this parcel measures against it, with the numbers shown. */
  detail: string
  citation: string
  url: string
}

export interface DevResource {
  name: string
  role: string
  url: string
  phone: string | null
}

export interface DevelopmentOpportunities {
  jurisdiction: 'City of Bend' | 'City of Redmond' | 'Deschutes County (unincorporated)'
  zone: string
  verifiedAsOf: string
  items: DevItem[]
  disclaimer: string
  resources: DevResource[]
}

/** Date the regulatory registry below was verified against primary sources. */
export const REGS_VERIFIED_DATE = '2026-07-14'

const SQFT_PER_ACRE = 43_560

// ── Verify-it-yourself resource directory (URLs/phones verified 2026-07-14) ──
export function buildResourceDirectory(site: CmaSiteData | null): DevResource[] {
  const resources: DevResource[] = [
    {
      name: 'Deschutes County Community Development (Planning)',
      role: 'Zoning, land divisions, rural ADUs, dwelling entitlements for unincorporated parcels. 117 NW Lafayette Ave, Bend.',
      url: 'https://www.deschutes.org/cd',
      phone: null,
    },
    {
      name: 'Deschutes County DIAL (property records)',
      role: 'The parcel\'s permits, development summary, assessment, and zoning of record.',
      url: 'https://dial.deschutes.org',
      phone: null,
    },
    {
      name: 'City of Bend Planning Division',
      role: 'Zoning, lot standards, ADUs, and middle housing inside Bend city limits.',
      url: 'https://www.bendoregon.gov/government/departments/community-and-economic-development/planning-division',
      phone: '541.388.5580 ext. 3',
    },
    {
      name: 'City of Bend short-term rental program',
      role: 'STR land-use permits and operating licenses inside Bend, including the location-availability check.',
      url: 'https://bendoregon.gov/services/business/short-term-rentals/',
      phone: '541.388.5580 ext. 8',
    },
    {
      name: 'City of Redmond Planning Division',
      role: 'Zoning, lot standards, ADUs, and middle housing inside Redmond city limits.',
      url: 'https://www.redmondoregon.gov/government/departments/community-development/planning-division-2023',
      phone: '541.923.7719',
    },
    {
      name: 'Oregon Water Resources Department',
      role: 'Well logs (Well Report Query) and water rights of record (WRIS).',
      url: 'https://www.oregon.gov/owrd/programs/waterrights/wris/pages/default.aspx',
      phone: null,
    },
    {
      name: 'FEMA Flood Map Service Center',
      role: 'The parcel\'s official flood map and zone determination.',
      url: 'https://msc.fema.gov/portal/home',
      phone: null,
    },
    {
      name: 'ODFW Landowner Preference Program',
      role: 'Hunting-tag eligibility for qualifying acreage.',
      url: 'https://myodfw.com/landowner-preference-program',
      phone: '503.947.6101 option 1',
    },
  ]
  if (site?.water.irrigationDistrict) {
    resources.splice(6, 0, {
      name: site.water.irrigationDistrict,
      role: 'The parcel\'s irrigation district: confirm water rights, delivered acreage, and transfer rules directly with the district office.',
      url: 'https://www.oregon.gov/owrd/programs/waterrights/pages/default.aspx',
      phone: null,
    })
  }
  return resources
}

/** The disclaimer Matt directed: we research what we can; the reader verifies. */
export const DEV_DISCLAIMER =
  `We research each of these questions against the county and city code as of ${REGS_VERIFIED_DATE}, the date these rules were last verified against their primary sources, and every rule cites the code section we relied on. Codes change, parcels have particulars a code table cannot see, and none of this is a land-use decision or an entitlement. It is ultimately your responsibility to verify anything you plan to rely on with the offices below before you act on it. We are glad to help you make those calls.`

// ── Jurisdiction resolution ──────────────────────────────────────────────────
function resolveJurisdiction(site: CmaSiteData, subject: CmaSubject): DevelopmentOpportunities['jurisdiction'] {
  const city = (subject.city ?? '').trim().toLowerCase()
  // City code applies only to ANNEXED land (site.isMunicipal). A parcel inside
  // the UGB but unincorporated is governed by COUNTY code until annexation
  // (Deschutes Title 19 is literally the "Bend Urban Growth Boundary Zoning
  // Ordinance"), so insideUGB alone must never route to the city branch —
  // adversarial-audit finding 2026-07-14.
  if (site.isMunicipal) {
    if (city === 'redmond') return 'City of Redmond'
    if (city === 'bend') return 'City of Bend'
  }
  return 'Deschutes County (unincorporated)'
}

/** Normalize a GIS zone string to the registry vocabulary. The county layer
 *  returns e.g. "SR2-1/2" for SR-2½ — alias it (audit finding 2026-07-14). */
function canonicalZone(zone: string): string {
  const z = zone.toUpperCase().replace(/\s+/g, '')
  if (z === 'SR2-1/2' || z === 'SR21/2' || z === 'SR2.5' || z === 'SR-2.5') return 'SR2.5'
  return z.replace(/-/g, '') === 'RM10' ? 'RM-10' : z
}

const usd0 = (n: number) => n.toLocaleString()

// ── The verified registry, applied per zone ─────────────────────────────────
/* Every rule string below traces to a fact verified against its primary source
 * on 2026-07-14. Do not edit a rule without re-verifying against the source. */

// Bend residential districts (BDC Chapter 2.1 title: "Residential Districts
// (UAR, RL, RS, RM-10, RM, RH)"; Table 2.1.200 lists ADUs 'P' in all six).
const BEND_RESIDENTIAL = new Set(['UAR', 'RL', 'RS', 'RM-10', 'RM', 'RH'])

function bendItems(zone: string, lotSqft: number | null, acres: number | null): DevItem[] {
  const items: DevItem[] = []
  const z = canonicalZone(zone)

  // Minimum single-unit lot areas + density (BDC Table 2.1.500 / 2.1.600).
  const minLot: Record<string, number | null> = { RS: 4000, 'RM-10': 4000, RL: 10000, RM: 2500, RH: null }
  const density: Record<string, string> = {
    RL: '1.1 to 4.0 units per gross acre',
    RS: '4.0 to 7.3 units per gross acre',
    'RM-10': '6.0 to 10.0 units per gross acre',
    RM: '7.3 to 21.7 units per gross acre',
    RH: '21.7 units per gross acre minimum, no maximum',
  }
  // Max density (units per gross acre) — caps the division arithmetic so the
  // headline never prints a count Table 2.1.600 forbids (audit finding).
  const maxDensity: Record<string, number | null> = { RL: 4.0, RS: 7.3, 'RM-10': 10.0, RM: 21.7, RH: null }

  if (z === 'UAR') {
    const couldFit = acres != null ? Math.floor(acres / 10) : 0
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage clears the 10-acre minimum for ${couldFit} lots. UAR holds land for future urbanization, so a planning conversation decides the rest.`
          : 'Not until the land urbanizes.',
      detail: `Urban Area Reserve requires a 10-acre minimum lot for a single-unit dwelling.${acres != null ? ` This parcel is ${acres} acres.` : ''} UAR holds land for future urbanization, so a standard division into urban-size lots is not available under the current zone.`,
      citation: 'Bend Development Code Table 2.1.500',
      url: 'https://bend.municipal.codes/BDC/2.1.500',
    })
  } else if (z in minLot) {
    const min = minLot[z]
    if (min == null) {
      items.push({
        topic: 'Subdivide or partition',
        verdict: 'confirm',
        headline: 'RH has no minimum single-unit lot area.',
        detail: `High Density Residential lists no minimum lot area for a single-unit dwelling, and density runs ${density.RH}. Division potential turns on density, access, and infrastructure rather than a lot-size floor. Worth a planning conversation.`,
        citation: 'Bend Development Code Table 2.1.500 and Table 2.1.600',
        url: 'https://bend.municipal.codes/BDC/2.1.500',
      })
    } else if (lotSqft != null) {
      const byLot = Math.floor(lotSqft / min)
      const maxD = maxDensity[z]
      const byDensity = maxD != null && acres != null ? Math.floor(acres * maxD) : byLot
      const couldFit = Math.min(byLot, byDensity)
      const verdict: DevVerdict = couldFit >= 2 ? 'conditional' : 'no'
      items.push({
        topic: 'Subdivide or partition',
        verdict,
        headline:
          couldFit >= 2
            ? `The arithmetic supports up to ${couldFit} lots. Access and infrastructure decide the real number.`
            : 'The parcel is below the size needed to create a second lot.',
        detail: `${z} requires a ${usd0(min)} sqft minimum lot for a single-unit dwelling, with density of ${density[z]}. This parcel is ${usd0(Math.round(lotSqft))} sqft. ${couldFit >= 2 ? `Division math allows up to ${couldFit} conforming lots inside both the lot minimum and the density ceiling, but street access, utilities, and any overlays govern what a land division actually yields. Townhome divisions can go smaller (1,500 sqft average per unit).` : 'Two conforming lots do not fit at the code minimum.'}`,
        citation: 'Bend Development Code Table 2.1.500 (lot areas) and Table 2.1.600 (density)',
        url: 'https://bend.municipal.codes/BDC/2.1.500',
      })
    }
  }

  // ADU — the six residential districts only (Table 2.1.200 covers residential
  // districts; a commercial-zone parcel gets no parcel-level "Allowed" claim).
  if (BEND_RESIDENTIAL.has(z)) {
    items.push({
      topic: 'ADU',
      verdict: 'yes',
      headline: 'Allowed. Up to two ADUs per lot.',
      detail: 'ADUs are a permitted use in every Bend residential district on a lot with a single-unit dwelling. The first ADU is capped at 800 sqft of floor area and a second at 500 sqft. Bend imposes no owner-occupancy requirement and no ADU parking minimum. A second ADU that exceeds the zone density triggers a sewer-capacity analysis, and ADUs are not permitted on lots created by a middle-housing land division or in a cottage development.',
      citation: 'Bend Development Code 3.6.200(B) and Table 2.1.200; ORS 197A.425',
      url: 'https://bend.municipal.codes/BDC/3.6.200',
    })
  }

  // Middle housing / second dwelling (BDC Table 2.1.200, 3.8.900).
  if (['RL', 'RS', 'RM-10', 'RM', 'RH'].includes(z)) {
    items.push({
      topic: 'Middle housing',
      verdict: 'yes',
      headline: 'Duplex through quadplex, townhomes, and cottage clusters are permitted uses.',
      detail: `Under Oregon's middle-housing law, Bend allows duplexes, triplexes, quadplexes, and townhomes as permitted uses in ${z}. Cottage clusters are permitted in RL, RS, RM-10, and RM. Townhome land divisions run on a 1,500 sqft average per unit in RL/RS/RM-10/RM. Site standards and design review apply.`,
      citation: 'Bend Development Code Table 2.1.200; BDC 3.8.900; ORS 197A.420',
      url: 'https://bend.municipal.codes/BDC/2.1.200',
    })
    items.push({
      topic: 'Second dwelling',
      verdict: 'yes',
      headline: 'A second unit is achievable as an ADU or by converting to middle housing.',
      detail: 'The practical second-dwelling paths in Bend are an ADU (up to two, above) or a duplex/middle-housing configuration, both permitted uses in this zone subject to the development standards.',
      citation: 'Bend Development Code Table 2.1.200 and 3.6.200(B)',
      url: 'https://bend.municipal.codes/BDC/2.1.200',
    })
  }
  return items
}

function redmondItems(zone: string, lotSqft: number | null): DevItem[] {
  const items: DevItem[] = []
  const z = canonicalZone(zone)
  const minLot: Record<string, number> = { 'R-1': 9000, R1: 9000, 'R-2': 9000, R2: 9000, 'R-3': 7500, R3: 7500, 'R-3A': 7500, R3A: 7500, 'R-4': 5500, R4: 5500, 'R-5': 5500, R5: 5500 }

  // Residential zones only — a commercial/industrial Redmond parcel gets no
  // parcel-level residential claims (audit finding 2026-07-14). Empty items →
  // the section is omitted for that parcel.
  if (!(z in minLot)) return items

  if (lotSqft != null) {
    const min = minLot[z]!
    const couldFit = Math.floor(lotSqft / min)
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The arithmetic supports up to ${couldFit} lots. Access and utilities decide the real number.`
          : 'The parcel is below the size needed to create a second lot.',
      detail: `${zone} requires a ${usd0(min)} sqft minimum lot. This parcel is ${usd0(Math.round(lotSqft))} sqft. ${couldFit >= 2 ? 'A partition creates up to three parcels in a calendar year and a subdivision four or more. Middle-housing land divisions can create smaller unit lots.' : 'Two conforming lots do not fit at the code minimum.'}`,
      citation: 'Redmond Development Code Ch. 8, Sec. 8.140 Table B; Sec. 8.2235; Sec. 8.2680',
      url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_REUSZO_S8.140TABMIST',
    })
  }
  items.push({
    topic: 'ADU',
    verdict: 'yes',
    headline: 'Allowed in every Redmond residential zone.',
    detail: 'ADUs and guest houses are permitted where the underlying residential zone allows them, subject to the ADU standards in Sec. 8.325 (size and siting rules apply).',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.325',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_SUPR_S8.325ACDWUNGUHO',
  })
  items.push({
    topic: 'Middle housing',
    verdict: 'yes',
    headline: 'Duplexes through cottage clusters are permitted in all residential zones.',
    detail: 'Redmond permits duplexes, triplexes, quadplexes, townhouses, and cottage clusters in every residential zone under the middle-housing provisions, with middle-housing land divisions available to put each unit on its own lot.',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.140 Table B and Sec. 8.2680; ORS 197A.420',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_REUSZO_S8.140TABMIST',
  })
  items.push({
    topic: 'Second dwelling',
    verdict: 'yes',
    headline: 'A second unit is achievable as an ADU or as middle housing.',
    detail: 'The practical second-dwelling paths in Redmond are an ADU under Sec. 8.325 or a duplex/middle-housing configuration under Table B, both subject to the development standards.',
    citation: 'Redmond Development Code Ch. 8, Sec. 8.325 and Sec. 8.140 Table B',
    url: 'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_SUPR_S8.325ACDWUNGUHO',
  })
  return items
}

function countyItems(zone: string, acres: number | null, overlays: string[]): DevItem[] {
  const items: DevItem[] = []
  // Canonical + dash-stripped forms so real GIS strings ("SR2-1/2", "RR-10")
  // hit the registry keys (audit finding 2026-07-14).
  const z = canonicalZone(zone)
  const zKey = z === 'SR2.5' ? 'SR2.5' : z.replace(/-/g, '')
  const isEfu = /^EFU/.test(z)
  const isForest = zKey === 'F1' || zKey === 'F2'
  const waFloor = overlays.includes('WA')

  // Subdivide. EFU and forest divisions are acreage-gated at 80 acres per new
  // parcel — a 160+ acre tract CAN divide, so the verdict follows the math
  // (audit finding 2026-07-14: never hard-code 'no' the statute contradicts).
  if (isEfu) {
    const couldFit = acres != null ? Math.floor(acres / 80) : 0
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage clears the 80-acre state minimum for ${couldFit} parcels. Subzone minimums and farm-use tests decide the rest.`
          : 'New farm parcels take 80 acres.',
      detail: `Oregon law sets the minimum new parcel in an Exclusive Farm Use zone at 80 acres (non-rangeland). Deschutes County's EFU subzones set their own minimums on top of that, and some exceed 80 acres.${acres != null ? ` This parcel is ${acres} acres.` : ''} A division below the minimum is not available outside narrow statutory exceptions.`,
      citation: 'ORS 215.780(1); Deschutes County Code 18.16.065',
      url: 'https://oregon.public.law/statutes/ors_215.780',
    })
  } else if (isForest) {
    const couldFit = acres != null ? Math.floor(acres / 80) : 0
    items.push({
      topic: 'Subdivide or partition',
      verdict: couldFit >= 2 ? 'conditional' : 'no',
      headline:
        couldFit >= 2
          ? `The acreage clears the 80-acre minimum for ${couldFit} parcels. A county land-use application decides the rest.`
          : 'Forest-zone parcels take 80 acres.',
      detail: `The minimum lot area in the F-1 and F-2 forest zones is 80 acres.${acres != null ? ` This parcel is ${acres} acres.` : ''}`,
      citation: 'Deschutes County Code 18.36.090 (F-1) / 18.40.090 (F-2)',
      url: 'https://deschutescounty.municipalcodeonline.com/book/print?type=ordinances&name=CHAPTER_18.36_FOREST_USE_ZONE%3B_F-1',
    })
  } else {
    const mins: Record<string, { min: number; cite: string; url: string }> = {
      MUA10: { min: 10, cite: 'Deschutes County Code 18.32.040', url: 'https://deschutescounty.municipalcodeonline.com/book/print?type=ordinances&name=CHAPTER_18.32_MULTIPLE_USE_AGRICULTURAL_ZONE%3B_MUA' },
      RR10: { min: 10, cite: 'Deschutes County Code 18.60.060', url: 'https://deschutescounty.municipalcodeonline.com/book/print?type=ordinances&name=CHAPTER_18.60_RURAL_RESIDENTIAL_ZONE%3B_RR-10' },
      UAR10: { min: 10, cite: 'Deschutes County Code 19.12.050', url: 'https://deschutescounty.municipalcodeonline.com' },
      'SR2.5': { min: 2.5, cite: 'Deschutes County Code Title 19, Ch. 19.20', url: 'https://deschutescounty.municipalcodeonline.com' },
    }
    const m = mins[zKey] ?? mins[z]
    if (m && acres != null) {
      const effMin = waFloor ? Math.max(m.min, 40) : m.min
      const couldFit = Math.floor(acres / effMin)
      items.push({
        topic: 'Subdivide or partition',
        verdict: couldFit >= 2 ? 'conditional' : 'no',
        headline:
          couldFit >= 2
            ? `The acreage clears the ${effMin}-acre minimum for ${couldFit} parcels. A county land-use application decides the rest.`
            : `Below the ${effMin}-acre-per-parcel minimum to divide.`,
        detail: `${zone} requires ${m.min} acres per new parcel${waFloor ? ', and the Wildlife Area overlay raises the effective floor to 40 acres (DCC 18.88)' : ''}. This parcel is ${acres} acres${couldFit >= 2 ? `, which arithmetically supports ${couldFit} parcels. Road access, septic feasibility on each parcel, and overlay setbacks govern the actual outcome.` : '.'}`,
        citation: `${m.cite}${waFloor ? '; DCC 18.88' : ''}`,
        url: m.url,
      })
    }
  }

  // ADU / second dwelling.
  if (isEfu) {
    items.push({
      topic: 'ADU',
      verdict: 'no',
      headline: 'Rural ADUs do not extend to EFU land.',
      detail: 'Deschutes County\'s rural-ADU ordinance applies in the RR-10, MUA-10, UAR-10, and SR-2½ zones. EFU parcels are outside it.',
      citation: 'Deschutes County Code 18.116.355; ORS 215.495',
      url: 'https://deschutescounty.municipalcodeonline.com',
    })
    items.push({
      topic: 'Second dwelling',
      verdict: 'conditional',
      headline: 'Possible only through a named EFU pathway.',
      detail: 'A second dwelling on EFU land runs through a specific approval: a relative farm-assistance dwelling (for a relative whose help the farm operation requires), a nonfarm dwelling as a conditional use on unsuitable soils, or a lot-of-record dwelling on a qualifying pre-existing lot. Each has its own tests and none is by-right. Replacement of a lawful existing dwelling does not create a second unit.',
      citation: 'Deschutes County Code 18.16.025, 18.16.030, 18.16.040, 18.16.050',
      url: 'https://deschutescounty.municipalcodeonline.com',
    })
  } else if (isForest) {
    items.push({
      topic: 'ADU',
      verdict: 'no',
      headline: 'No ADUs in the forest zones.',
      detail: 'One dwelling per tract, and that dwelling is itself a conditional use in F-1 and F-2. No second dwelling or rural ADU is available.',
      citation: 'Deschutes County Code 18.36.050 (F-1) / 18.40.050 (F-2)',
      url: 'https://deschutescounty.municipalcodeonline.com/book/print?type=ordinances&name=CHAPTER_18.36_FOREST_USE_ZONE%3B_F-1',
    })
  } else if (['MUA10', 'RR10', 'UAR10', 'SR2.5'].includes(zKey)) {
    // acres unknown = confirm, never an affirmative eligibility claim.
    const verdict: DevVerdict = acres == null ? 'confirm' : acres >= 2 ? 'conditional' : 'unlikely'
    items.push({
      topic: 'ADU',
      verdict,
      headline:
        verdict === 'confirm'
          ? 'A rural ADU may be available. Confirm the parcel is at least 2 acres.'
          : verdict === 'conditional'
            ? 'A rural ADU is allowed here, with real conditions.'
            : 'The parcel is under the 2-acre rural-ADU minimum.',
      detail: `Deschutes County allows one rural ADU outright in ${zone} on a lot of at least 2 acres (5 in some wildfire-mapped areas) that already has a single-family dwelling. The conditions have teeth: sewer or DEQ septic approval before application, wildfire-hardening and defensible-space standards, a size cap, and no vacation occupancy. A rural ADU cannot be used as a short-term rental.${acres != null ? ` This parcel is ${acres} acres.` : ''}`,
      citation: 'Deschutes County Code 18.116.355; ORS 215.495 (SB 391)',
      url: 'https://deschutescounty.municipalcodeonline.com',
    })
    items.push({
      topic: 'Second dwelling',
      verdict: 'conditional',
      headline: 'The rural ADU is the main path. A historic-home ADU is the narrow second one.',
      detail: 'Beyond the rural ADU above, a separate pathway exists for lots of at least 2 acres holding a historic home (built between specific statutory dates). Manufactured-home secondary dwellings run as accessory uses in limited cases. Each is its own application.',
      citation: 'Deschutes County Code 18.116.350 and 18.116.355; ORS 215.501',
      url: 'https://deschutescounty.municipalcodeonline.com',
    })
  }
  return items
}

/**
 * Resolve the development-opportunities read for a subject. Returns null when
 * the zone never resolved (the section does not render on unresolved parcels —
 * §0: no zone, no zone-based claims).
 */
export function resolveDevelopmentOpportunities(
  site: CmaSiteData | null | undefined,
  subject: CmaSubject,
): DevelopmentOpportunities | null {
  if (!site?.zone) return null
  const jurisdiction = resolveJurisdiction(site, subject)
  const acres = site.acreage ?? subject.lotAcres ?? null
  const lotSqft = acres != null ? acres * SQFT_PER_ACRE : null

  let items: DevItem[]
  if (jurisdiction === 'City of Bend') items = bendItems(site.zone, lotSqft, acres)
  else if (jurisdiction === 'City of Redmond') items = redmondItems(site.zone, lotSqft)
  else items = countyItems(site.zone, acres, site.zoneOverlays)

  if (items.length === 0) return null
  return {
    jurisdiction,
    zone: site.zone,
    verifiedAsOf: REGS_VERIFIED_DATE,
    items,
    disclaimer: DEV_DISCLAIMER,
    resources: buildResourceDirectory(site),
  }
}
