/**
 * Development opportunities — what this parcel's zoning is, whether it can be
 * subdivided, whether it can carry an ADU, a second dwelling, middle housing,
 * or a short-term rental, what a buyer could realistically do with it, and what
 * the MLS says about a homeowners association. (Matt directives 2026-07-14 and
 * 2026-07-30.)
 *
 * 100% factual per the city and county code. Every rule traces to the PRIMARY
 * source: Bend Development Code, Redmond Development Code, Deschutes County
 * Code, Oregon Revised Statutes.
 *
 * PURE FUNCTION over data the property-intelligence resolver already fetched
 * (zone, acreage, overlays, jurisdiction) plus the MLS association fields on
 * the subject. No LLM. No new network calls. Every item carries its code
 * citation + source URL, and the section always renders with the
 * verify-it-yourself disclaimer + hyperlinked agency directory.
 *
 * These are PRELIMINARY reads of the code as of the verification date, never an
 * entitlement determination. The disclaimer says so, in plain language.
 *
 * ── Verification history ───────────────────────────────────────────────────
 * 2026-07-14  58-fact adversarial verification pass, zero rejected facts.
 * 2026-07-30  Re-verification + expansion pass. Sources read verbatim:
 *             BDC Tables 2.1.100 / 2.1.200 / 2.1.500 / 2.1.600, BDC 2.1.300,
 *             2.1.800, 3.6.200(A)(B), 3.6.500(A) through (G);
 *             RDC Ch. 8 Secs. 8.010, 8.135 Table A, 8.137, 8.140 Table B,
 *             8.141(5)(10), 8.325;
 *             DCC 18.16.010/.020/.065, 18.32.010/.020/.040/.050,
 *             18.36.010/.090, 18.40.010/.090, 18.60.010/.020/.030/.040/.060,
 *             18.88.050/.051, 18.116.350, 18.116.355, 19.12.010/.020/.040/.050,
 *             19.20.010/.020/.030/.040/.050/.055, 19.92.150, 19.92.160;
 *             ORS 197A.425, ORS 215.780.
 *
 *             FOUR encoded facts were found WRONG and corrected. See the
 *             CORRECTION notes inline at each site.
 *
 * Items whose `verifiedOn` is 2026-07-14 were NOT re-read on 2026-07-30 and
 * still carry the original pass's date. Do not restamp a fact you did not
 * personally re-read against its source.
 */

import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaSubject } from '@/lib/cma/types'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { resolveZoningExplainer } from '@/lib/cma/zoning-explainer'
import type { DevZoningExplainer } from '@/lib/cma/zoning-types'
import { REGS_REVERIFIED_DATE, REGS_VERIFIED_DATE } from '@/lib/cma/development-types'
import type {
  DevBuyerOption,
  DevHoa,
  DevItem,
  DevMarketingHighlight,
  DevResource,
  DevelopmentOpportunities,
} from '@/lib/cma/development-types'
import {
  bendItems,
  canonicalZone,
  countyItems,
  countyZoneKey,
  redmondItems,
  type ZoneResult,
} from '@/lib/cma/development-rules'

// The renderer imports every one of these from this module. Keep them exported
// here even though the declarations now live in the split modules.
export type {
  DevVerdict,
  DevItem,
  DevResource,
  DevBuyerOption,
  DevMarketingHighlight,
  DevHoa,
  DevelopmentOpportunities,
} from '@/lib/cma/development-types'
export { REGS_VERIFIED_DATE, REGS_REVERIFIED_DATE } from '@/lib/cma/development-types'
export type { DevZoningExplainer, DevDimension } from '@/lib/cma/zoning-types'

const SQFT_PER_ACRE = 43_560
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
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
      name: 'Deschutes County Clerk (recorded documents)',
      role: 'The recorded CC&Rs, plat, easements, and road-maintenance agreements that run with this property.',
      url: 'https://www.deschutes.org/clerk',
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
    resources.splice(7, 0, {
      name: site.water.irrigationDistrict,
      role: 'The parcel\'s irrigation district: confirm water rights, delivered acreage, and transfer rules directly with the district office.',
      url: 'https://www.oregon.gov/owrd/programs/waterrights/pages/default.aspx',
      phone: null,
    })
  }
  return resources
}

/** The disclaimer Matt directed: we research what we can, the reader verifies. */
export const DEV_DISCLAIMER =
  `We research each of these questions against the county and city code, and every rule cites the code section we relied on. The registry was verified against its primary sources on ${REGS_VERIFIED_DATE} and re-verified in part on ${REGS_REVERIFIED_DATE}. Where a use list appears below it covers the principal residential uses, and the cited table is the governing list. Codes change, parcels have particulars a code table cannot see, and none of this is a land-use decision or an entitlement. It is ultimately your responsibility to verify anything you plan to rely on with the offices below before you act on it. We are glad to help you make those calls.`

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
// ── HOA and CC&Rs ───────────────────────────────────────────────────────────
/**
 * MLS association fields, optional on the subject. The MLS reports whether an
 * association EXISTS and what it charges. It never reports what the recorded
 * CC&Rs SAY, so nothing here characterizes an unread restriction.
 */
interface HoaFactsInput {
  associationYn?: boolean | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
  hoaMonthly?: number | null
  hoaAnnualCost?: number | null
}

const FREQUENCY_LABELS: Array<[RegExp, string]> = [
  [/^month/i, 'per month'],
  [/^(annual|year)/i, 'per year'],
  [/^quarter/i, 'per quarter'],
  [/^semi/i, 'twice a year'],
  [/^bi-?month/i, 'every two months'],
  [/^week/i, 'per week'],
  [/^one\s*-?\s*time/i, 'one time'],
]

function formatFee(f: HoaFactsInput): string | null {
  if (f.associationFee != null && f.associationFee > 0) {
    const raw = (f.associationFeeFrequency ?? '').trim()
    const hit = FREQUENCY_LABELS.find(([re]) => re.test(raw))
    if (hit) return `${money(f.associationFee)} ${hit[1]}`
    return `${money(f.associationFee)}, and the MLS did not report how often it is charged`
  }
  if (f.hoaMonthly != null && f.hoaMonthly > 0) return `${money(f.hoaMonthly)} per month`
  if (f.hoaAnnualCost != null && f.hoaAnnualCost > 0) return `${money(f.hoaAnnualCost)} per year`
  return null
}

const CCR_WHERE =
  'The recorded covenants, conditions and restrictions, the plat, and any road-maintenance agreement for this property are on file with the Deschutes County Clerk and are indexed through Deschutes County DIAL. Ask for the current CC&Rs and bylaws, the operating budget, the reserve study, recent meeting minutes, and any resale disclosure, and read them before your contingency dates run. Those documents, not the zoning code, set the rules on rentals, RV and boat parking, outbuildings, accessory dwellings, fencing, exterior finishes, and landscaping, and they can be stricter than the code allows. We are glad to pull them for you.'

/** Resort or master-association community this subdivision belongs to, or null. */
function resolveResortAssociation(subdivision: string | null): string | null {
  const key = subdivision?.trim().toLowerCase()
  if (!key) return null
  for (const c of getAllResortCommunities()) {
    if (!c.is_resort) continue
    if (c.label.trim().toLowerCase() === key) return c.label
    for (const alias of c.subdivision_aliases ?? []) {
      if (alias.trim().toLowerCase() === key) return c.label
    }
  }
  return null
}

function resolveHoa(subject: CmaSubject & HoaFactsInput): DevHoa {
  const resortAssociation = resolveResortAssociation(subject.subdivision)
  const feeLabel = formatFee(subject)
  const hasAssociation =
    typeof subject.associationYn === 'boolean' ? subject.associationYn : feeLabel != null ? true : null

  let guidance: string
  if (hasAssociation === true) {
    guidance = `The MLS confirms an association on this property${feeLabel ? ` at ${feeLabel}` : ''}. What the MLS does not report is what the recorded CC&Rs actually say, so treat the documents as the answer and this line as the flag. ${CCR_WHERE}`
  } else if (hasAssociation === false) {
    guidance = `The MLS reports no homeowners association on this property, so no association dues and no association design-review process are reported. Recorded CC&Rs, plat notes, and road-maintenance agreements can still run with a parcel with no association behind them, so confirm rather than assume. ${CCR_WHERE}`
  } else {
    guidance = `The MLS did not report whether this property carries a homeowners association, so we are not going to state one way or the other. ${CCR_WHERE}`
  }
  if (resortAssociation) {
    guidance += ` This property sits in ${resortAssociation}, which carries a resort or master association layer of its own. Request the master association documents alongside any neighborhood association documents, including the rental-registration rules, transfer and access fees, and the current assessment schedule.`
  }
  return { hasAssociation, feeLabel, resortAssociation, ccrGuidance: guidance }
}

// ── Synthesis: what could a buyer do with this? ─────────────────────────────
function buildBuyerOptions(
  items: DevItem[],
  potentialLots: number | null,
  hoa: DevHoa,
  zoneLabel: string,
): DevBuyerOption[] {
  const options: DevBuyerOption[] = []
  const by = (t: DevItem['topic']) => items.find((i) => i.topic === t)
  const divide = by('Subdivide or partition')
  const adu = by('ADU')
  const middle = by('Middle housing')
  const second = by('Second dwelling')
  const str = by('Short-term rental')

  if (divide && divide.verdict === 'conditional' && potentialLots != null && potentialLots >= 2) {
    options.push({
      headline: `Divide the land into as many as ${potentialLots} lots`,
      detail: `The zone's own minimum lot standard supports up to ${potentialLots} conforming lots on this parcel. This is the highest-value path on the list, and it is also the one with the most conditions: access, utility or septic capacity on each resulting lot, and any overlay standards all shape the final count. Start with a pre-application conference before you underwrite it.`,
      basedOn: ['Subdivide or partition', divide.citation],
    })
  }
  if (adu && (adu.verdict === 'yes' || adu.verdict === 'conditional')) {
    options.push({
      headline: 'Add an accessory dwelling unit',
      detail: `${adu.headline} That opens a rental unit, a place for family, or a separate work space, without touching the primary home. The size cap, siting rules, and utility approvals in the ADU section above are the work involved.`,
      basedOn: ['ADU', adu.citation],
    })
  }
  if (middle && middle.verdict === 'yes') {
    options.push({
      headline: 'Convert or build to middle housing',
      detail: `${middle.headline} A duplex conversion is the lowest-friction version of this, and a townhome or cottage-cluster build is the fullest. All of them are outright uses in this zone, so none of them needs a conditional use permit.`,
      basedOn: ['Middle housing', middle.citation],
    })
  } else if (second && second.verdict === 'conditional') {
    options.push({
      headline: 'Pursue a second dwelling through the named pathway',
      detail: `${second.headline} ${second.detail}`,
      basedOn: ['Second dwelling', second.citation],
    })
  }
  if (str && (str.verdict === 'yes' || str.verdict === 'conditional')) {
    options.push({
      headline: 'Operate it as a short-term rental',
      detail: `${str.headline} Confirm availability at this specific address before you rely on the income, and read the association documents alongside the code, because an association can restrict rentals the code allows.`,
      basedOn: ['Short-term rental', str.citation, 'HOA and CC&Rs'],
    })
  }
  if (options.length === 0) {
    const cited = divide ?? items[0]
    options.push({
      headline: 'Hold and enjoy it as it stands',
      detail: `The honest answer for this parcel is that the value is the home and the land as they are today, not a development play. ${zoneLabel} does not open a division, an accessory unit, or a middle-housing conversion here, and the same standard applies to every parcel around it, which is what holds the character of the area steady. A buyer here is buying the setting, not an entitlement.`,
      basedOn: cited ? [cited.topic, cited.citation] : [zoneLabel],
    })
  } else {
    options.push({
      headline: 'Or simply keep it as a single home',
      detail:
        'None of the options above is required. Every one of them is an option a buyer holds and can act on later, and the property works as a single residence in the meantime. Optionality is the asset.',
      basedOn: options.map((o) => o.basedOn[0]),
    })
  }
  return options
}

function buildMarketingHighlights(
  items: DevItem[],
  potentialLots: number | null,
  hoa: DevHoa,
  explainer: DevZoningExplainer | null,
  acres: number | null,
): DevMarketingHighlight[] {
  const out: DevMarketingHighlight[] = []
  const by = (t: DevItem['topic']) => items.find((i) => i.topic === t)
  const divide = by('Subdivide or partition')
  const adu = by('ADU')
  const middle = by('Middle housing')
  const str = by('Short-term rental')

  if (potentialLots != null && potentialLots >= 2 && divide?.verdict === 'conditional') {
    out.push({
      headline: `Room to divide: the zone's minimum lot standard supports up to ${potentialLots} lots here.`,
      basis: `${divide.citation}${acres != null ? `, applied to the parcel's ${acres} acres` : ''}`,
    })
  } else if (divide && (divide.verdict === 'no' || divide.verdict === 'confirm') && explainer) {
    const minDim = explainer.dimensional.find((d) => /minimum lot area/i.test(d.label))
    if (minDim) {
      out.push({
        headline: `${explainer.zoneName} holds every parcel here to a minimum lot area of ${minDim.value}, which is what keeps the density where it is.`,
        basis: divide.citation,
      })
    }
  }
  if (adu?.verdict === 'yes') {
    out.push({
      headline:
        adu.headline.includes('two')
          ? 'Zoning allows up to two accessory dwelling units on this lot, for rental income, guests, or family.'
          : 'Zoning allows an accessory dwelling unit on this lot, for rental income, guests, or family.',
      basis: adu.citation,
    })
  } else if (adu?.verdict === 'conditional' && acres != null) {
    out.push({
      headline: `At ${acres} acres this parcel clears the county's 2-acre floor for a rural accessory dwelling unit.`,
      basis: adu.citation,
    })
  }
  if (middle?.verdict === 'yes') {
    out.push({
      headline: 'A duplex, triplex, quadplex, or townhomes are permitted uses on this lot, with no conditional use permit needed.',
      basis: middle.citation,
    })
  }
  if (str?.verdict === 'yes') {
    out.push({
      headline: 'Short-term rental is allowed here administratively, with no separation rule to clear.',
      basis: str.citation,
    })
  } else if (str?.verdict === 'conditional') {
    out.push({
      headline: 'Short-term rental is available in this zone under the local permit process.',
      basis: str.citation,
    })
  }
  if (hoa.hasAssociation === false) {
    out.push({
      headline: 'No homeowners association dues reported on this property.',
      basis: 'MLS association field reported as no',
    })
  } else if (hoa.hasAssociation === true && hoa.feeLabel) {
    out.push({
      headline: `Homeowners association dues of ${hoa.feeLabel}.`,
      basis: 'MLS association fee field',
    })
  }
  if (hoa.resortAssociation) {
    out.push({
      headline: `Inside ${hoa.resortAssociation}, with the resort association amenities and rules that come with it.`,
      basis: `Subdivision matched to ${hoa.resortAssociation} in data/resort-communities.json`,
    })
  }
  return out
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

  let result: ZoneResult
  if (jurisdiction === 'City of Bend') result = bendItems(site.zone, lotSqft, acres)
  else if (jurisdiction === 'City of Redmond') result = redmondItems(site.zone, lotSqft)
  else result = countyItems(site.zone, acres, site.zoneOverlays)

  const canonical = canonicalZone(site.zone)
  const countyKey = canonical === 'SR2.5' ? 'SR2.5' : canonical.replace(/-/g, '')
  const zoningExplainer = resolveZoningExplainer(jurisdiction, site.zone, canonical, countyKey)

  // Nothing to say about the zone AND nothing to say about the parcel means the
  // section is omitted rather than padded.
  if (result.items.length === 0 && !zoningExplainer) return null

  const hoa = resolveHoa(subject as CmaSubject & HoaFactsInput)
  const zoneLabel = zoningExplainer?.zoneName ?? site.zone
  const buyerOptions = buildBuyerOptions(result.items, result.potentialLots, hoa, zoneLabel)
  const marketingHighlights = buildMarketingHighlights(
    result.items,
    result.potentialLots,
    hoa,
    zoningExplainer,
    acres,
  )

  return {
    jurisdiction,
    zone: site.zone,
    verifiedAsOf: REGS_REVERIFIED_DATE,
    zoningExplainer,
    items: result.items,
    buyerOptions,
    hoa,
    marketingHighlights,
    disclaimer: DEV_DISCLAIMER,
    resources: buildResourceDirectory(site),
  }
}
