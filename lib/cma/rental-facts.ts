/**
 * Verified fact registry for the rental-and-income module (lib/cma/rental-potential.ts).
 *
 * Every constant here was read at its PRIMARY source on RENTAL_VERIFIED_DATE and
 * carries that source in its doc comment. This file exists so the facts a
 * licensed broker relies on sit in one auditable place, separate from the logic
 * that assembles them.
 *
 * §0: do not edit a value in this file without re-reading its primary source and
 * moving RENTAL_VERIFIED_DATE. A stale number here is a compliance risk, not a
 * cosmetic one.
 */

/** Date every statute, code section, and tax rate below was read at its primary source. */
export const RENTAL_VERIFIED_DATE = '2026-07-30'

// ─────────────────────────────────────────────────────────────────────────────
// Verified fact registry. Each constant carries the source it was read from on
// RENTAL_VERIFIED_DATE. Do not edit a value without re-reading the source.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum annual rent increase for tenancies under ORS 90.323, calendar year
 * 2026. Source: Oregon Department of Administrative Services, "CORRECTION: 2026
 * Rent Stabilization Percentages", published 2025-10-01. Formula: ORS 90.324(1),
 * the LESSER of 10 percent or 7 percent plus the September annual 12-month
 * average change in CPI-U West Region (All Items). DAS must calculate and
 * publish by September 30 each year.
 */
export const RENT_CAP_YEAR = '2026'
export const RENT_CAP_PCT = '9.5%'

/**
 * The SECOND 2026 ceiling, and the one that makes a bare "9.5%" wrong on the
 * wrong property. DAS publishes two figures: 9.5% for an ordinary residential
 * tenancy, and 6% for a manufactured-home facility or marina with more than 30
 * spaces, whose SPACE rent runs under ORS 90.600 rather than ORS 90.323.
 * Same source and publication date as RENT_CAP_PCT.
 *
 * A manufactured home on its own land is an ordinary tenancy and takes the
 * 9.5% figure. A manufactured home renting a SPACE in a park is the 6% case.
 * We cannot tell those apart from MLS fields with confidence, so the renderer
 * states which figure applies to which arrangement rather than picking one and
 * risking a wrong number in front of a client (§0).
 */
export const RENT_CAP_FACILITY_PCT = '6%'
export const RENT_CAP_SOURCE =
  'Oregon Department of Administrative Services, 2026 rent stabilization percentages (correction published 2025-10-01), calculated under ORS 90.324(1)'
/** Exported so a renderer can link the rent ceiling to the agency that published it. */
export const RENT_CAP_URL =
  'https://apps.oregon.gov/oregon-newsroom/OR/DAS/Posts/Post/Correction-2026-Rent-Stabilization-Percentages'

/**
 * Oregon state transient lodging tax. ORS 320.305(1)(a): "A tax of 1.5 percent
 * is imposed on any consideration charged for the sale, service or furnishing
 * of transient lodging." The 30-consecutive-day exemption is ORS 320.308(6),
 * not ORS 320.305.
 */
export const STATE_LODGING_TAX_PCT = '1.5%'

/**
 * Deschutes County transient room tax. DCC 4.08.090 (Ord. 2025-006, effective
 * 2025-09-01). DCC 4.08.100 limits it to transient lodging facilities located in
 * the UNINCORPORATED area of the county, so it does not reach inside Bend,
 * Redmond, Sisters, or La Pine city limits.
 */
export const COUNTY_ROOM_TAX_PCT = '8%'

/**
 * City of Bend transient room tax. BC 12.05.015(A): "Effective June 1, 2015,
 * each occupant shall pay a tax in the amount of 10.4 percent of the rent."
 */
export const BEND_ROOM_TAX_PCT = '10.4%'

/**
 * City of Redmond lodging tax. RCC 7.102(1) sets the rate by Council resolution
 * rather than in the code text. 9 percent is the figure the City publishes on
 * its own Finance transient-lodging-tax page. The resolution number behind it is
 * not verified, so the citation names the City page as the source.
 */
export const REDMOND_LODGING_TAX_PCT = '9%'

export const ORS_90_URL = 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html'

/**
 * Deschutes County destination resorts named in the development module's
 * verified short-term-rental entry (DCC 18.113), plus the Bend-area association
 * communities where a rental program or CC&R lease-term rule is common. Matching
 * a name here adds a "read the association's rules" step. It never adds a legal
 * claim about the property.
 */
export const ASSOCIATION_COMMUNITIES = [
  'Sunriver',
  'Black Butte Ranch',
  'Caldera Springs',
  'Crosswater',
  'Eagle Crest',
  'Juniper Preserve',
  'Pronghorn',
  'Tetherow',
  'Widgi Creek',
  'Broken Top',
  'Awbrey Glen',
  'Brasada Ranch',
  'Mt Bachelor Village',
  'Mount Bachelor Village',
  'Inn of the 7th Mountain',
  'NorthWest Crossing',
]

/** Cities and places whose unincorporated land the Deschutes County code registry covers. */
export const DESCHUTES_PLACES = new Set([
  'bend',
  'redmond',
  'sisters',
  'la pine',
  'lapine',
  'sunriver',
  'terrebonne',
  'tumalo',
  'alfalfa',
  'brothers',
])

export type JurisdictionKey = 'bend' | 'redmond' | 'county' | 'oregon'

// ─────────────────────────────────────────────────────────────────────────────

export const RENTAL_DISCLAIMER =
  `We read each of these rules at its primary source on ${RENTAL_VERIFIED_DATE}, and every answer cites the statute or code section we relied on. Rental law in Oregon changes every legislative session, the state republishes the maximum rent increase every September, and a recorded covenant or an association rule can be stricter than the code. None of this is legal advice, tax advice, or a land-use decision. Verify anything you plan to rely on with the office that issues it, and with your own attorney and CPA, before you buy on the strength of it.`

export const VACATION_OCCUPANCY_TEXT =
  'A stay escapes ORS chapter 90 only as a vacation occupancy, and that takes all three of these at once: the occupant rents for vacation purposes only and not as a principal residence, the occupant has a principal residence somewhere other than this unit, and the authorized period of occupancy does not exceed 45 days. Miss any one of the three and the occupant is a tenant with habitability, deposit accounting, and written termination notice attached from the first day. A 13-week travel contract that makes this address the occupant\'s residence creates a tenancy. It is not a vacation stay. The other exclusion, transient occupancy, does not reach a house: it requires daily charging, daily or every-other-day maid and linen service, and it is excluded only in a hotel or motel.'

export const MIDTERM_STATE_CITE =
  'ORS 90.100 (definitions of vacation occupancy and transient occupancy), ORS 90.110(4) and (6) (exclusions), ORS 90.427(4)(b) (fixed term ending in the first year), ORS 320.300(11) and ORS 320.308(6) (state lodging tax definition and the 30-consecutive-day exemption).'

/** Who to call when we cannot state a zone-level answer for this address. */
export const PERMIT_OFFICE: Record<JurisdictionKey, string> = {
  bend: 'the City of Bend short-term rental program at 541.388.5580 ext. 8',
  redmond: 'the City of Redmond Planning Division at 541.923.7719',
  county: 'Deschutes County Community Development and the Deschutes County Tax Office',
  oregon: 'the city or county that issues permits for this address',
}

export const ECONOMICS_NOTE =
  'Three tenures, three different engines, and they do not price the same way. A long-term lease trades the top of the market for occupancy: one rent, twelve months or more, one turnover, and an increase ceiling set by the state each year. A mid-term stay of 30 days or longer carries no room tax and no short-term rental permit, and pays for that in furnishings, more frequent turnover, and vacancy between stays. A nightly rental prices by the night and pays for it in room tax, cleaning, linens, management, platform fees, licensing, and a season that is not flat across the year. What decides the number in every case is the same short list: the rate the unit actually achieves, how many nights or months it is occupied, and the operating cost stack underneath. We do not publish a nightly rate, an occupancy percentage, a cap rate, or a yield for this address, because no source we can cite carries those figures for this property, and a number we cannot trace is worse than no number. To model it with real inputs, get four things: a written rent opinion from a Central Oregon property manager for the long-term figure, a revenue history from a short-term rental manager for permitted comparable properties near this one, the association rules and dues if the property is in one, and an insurance quote for the use you intend.'
