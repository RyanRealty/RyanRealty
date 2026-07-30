/**
 * Zoning explainer — what a zone IS, in plain English, per jurisdiction.
 *
 * Companion to lib/cma/development.ts. Same discipline: a PURE synchronous
 * registry over data the property-intelligence resolver already fetched. No
 * LLM, no network calls, every profile carries its code citation + source URL.
 *
 * This module holds the City of Bend profiles plus the cross-jurisdiction
 * resolver. Redmond lives in lib/cma/zoning-redmond.ts and the unincorporated
 * county in lib/cma/zoning-county.ts (split to hold the per-file size budget).
 * Shared types live in lib/cma/zoning-types.ts.
 *
 * PRIMARY-SOURCE VERIFICATION (2026-07-30, the Bend facts in this file):
 *   BDC Table 2.1.100 (district characteristics + density ranges),
 *   Table 2.1.200 (permitted / conditional uses), 2.1.300 (setbacks),
 *   Table 2.1.500 (lot area + dimensions), Table 2.1.600 (density),
 *   2.1.800 (building height). Read verbatim at bend.municipal.codes.
 *
 * The use lists are the PRINCIPAL residential and residentially-relevant uses,
 * not the complete tables. The cited section is the governing list and the
 * disclaimer in development.ts says so.
 */

import type { DevJurisdiction, ZoneProfile } from '@/lib/cma/zoning-types'
import { REDMOND_ZONES } from '@/lib/cma/zoning-redmond'
import { COUNTY_ZONES } from '@/lib/cma/zoning-county'

export type { DevDimension, DevZoningExplainer, ZoneProfile, DevJurisdiction } from '@/lib/cma/zoning-types'
import type { DevZoningExplainer } from '@/lib/cma/zoning-types'

const BEND_TABLE_URL = 'https://bend.municipal.codes/BDC/2.1.100'

// ── City of Bend ────────────────────────────────────────────────────────────
// Purpose strings paraphrase BDC Table 2.1.100 closely. Density ranges, lot
// areas, setbacks and heights are the literal adopted numbers.

const BEND_COMMON_CITATION =
  'Bend Development Code Table 2.1.100 (district characteristics), Table 2.1.200 (uses), 2.1.300 (setbacks), Table 2.1.500 (lot area), Table 2.1.600 (density), 2.1.800 (height)'

const BEND_LOW_USES = [
  'Single-unit detached dwelling',
  'Accessory dwelling units, up to two per lot',
  'Duplex, triplex, and quadplex',
  'Townhomes',
  'Cottage cluster development',
  'Manufactured homes on individual lots',
  'Single-room occupancy',
  'Residential care home of five or fewer residents',
  'Family childcare home of 16 or fewer children',
  'Adult day care',
  'Home business',
  'Short-term rental, subject to BDC 3.6.500',
  'Neighborhood parks',
]

const BEND_LOW_CONDITIONAL = [
  'Places of worship',
  'Clubs, lodges, and similar uses',
  'Schools',
  'Libraries, museums, and community centers',
  'Community and regional parks',
  'Child care facility of 17 or more children',
  'Bed and breakfast inn',
  'Above-ground utilities',
  'Government offices and facilities',
  'Hospital',
  'Cemetery or mausoleum',
]

const BEND_ZONES: Record<string, ZoneProfile> = {
  UAR: {
    zoneName: 'Urban Area Reserve',
    purpose:
      'Urban Area Reserve is a holding zone for future urban development. It keeps land at a rural density until the city is ready to urbanize it, so the maximum residential density is one dwelling unit per 10 gross acres.',
    permittedOutright: [
      'Single-unit detached dwelling',
      'Accessory dwelling units, up to two per lot',
      'Manufactured homes on individual lots',
      'Farm use and agriculture',
      'Residential care home of five or fewer residents',
      'Family childcare home of 16 or fewer children',
      'Home business',
      'Short-term rental, subject to BDC 3.6.500',
      'Neighborhood parks',
    ],
    conditional: [
      'Destination resorts',
      'Places of worship',
      'Schools',
      'Boarding kennel',
      'Bed and breakfast inn',
      'Plant nursery larger than one acre',
      'Large-animal veterinary clinic',
      'Above-ground utilities',
      'Community and regional parks',
    ],
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: '10 acres' },
      { label: 'Minimum lot width', value: '300 ft average, with 150 ft of street frontage' },
      { label: 'Residential density', value: '1 unit per 10 gross acres, minimum and maximum' },
      { label: 'Front setback', value: '20 ft' },
      { label: 'Side setback', value: '10 ft' },
      { label: 'Rear setback', value: '10 ft' },
      { label: 'Maximum building height', value: '35 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
  RL: {
    zoneName: 'Low Density Residential',
    purpose:
      'Low Density Residential is Bend\'s large-lot urban residential zone, served by a community water system and by community sewer, municipal sewer, or private on-site septic. The density range is 1.1 to 4.0 dwelling units per gross acre, the lowest of any zone inside the city.',
    permittedOutright: BEND_LOW_USES,
    conditional: [...BEND_LOW_CONDITIONAL, 'Manufactured dwelling park', 'Small-animal veterinary clinic'],
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: '10,000 sq ft' },
      { label: 'Minimum lot width and depth', value: '50 ft at the front property line, 100 ft deep' },
      { label: 'Residential density', value: '1.1 to 4.0 units per gross acre' },
      { label: 'Minimum lot area, duplex / triplex / quadplex', value: '10,000 sq ft' },
      { label: 'Minimum lot area, townhome', value: '1,500 sq ft average per unit' },
      { label: 'Front setback', value: '20 ft' },
      { label: 'Side and rear setback', value: '10 ft each' },
      { label: 'Maximum building height', value: '35 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
  RS: {
    zoneName: 'Standard Density Residential',
    purpose:
      'Standard Density Residential is Bend\'s most common residential zone. It is written to carry a wide variety of housing types at the city\'s most typical densities, in places where community sewer and water are available. The density range is 4.0 to 7.3 dwelling units per gross acre.',
    permittedOutright: [...BEND_LOW_USES, 'Cottage housing development', 'Micro-units'],
    conditional: [...BEND_LOW_CONDITIONAL, 'Manufactured dwelling park'],
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: '4,000 sq ft' },
      { label: 'Minimum lot width and depth', value: '40 ft at the front property line, 50 ft deep' },
      { label: 'Residential density', value: '4.0 to 7.3 units per gross acre' },
      { label: 'Minimum lot area, duplex / triplex / quadplex', value: '4,000 sq ft' },
      { label: 'Minimum lot area, townhome', value: '1,500 sq ft average per unit' },
      { label: 'Front setback', value: '10 ft, and 20 ft for a garage or carport with street access' },
      { label: 'Side and rear setback', value: '5 ft each' },
      { label: 'Maximum building height', value: '35 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
  'RM-10': {
    zoneName: 'Medium-10 Density Residential',
    purpose:
      'Medium-10 Density Residential is written to carry manufactured dwelling park development alongside a variety of single-unit and multi-unit housing types. The density range is 6.0 to 10.0 dwelling units per gross acre.',
    permittedOutright: [
      ...BEND_LOW_USES,
      'Cottage housing development',
      'Micro-units',
      'Multi-unit residential of more than four units',
      'Manufactured dwelling park',
    ],
    conditional: [...BEND_LOW_CONDITIONAL, 'Residential care facility of six or more residents'],
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: '4,000 sq ft' },
      { label: 'Minimum lot width and depth', value: '40 ft at the front property line, 50 ft deep' },
      { label: 'Residential density', value: '6.0 to 10.0 units per gross acre' },
      { label: 'Minimum lot area, duplex / triplex / quadplex', value: '4,000 sq ft' },
      { label: 'Minimum lot area, townhome', value: '1,500 sq ft average per unit' },
      { label: 'Front setback', value: '10 ft, and 20 ft for a garage or carport with street access' },
      { label: 'Side and rear setback', value: '5 ft each' },
      { label: 'Maximum building height', value: '35 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
  RM: {
    zoneName: 'Medium Density Residential',
    purpose:
      'Medium Density Residential is written primarily for multi-unit residential where sewer and water are available, and to act as a transition between the lower-density residential zones and less restrictive areas. The density range is 7.3 to 21.7 units per gross acre.',
    permittedOutright: [
      ...BEND_LOW_USES,
      'Cottage housing development',
      'Micro-units',
      'Multi-unit residential of more than four units',
      'Manufactured dwelling park',
      'Residential care facility of six or more residents',
    ],
    conditional: BEND_LOW_CONDITIONAL,
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: '2,500 sq ft' },
      { label: 'Minimum lot width and depth', value: '30 ft at the front property line, 50 ft deep' },
      { label: 'Residential density', value: '7.3 to 21.7 units per gross acre' },
      { label: 'Minimum lot area, duplex', value: '2,500 sq ft. Triplex and quadplex, 4,000 sq ft' },
      { label: 'Minimum lot area, townhome', value: '1,500 sq ft average per unit' },
      { label: 'Front setback', value: '10 ft, and 20 ft for a garage or carport with street access' },
      { label: 'Side and rear setback', value: '5 ft each' },
      { label: 'Maximum building height', value: '40 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
  RH: {
    zoneName: 'High Density Residential',
    purpose:
      'High Density Residential is written for high-density multi-unit housing close to shopping, services, transportation, and public open space. The minimum density is 21.7 units per gross acre and there is no maximum. A single-unit detached dwelling is not a permitted use in this zone, so an existing house here is a lawfully established use on land the code points toward attached and multi-unit housing.',
    permittedOutright: [
      'Duplex, triplex, and quadplex',
      'Townhomes',
      'Multi-unit residential of more than four units',
      'Accessory dwelling units, up to two per lot',
      'Single-room occupancy',
      'Micro-units',
      'Residential care home and residential care facility',
      'Home business',
      'Short-term rental, subject to BDC 3.6.500',
      'Neighborhood parks',
    ],
    conditional: BEND_LOW_CONDITIONAL,
    dimensional: [
      { label: 'Minimum lot area, single-unit dwelling', value: 'Not applicable. The use is not permitted in RH' },
      { label: 'Minimum lot area, duplex', value: '1,250 sq ft. Triplex and quadplex, 2,500 sq ft' },
      { label: 'Minimum lot area, townhome', value: '1,200 sq ft average per unit' },
      { label: 'Minimum lot area, multi-unit', value: 'None' },
      { label: 'Residential density', value: '21.7 units per gross acre minimum, no maximum' },
      { label: 'Front setback', value: '10 ft, and 20 ft for a garage or carport with street access' },
      { label: 'Side and rear setback', value: '5 ft each' },
      { label: 'Maximum building height', value: '50 ft' },
    ],
    citation: BEND_COMMON_CITATION,
    url: BEND_TABLE_URL,
  },
}

// ── City of Redmond ─────────────────────────────────────────────────────────
// Redmond's Secs. 8.100 to 8.120 carry the zone NAME and nothing else. Every
// purpose string below is Sec. 8.010's adopted objectives plus that zone's own

/**
 * The zoning explainer for a resolved zone, or null when the zone is not in the
 * registry. Null is the correct answer for an unregistered zone: the section is
 * skipped rather than guessed at (CLAUDE.md §0).
 */
export function resolveZoningExplainer(
  jurisdiction: DevJurisdiction,
  rawZone: string,
  canonical: string,
  countyKey: string,
): DevZoningExplainer | null {
  let profile: ZoneProfile | undefined
  if (jurisdiction === 'City of Bend') {
    profile = BEND_ZONES[canonical]
  } else if (jurisdiction === 'City of Redmond') {
    profile = REDMOND_ZONES[canonical] ?? REDMOND_ZONES[normalizeRedmond(canonical)]
  } else {
    profile = COUNTY_ZONES[countyKey] ?? (/^EFU/.test(canonical) ? COUNTY_ZONES.EFU : undefined)
  }
  if (!profile) return null
  return { zone: rawZone, ...profile }
}

/** "R1" / "R3A" from a GIS layer become "R-1" / "R-3A". */
export function normalizeRedmond(zone: string): string {
  const m = /^R-?([1-5])(A?)$/.exec(zone)
  return m ? `R-${m[1]}${m[2]}` : zone
}
