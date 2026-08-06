/**
 * Rental and income potential — can this property be rented, on what terms, and
 * what actually drives the money? (Matt directive 2026-07-30: "Can I rent this
 * property? Long-term, short-term, mid-term? Its income potential.")
 *
 * Three tenures, per jurisdiction, each with a primary-source citation:
 *   Long-term  (12 months and up)  — statewide, ORS chapter 90 plus the annual
 *                                    rent-stabilization ceiling.
 *   Mid-term   (roughly 30 days to under a year) — the boundary case. Oregon has
 *                                    no mid-term category. Two lines decide it:
 *                                    the local short-term-rental duration test
 *                                    and the ORS 90.100 vacation-occupancy test.
 *   Short-term (under 30 days)     — IMPORTED from lib/cma/development.ts, which
 *                                    owns the land-use read. This module adds the
 *                                    operating and tax-registration mechanics.
 *
 * PURE FUNCTION over data the CMA builder already fetched (CmaSiteData,
 * CmaSubject). No LLM. No new network calls in the render path.
 *
 * §0 DATA ACCURACY. This section is written for a licensed principal broker, so
 * two rules bind harder here than anywhere else in the report:
 *   1. Every legal claim traces to a statute or code section, quoted from the
 *      primary source on the verification date below, with a working URL.
 *   2. NO income figure ships without a named source. There is no nightly-rate,
 *      occupancy, cap-rate or yield source in this system, so this module
 *      publishes none. It publishes the cost and ceiling figures it CAN cite,
 *      and it explains the economics so the reader can model it with real
 *      quotes. That is the complete answer, not a gap.
 *
 * None of this is legal or tax advice, and none of it is a land-use decision.
 */

import { resolveDevelopmentOpportunities, type DevItem, type DevVerdict } from '@/lib/cma/development'
import {
  ASSOCIATION_COMMUNITIES,
  BEND_ROOM_TAX_PCT,
  COUNTY_ROOM_TAX_PCT,
  DESCHUTES_PLACES,
  ECONOMICS_NOTE,
  MIDTERM_STATE_CITE,
  ORS_90_URL,
  PERMIT_OFFICE,
  REDMOND_LODGING_TAX_PCT,
  RENTAL_DISCLAIMER,
  RENTAL_VERIFIED_DATE,
  RENT_CAP_PCT,
  RENT_CAP_FACILITY_PCT,
  RENT_CAP_SOURCE,
  RENT_CAP_URL,
  RENT_CAP_YEAR,
  STATE_LODGING_TAX_PCT,
  VACATION_OCCUPANCY_TEXT,
  type JurisdictionKey,
} from '@/lib/cma/rental-facts'
import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaSubject } from '@/lib/cma/types'

// Re-exported so the renderer imports the whole contract from one module.
export { RENTAL_VERIFIED_DATE, RENTAL_DISCLAIMER, RENT_CAP_URL }

export interface RentalTenure {
  tenure: 'Long-term' | 'Mid-term' | 'Short-term'
  verdict: DevVerdict
  /** One-line plain answer. Leads with what the owner CAN do. */
  headline: string
  /** The rule, and what this owner must do about it. */
  detail: string
  /** Concrete steps and obligations. */
  requirements: string[]
  citation: string
  url: string
}

export interface RentalIncomeBasis {
  /** What the figure is. */
  label: string
  /** Formatted value. */
  value: string
  /** The NAMED source or the derivation. Never empty. */
  basis: string
}

export interface RentalMarketingHighlight {
  /** A sellable fact in listing-copy voice. Stands alone. */
  headline: string
  /** The citation or derivation it rests on. Never empty. */
  basis: string
}

export interface RentalPotential {
  jurisdiction: string
  tenures: RentalTenure[]
  /** Empty array when nothing can be honestly sourced. The renderer handles empty. */
  income: RentalIncomeBasis[]
  /** Sellable facts for the marketing side. Every one carries its basis. */
  marketingHighlights: RentalMarketingHighlight[]
  /** What drives income and what to obtain to model it. Always present. */
  economicsNote: string
  verifiedAsOf: string
  disclaimer: string
}

/**
 * Resolve the jurisdiction. City code applies only to ANNEXED land, so a parcel
 * inside the UGB but unincorporated is governed by county code (the same rule
 * lib/cma/development.ts applies). With no site record we cannot confirm city
 * limits, so the read degrades to the statewide answer.
 */
function resolveJurisdiction(
  subject: CmaSubject,
  site: CmaSiteData | null,
): { key: JurisdictionKey; label: string } {
  const city = (subject.city ?? '').trim()
  const lc = city.toLowerCase()
  if (site?.isMunicipal) {
    if (lc === 'redmond') return { key: 'redmond', label: 'City of Redmond' }
    if (lc === 'bend') return { key: 'bend', label: 'City of Bend' }
  }
  if (site && !site.isMunicipal && DESCHUTES_PLACES.has(lc)) {
    return { key: 'county', label: 'Deschutes County (unincorporated)' }
  }
  return { key: 'oregon', label: city ? `${city}, Oregon (city limits not confirmed)` : 'Oregon' }
}

/**
 * The association or resort whose rules sit on top of the code, when we can
 * name it. Matches the MLS subdivision first, then the city, because a resort
 * carries its own postal city (Sunriver, Black Butte Ranch) while the
 * subdivision names the phase inside it ("Mtn Village East").
 */
function matchAssociation(subject: CmaSubject): string | null {
  const hay = [(subject.subdivision ?? '').trim(), (subject.city ?? '').trim()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (!hay) return null
  const hit = ASSOCIATION_COMMUNITIES.find((name) => hay.includes(name.toLowerCase()))
  return hit ?? null
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

// ── Long-term (12 months and up) ────────────────────────────────────────────
// Statewide. Every residential tenancy of a dwelling unit in Oregon runs under
// ORS chapter 90, and ORS 91.225 bars a city or county from adding rent control.

function longTermTenure(jur: JurisdictionKey, association: string | null): RentalTenure {
  const requirements: string[] = [
    `Keep the rent-increase clock. No increase during the first year of the tenancy. After that, one increase per 12-month period, 90 days written notice, and no more than the maximum the state publishes for that calendar year. The ${RENT_CAP_YEAR} maximum is ${RENT_CAP_PCT} for an ordinary residential tenancy, and ${RENT_CAP_FACILITY_PCT} for space rent in a manufactured-home facility or marina with more than 30 spaces. ORS 90.323(2), ORS 90.324(1), ORS 90.600.`,
    'Maintain the unit in habitable condition for the whole tenancy: weatherproofing, working plumbing, hot and cold running water, heat, safe wiring, working smoke and carbon monoxide alarms, and working locks on entry doors and windows. ORS 90.320(1).',
    'Return the security deposit with a written accounting within 31 days after the tenancy ends and the tenant delivers possession. ORS 90.300(12) and (13).',
    'Screen without regard to source of income. Oregon counts federal rent subsidy under 42 U.S.C. 1437f and any other local, state or federal housing assistance as protected. ORS 659A.421.',
    'Plan terminations around the first-year line. During the first year of occupancy a month-to-month tenancy ends on 30 days written notice with no reason given. After the first year it ends only for a tenant cause or a qualifying landlord reason, on 90 days written notice, with one month periodic rent in relocation assistance unless you hold an ownership interest in four or fewer residential dwelling units. ORS 90.427(3), (5) and (6).',
    'Give the 30 days written notice before the end date of a fixed term that expires inside the first year of occupancy. Without it the tenancy carries on. ORS 90.427(4)(b).',
    'Tell your insurer the unit is tenant occupied. An owner-occupied homeowner policy is not a landlord policy.',
  ]
  if (association) {
    requirements.push(
      `Read the recorded CC&Rs and the ${association} association rules before you count on a 12-month lease. An association can set a minimum lease term, a rental cap, or a registration step that the code does not.`,
    )
  } else {
    requirements.push(
      'Read the recorded CC&Rs and any association rules before you count on a 12-month lease. An association can set a minimum lease term, a rental cap, or a registration step that the code does not.',
    )
  }
  if (jur === 'bend') {
    requirements.push(
      'Add Bend\'s local layer to the state notice rules. Where a month-to-month tenant has occupied the dwelling for more than one year, a no-cause termination takes 90 days written notice, or the period in the rental agreement if that is longer. Getting it wrong exposes the landlord to up to three months rent plus actual damages, attorney fees, and costs. Bend Code 5.60.005 and 5.60.010, Ord. NS-2283, 2016.',
      'Confirm your own registration position with the City of Bend. Bend has no rental registration, licensing, or inspection program for long-term rentals, and Bend Code 7.05.020 requires a business registration for businesses operating in the city while 7.05.025(A)(4) exempts passive holding of property for investment. Which side a landlord falls on is a question for the City and your CPA, not one we will answer for you.',
    )
  } else if (jur === 'redmond') {
    requirements.push(
      'Confirm your own registration position with the City of Redmond. Redmond has no rental registration or inspection program for long-term rentals, and Redmond City Code 7.014 requires a business license while 7.015(11) exempts passive holding of property for investment. Which side a landlord falls on is a question for the City and your CPA.',
    )
  } else if (jur === 'county') {
    requirements.push(
      'Deschutes County adds nothing to the state rulebook for a long-term tenancy. County Title 5 carries no rental registration or inspection program, and the only county rental registration is the transient lodging Certificate of Authority under DCC 4.08.140, which reaches short-term rentals only.',
    )
  } else {
    requirements.push(
      'Confirm with the city or county that issues permits for this address whether any local rental registration or inspection program applies. ORS 91.225 bars a local rent control ordinance, so the rent rules above are the ceiling either way.',
    )
  }

  return {
    tenure: 'Long-term',
    verdict: 'yes',
    headline: 'Yes. A 12-month lease is available here, and one statewide rulebook governs it.',
    requirements,
    detail:
      `Oregon runs every residential tenancy of a dwelling unit through one statute, the Residential Landlord and Tenant Act at ORS chapter 90, and it applies the same way in every city and county. You set the starting rent freely. The increase rules take over once the tenancy begins: nothing during the first year, then one increase per 12-month period on 90 days written notice, capped at the percentage the state publishes for that calendar year. The ${RENT_CAP_YEAR} figure is ${RENT_CAP_PCT} for an ordinary residential tenancy, which is the lesser of 10 percent or 7 percent plus the September 12-month average change in the West Region consumer price index. A different ceiling of ${RENT_CAP_FACILITY_PCT} governs space rent in a manufactured-home facility or marina with more than 30 spaces, which runs under ORS 90.600 instead. A unit whose first certificate of occupancy issued less than 15 years before the notice is exempt from the cap entirely, as is a unit regulated or certified as affordable housing. Terminations follow the same first-year line: 30 days written notice with no reason given during the first year of occupancy, and after that only for a tenant cause or a qualifying landlord reason such as moving in, selling to a buyer who will occupy, demolition, conversion, or repairs that require the unit to be vacant. Oregon also bars cities and counties from adopting their own rent control, so the state ceiling is the ceiling at this address.`,
    citation:
      `ORS 90.323 and 90.324 (rent increases), ORS 90.427 (terminations), ORS 90.320 (habitability), ORS 90.300 (deposits), ORS 659A.421 (source of income), ORS 91.225 (no local rent control). ${RENT_CAP_YEAR} maximum ${RENT_CAP_PCT} for a residential tenancy and ${RENT_CAP_FACILITY_PCT} for facility space rent (ORS 90.600), per ${RENT_CAP_SOURCE}.${jur === 'bend' ? ' Local layer: Bend Code 5.60.005 and 5.60.010 (additional tenant protections), Ord. NS-2283, 2016.' : ''}`,
    url: ORS_90_URL,
  }
}

// ── Mid-term (roughly 30 days to under a year) ──────────────────────────────
// The boundary. Two independent lines decide what a stay is:
//   1. LOCAL land use + room tax: a short-term rental is occupancy of fewer than
//      30 consecutive days, so a 30-day-plus stay is outside the permit.
//   2. STATE tenancy law: a stay escapes ORS chapter 90 only as a "vacation
//      occupancy", which takes ALL THREE tests in ORS 90.100 (vacation purposes
//      only, occupant has another principal residence, 45 days maximum).
// Miss one test and the occupant is a tenant from day one.

function midTermTenure(jur: JurisdictionKey, association: string | null): RentalTenure {
  const requirements: string[] = [
    'Decide which of the two the stay is before anyone signs. Vacation occupancy takes all three tests in ORS 90.100. Anything else is a tenancy under ORS chapter 90 no matter how short it is.',
    'Write a fixed term. A fixed term whose ending date falls inside the first year of occupancy ends without cause on 30 days written notice given before that date. Skip the notice and the tenancy carries on. ORS 90.427(4)(b).',
    'Charge by the month rather than by the day. Daily charging plus daily or every-other-day maid and linen service is the transient-occupancy pattern in ORS 90.100, and that exclusion only applies in a hotel or motel.',
    'Meet the habitability standard and the 31-day deposit accounting even on a 60-day stay. ORS 90.320 and ORS 90.300 do not have a length floor.',
    'Inventory the furnishings in the agreement and price the turnover. A furnished mid-term unit refills several times a year, and each refill carries a cleaning, a listing, and a vacancy gap.',
    'Confirm the lodging-tax exemption with the taxing office in writing before you stop collecting on a long stay. Oregon exempts a dwelling unit occupied by the same person for a consecutive period of 30 days or more, and the exemption covers the whole stay. ORS 320.308(6). Local room tax runs on its own ordinance.',
  ]
  if (association) {
    requirements.push(
      `Check the ${association} association rules for a minimum lease term. A 30-day floor is common in resort and condominium covenants and it is enforced privately, not by the city or county.`,
    )
  }

  if (jur === 'oregon') {
    return {
      tenure: 'Mid-term',
      verdict: 'confirm',
      headline: 'The state half of the answer is settled. Confirm the local half with the permitting office.',
      detail:
        `Oregon has no separate mid-term category, so two independent lines decide what a 30-day-plus stay is. The state line is fixed and it applies at this address. ${VACATION_OCCUPANCY_TEXT} The local line is the one to confirm: cities and counties define a short-term rental by the length of the stay, and that definition decides whether a permit and a room tax attach. Confirm the definition with the office that issues short-term rental permits for this address before you plan on a 30-day-plus program.`,
      requirements,
      citation: MIDTERM_STATE_CITE,
      url: ORS_90_URL,
    }
  }

  const localLine =
    jur === 'bend'
      ? 'Bend defines a short-term rental as the use of a dwelling unit for rent for a period of less than 30 consecutive days. A stay of 30 days or longer is therefore not a short-term rental in Bend at all, so it sits outside the land use permit, outside the annual operating license, and outside the 500-foot separation test that governs whole-house nightly rental. The city room tax draws the same line: Bend Code 12.05.010(A) defines taxable occupancy as use for less than 30 days.'
      : jur === 'redmond'
        ? 'Redmond defines a short-term rental as a dwelling unit made available for use, rent, or occupancy for a period of less than 30 consecutive days. A stay of 30 days or longer is therefore not a short-term rental in Redmond, so it sits outside the city permit and its parking, occupancy, signage, and local-contact standards.'
        : 'Deschutes County ties its short-term rental rules to occupancy, which DCC 4.08.050 defines as use for less than 30 consecutive calendar days. DCC 4.08.052 goes further and says a person who pays for lodging on a monthly basis, regardless of the number of days in the month, is not an occupant at all. A stay of 30 days or longer, or any tenancy billed monthly, sits outside county short-term rental registration and outside the county room tax. That matters most on farm and forest land, where the county prohibits short-term rentals and leaves 30-day-plus and long-term rental open.'

  const localCite =
    jur === 'bend'
      ? ' Local: Bend Development Code Ch. 1.2 (definition of short-term rental, Ord. NS-2541, 2025) and Bend Code 12.05.010(A) (room tax occupancy).'
      : jur === 'redmond'
        ? ' Local: Redmond City Code 7.134 (definition of short-term rental, Ord. No. 2020-04 and Ord. No. 2022-04).'
        : ' Local: Deschutes County Code 4.08.050 and 4.08.052 (occupancy and occupant, Ord. 2025-006, effective 2025-09-01).'

  return {
    tenure: 'Mid-term',
    verdict: 'yes',
    headline: 'Open, and it is the widest path here. A stay of 30 days or longer is not a short-term rental.',
    detail:
      `Oregon has no separate mid-term category, so two independent lines decide what a stay is, and both point the same way for a 30-day-plus program. ${localLine} Oregon draws the same line for lodging tax: a guest who stays 30 or more consecutive days at the same facility is exempt, and the exemption covers the entire stay. The second line is the tenancy line, and it is the one that catches people. ${VACATION_OCCUPANCY_TEXT} The practical read for this property: a furnished 30-day-plus rental avoids the short-term rental permit and the room tax, and in exchange it is a tenancy, so write it as a fixed term and run it under ORS chapter 90 from day one.`,
    requirements,
    citation: `${MIDTERM_STATE_CITE}${localCite}`,
    url: ORS_90_URL,
  }
}

// ── Short-term (under 30 days) ──────────────────────────────────────────────
// The land-use read is IMPORTED from lib/cma/development.ts, which owns it and
// carries the verified permit mechanics, density caps, EFU/Forest carve-outs,
// the ADU trade-off, the resort layer, and the county room tax. This module adds
// what that entry does not carry: what the owner must physically DO to operate,
// and the tax-registration mechanics.

type ShortTermMode = 'allowed' | 'prohibited' | 'unresolved'

function shortTermOperatingSteps(
  jur: JurisdictionKey,
  mode: ShortTermMode,
  association: string | null,
): string[] {
  if (mode === 'unresolved') {
    const steps = [
      `Confirm the zone of record and the short-term rental status with ${PERMIT_OFFICE[jur]} before you plan on nightly income. We are not going to state a permit answer we could not resolve from the record.`,
      'Confirm the local room tax rate, the registration deadline, and who remits it with the same office.',
      `Register with the Oregon Department of Revenue for the ${STATE_LODGING_TAX_PCT} state transient lodging tax if nightly rental turns out to be available. ORS 320.305(1)(a).`,
      association
        ? `Confirm the ${association} association rules in parallel. A resort or condominium association can require registration, route bookings through its own rental program, or set a minimum stay that the code does not.`
        : 'Read the recorded CC&Rs and any association rules in parallel. A private covenant can restrict nightly rental independently of the city or county code.',
      'Long-term leasing and stays of 30 days or longer do not depend on that answer. Both are available at this address today.',
    ]
    return steps
  }
  if (mode === 'prohibited') {
    const steps = [
      'Do not plan on nightly income at this address. Deschutes County prohibits short-term rentals on Exclusive Farm Use and Forest Use zoned land.',
      'The open paths are a long-term tenancy and a stay of 30 days or longer. Neither is a short-term rental, so neither runs into the prohibition.',
      'Confirm the zoning of record on the Deschutes County DIAL parcel record before you rely on either read.',
    ]
    if (association) {
      steps.push(`Confirm the ${association} association rules as well. A private covenant can restrict rental separately from the county code.`)
    }
    return steps
  }

  const state = `Register with the Oregon Department of Revenue for the ${STATE_LODGING_TAX_PCT} state transient lodging tax and file a quarterly return by the last day of the month after each calendar quarter, including quarters with nothing collected. ORS 320.305(1)(a).`
  const platform =
    'Confirm in writing which taxes your booking platform remits on your behalf and which ones you still owe directly. A platform that collects one tax does not necessarily collect the others, and the registration obligation stays with you.'
  const covenant = association
    ? `Confirm the ${association} association rules before you list. A resort or condominium association can require registration, route bookings through its own rental program, cap rentals, or set a minimum stay that the code does not.`
    : 'Read the recorded CC&Rs and any association rules before you list. A private covenant can restrict or prohibit nightly rental independently of the city or county code.'
  const insurance =
    'Get a short-term rental endorsement or a dedicated policy. A standard homeowner policy is written for owner occupancy and a platform host guarantee is not a substitute for liability coverage.'

  if (jur === 'bend') {
    return [
      'Check the address against the City of Bend short-term rental map first. A whole-house Type II permit needs 500 feet of radial separation from any property that already holds a Type II permit or has one pending, and that test is decided by the neighbors rather than by the property.',
      'Apply for the land use permit that matches the operation. A hosted rental of up to two rooms in your own residence and an infrequent whole-house rental are processed administratively. A regular whole-house rental is the Type II track.',
      'Hold an active City of Bend business registration, then apply for the short-term rental operating license under Bend Code Chapter 7.16 within 60 days of final land use approval. The land use permit and the operating license are two separate authorizations. Bend Code 7.16.030 and 7.16.060(B)(1)(b).',
      'Pass the inspection. A short-term rental application is subject to a City inspection before the use starts, and the application itself carries a written consent to inspect. Bend Development Code 3.6.500(B)(6) and (N).',
      'Name a contact who answers the phone at any hour, seven days a week, while the unit is occupied, and give the City written notice at least 14 days before that contact changes. Bend Code 7.16.070(B)(4).',
      'Deliver the annual neighbor notice to every property within 250 feet, by flier or posted placard. Bend Code 7.16.070(B)(5).',
      'Renew the operating license every year and post it inside the dwelling next to the front door. A fire-safety checklist covering extinguishers, smoke alarms, and carbon monoxide detectors goes with every application and renewal. Bend Code 7.16.050(A), 7.16.060(B), 7.16.070(C)(1) and (D).',
      `Register for the ${BEND_ROOM_TAX_PCT} City of Bend transient room tax within 15 calendar days of commencing business and display the certificate of authority at the property. Bend Code 12.05.015(A) and 12.05.030.`,
      state,
      platform,
      'Plan for the permit to void on sale. It does not run with the land. A buyer has 60 days from closing to obtain their own operating license and applies under the rules in effect at that time, including the separation test. Bend Development Code 3.6.500(F), Bend Code 7.16.050(B) and 7.16.060(B)(1)(c).',
      'Keep the use alive. A permit is void if the unit goes 12 months without a rental, and the license lapses if it is not renewed. A verified 12-month lease supports a long-term rental exemption for up to three renewals rather than losing the permit. Bend Development Code 3.6.500(K) and (L), Bend Code 7.16.070(B)(1)(a).',
      covenant,
      insurance,
    ]
  }
  if (jur === 'redmond') {
    return [
      'Obtain the city business license before any rental, then apply for the short-term rental permit. Renew the business license every January. Redmond City Code 7.138(1).',
      `Register with the tax administrator within 15 calendar days of commencing business, display the certificate of authority, and remit the ${REDMOND_LODGING_TAX_PCT} Redmond lodging tax monthly by the 15th for the preceding month. Redmond City Code 7.110(1) and 7.112(1). A business license or lodging tax payment 30 days past due can cost you the permit. Redmond City Code 7.138(1).`,
      'Provide one off-street parking space beyond the onsite requirement, cap occupancy at three persons over age 3 per bedroom, post the occupancy limit and the Good Neighbor Guidelines inside, keep weekly solid-waste pickup year round, and put up no signage. Redmond City Code 7.138(2) through (5).',
      'Name a local responsible party who permanently resides in the vicinity of Redmond, give the City that phone number, and post it in the unit. Redmond City Code 7.138(6).',
      'Confirm the housing type qualifies. Redmond excludes triplexes, quadplexes, cottage developments, and multi-family complexes, and where a home and an ADU share a lot only one of the two rents short-term. The permit is not transferable. Redmond City Code 7.138(7).',
      state,
      platform,
      covenant,
      insurance,
    ]
  }
  // Unincorporated Deschutes County, and the statewide fallback.
  if (jur === 'county') {
    return [
      `Register with the Deschutes County Tax Administrator within 15 calendar days after commencing business, then display the Certificate of Authority in the unit where every guest can see it, and renew that certificate every year. The duty to collect the ${COUNTY_ROOM_TAX_PCT} county room tax starts when the first rent is paid, whether or not the certificate has issued yet. Deschutes County Code 4.08.090 and 4.08.140(A) and (C).`,
      'Put the DCCA certificate number in every advertisement, in a readable size and font. Leaving it out is a Class A violation. Deschutes County Code 4.08.145.',
      'File monthly when average tax runs over $50 a month, or elect quarterly at or under that, with reports due by the 15th and taxes delinquent after the last day of the month they are due. File even in a period with no tax owed, and file quarterly regardless if a hosting platform remits for you. Deschutes County Code 4.08.150(A) and (B).',
      'Confirm which county the parcel sits in before you rely on that rate. The county room tax reaches transient lodging in the unincorporated area only, and a neighboring county sets its own. Deschutes County Code 4.08.100.',
      state,
      platform,
      'Keep the rural ADU trade-off in view. A property that adds a rural ADU gives up vacation-rental use of both units under DCC 18.116.355.',
      covenant,
      insurance,
    ]
  }
  return [
    'Confirm with the city or county that issues permits for this address whether a short-term rental permit, a license, or a registration applies, and whether the zone allows it at all.',
    'Confirm the local room tax rate and the registration deadline with the local finance or tax office.',
    state,
    platform,
    covenant,
    insurance,
  ]
}

function shortTermTenure(
  jur: JurisdictionKey,
  strItem: DevItem | null,
  association: string | null,
): RentalTenure {
  const mode: ShortTermMode = !strItem ? 'unresolved' : strItem.verdict === 'no' ? 'prohibited' : 'allowed'
  const requirements = shortTermOperatingSteps(jur, mode, association)
  // Sunriver carries a county occupancy cap on overnight rentals that no other
  // unincorporated community has. It is a code rule, not an association rule.
  if (jur === 'county' && association === 'Sunriver' && mode !== 'prohibited') {
    requirements.push(
      'Cap overnight-rental occupancy at two persons per sleeping area plus two additional persons. Deschutes County writes this rule for the Sunriver zone specifically, on top of anything the association requires. Deschutes County Code 5.12.050, Ord. 91-044 as amended by Ord. 95-030.',
    )
  }

  if (!strItem) {
    return {
      tenure: 'Short-term',
      verdict: 'confirm',
      headline: 'Confirm nightly rental with the office that permits it for this address.',
      detail:
        'We could not resolve a zone-level short-term rental read for this parcel, so we are not going to state one. Nightly rental in Oregon is regulated locally: the city or county decides whether the zone allows it, whether a land use permit or a license is required, and what room tax attaches. The operating steps below apply wherever nightly rental is allowed.',
      requirements,
      citation: 'Short-term rental regulation is local. Confirm with the permitting jurisdiction for this address.',
      url: 'https://www.oregon.gov/dor/programs/businesses/pages/lodging.aspx',
    }
  }

  return {
    tenure: 'Short-term',
    verdict: strItem.verdict,
    headline: strItem.headline,
    detail: strItem.detail,
    requirements,
    citation: strItem.citation,
    url: strItem.url,
  }
}

// ── Income: only what carries a named source ────────────────────────────────

function buildIncome(
  jur: JurisdictionKey,
  subject: CmaSubject,
  shortTermMode: ShortTermMode,
): RentalIncomeBasis[] {
  const income: RentalIncomeBasis[] = []

  // A room tax figure is only meaningful where nightly rental is actually
  // available. On a prohibited parcel it is noise, and on an unresolved parcel
  // it reads as permission we have not confirmed.
  if (shortTermMode === 'allowed') {
    if (jur === 'bend') {
      income.push({
        label: 'Room tax on nightly revenue',
        value: `${BEND_ROOM_TAX_PCT} city plus ${STATE_LODGING_TAX_PCT} state`,
        basis: `Bend Code 12.05.015(A), "Effective June 1, 2015, each occupant shall pay a tax in the amount of 10.4 percent of the rent", and ORS 320.305(1)(a) for the state transient lodging tax. Both read at the primary source on ${RENTAL_VERIFIED_DATE}. Operators retain a 5 percent administrative charge under Bend Code 12.05.015(B).`,
      })
    } else if (jur === 'redmond') {
      income.push({
        label: 'Room tax on nightly revenue',
        value: `${REDMOND_LODGING_TAX_PCT} city plus ${STATE_LODGING_TAX_PCT} state`,
        basis: `Redmond City Code 7.102(1) sets the rate by Council resolution, and the City publishes 9 percent on its Finance transient-lodging-tax page. State rate per ORS 320.305(1)(a). Both read ${RENTAL_VERIFIED_DATE}. Collectors retain 5 percent under Redmond City Code 7.112(5).`,
      })
    } else if (jur === 'county') {
      income.push({
        label: 'Room tax on nightly revenue',
        value: `${COUNTY_ROOM_TAX_PCT} county plus ${STATE_LODGING_TAX_PCT} state`,
        basis: `Deschutes County Code 4.08.090 (Ord. 2025-006, effective 2025-09-01), which applies to the unincorporated area only under DCC 4.08.100, and ORS 320.305(1)(a) for the state transient lodging tax. Both read ${RENTAL_VERIFIED_DATE}.`,
      })
    }
  }

  income.push({
    label: `Maximum rent increase on a tenancy, calendar year ${RENT_CAP_YEAR}`,
    value: `${RENT_CAP_PCT} residential, ${RENT_CAP_FACILITY_PCT} facility space rent`,
    basis: `${RENT_CAP_SOURCE}, published at ${RENT_CAP_URL}. Applies after the first year of a tenancy under ORS 90.323. The state republishes this figure by September 30 each year, so the ceiling for a later year is not this number.`,
  })

  if (subject.taxAnnual != null && subject.taxAnnual > 0) {
    income.push({
      label: 'Property tax of record, annual',
      value: usd(subject.taxAnnual),
      basis: `Annual tax carried on the MLS record for this property${subject.mlsNumber ? ` (MLS ${subject.mlsNumber})` : ''}.`,
    })
  }

  return income
}

// ── Marketing highlights: sellable facts, each with its basis ───────────────

function buildHighlights(
  jur: JurisdictionKey,
  tenures: RentalTenure[],
  association: string | null,
): RentalMarketingHighlight[] {
  const out: RentalMarketingHighlight[] = []
  const shortTerm = tenures.find((t) => t.tenure === 'Short-term')
  const midTerm = tenures.find((t) => t.tenure === 'Mid-term')

  if (shortTerm && shortTerm.verdict !== 'no' && shortTerm.verdict !== 'confirm') {
    if (jur === 'bend') {
      out.push({
        headline:
          'Nightly rental is on the table at this address. An owner-occupied rental of up to two rooms is processed administratively and is exempt from the 500-foot separation rule that governs whole-house permits.',
        basis: `Bend Development Code 3.6.500(C) and (E), and Bend Code Ch. 7.16 for the operating license. Land-use read carried from lib/cma/development.ts, verified 2026-07-14.`,
      })
    } else if (jur === 'redmond') {
      out.push({
        headline:
          'Nightly rental is permitted here with a city permit, and Redmond sets no separation rule, no cap, and no waitlist. A conforming property that meets the standards qualifies.',
        basis: 'Redmond City Code Secs. 7.132 to 7.140. Land-use read carried from lib/cma/development.ts, verified 2026-07-14.',
      })
    } else if (jur === 'county') {
      out.push({
        headline: `Nightly rental is permitted here with no land use permit, no density cap, and no separation rule. The county requires tax registration and the ${COUNTY_ROOM_TAX_PCT} room tax.`,
        basis: 'Deschutes County Code 4.08.071, 4.08.090 and 4.08.140 (Ord. 2025-006, effective 2025-09-01). Land-use read carried from lib/cma/development.ts, verified 2026-07-14.',
      })
    }
  }

  if (shortTerm?.verdict === 'no') {
    out.push({
      headline:
        'Long-term leasing and stays of 30 days or longer are both open on this land. The county rule that closes nightly rental reaches short-term rentals only.',
      basis: 'Deschutes County Code 4.08.071 prohibits short-term rentals in Exclusive Farm Use and Forest Use zones. A tenancy of any length runs under ORS chapter 90, which the county code does not restrict.',
    })
  }

  if (midTerm?.verdict === 'yes') {
    const def =
      jur === 'bend'
        ? 'Bend Development Code Ch. 1.2 defines a short-term rental as use for rent for a period of less than 30 consecutive days.'
        : jur === 'redmond'
          ? 'Redmond City Code 7.134 defines a short-term rental as use, rent, or occupancy for a period of less than 30 consecutive days.'
          : 'Deschutes County Code 4.08.050 defines taxable occupancy as use for less than 30 consecutive calendar days.'
    out.push({
      headline:
        'A stay of 30 days or longer is not a short-term rental. No nightly permit, no local room tax, and the state exempts the whole stay at 30 consecutive days.',
      basis: `${def} State exemption per ORS 320.308(6). The stay runs as a tenancy under ORS chapter 90.`,
    })
  }

  out.push({
    headline:
      'Long-term leasing here runs on one statewide rulebook. Oregon bars cities and counties from layering their own rent control on top.',
    basis: 'ORS 91.225 (state preemption of local rent control), with the annual ceiling set by ORS 90.324(1).',
  })

  if (association) {
    out.push({
      headline: `${association} carries its own association rules on rental, on top of the code, and they are worth reading early.`,
      basis: 'Recorded CC&Rs and association rules for the community named on the MLS subdivision or city record for this property.',
    })
  }

  return out
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Resolve the rental-and-income read for a subject.
 *
 * Returns null only when the property is outside Oregon, since every rule in
 * this module is an Oregon statute or a Central Oregon code section. A parcel
 * with no site record still gets the statewide long-term answer, with the
 * local-rule tenures degraded to 'confirm'.
 */
export function resolveRentalPotential(
  subject: CmaSubject,
  site: CmaSiteData | null,
): RentalPotential | null {
  const state = (subject.state ?? '').trim().toUpperCase()
  if (state && state !== 'OR' && state !== 'OREGON') return null

  const { key, label } = resolveJurisdiction(subject, site)
  const association = matchAssociation(subject)

  const dev = site ? resolveDevelopmentOpportunities(site, subject) : null
  // The imported land-use read is only trusted where THIS module resolved the
  // jurisdiction to one whose code registry it covers. An incorporated city we
  // do not cover (Sisters, La Pine) would otherwise inherit the county branch's
  // room-tax claim, and DCC 4.08.100 limits that tax to unincorporated land.
  const strItem =
    key === 'oregon' ? null : (dev?.items.find((i) => i.topic === 'Short-term rental') ?? null)
  const shortTermMode: ShortTermMode = !strItem
    ? 'unresolved'
    : strItem.verdict === 'no'
      ? 'prohibited'
      : 'allowed'

  const tenures: RentalTenure[] = [
    longTermTenure(key, association),
    midTermTenure(key, association),
    shortTermTenure(key, strItem, association),
  ]

  return {
    jurisdiction: label,
    tenures,
    income: buildIncome(key, subject, shortTermMode),
    marketingHighlights: buildHighlights(key, tenures, association),
    economicsNote: ECONOMICS_NOTE,
    verifiedAsOf: RENTAL_VERIFIED_DATE,
    disclaimer: RENTAL_DISCLAIMER,
  }
}
