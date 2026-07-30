/**
 * City of Redmond zone profiles for the CMA zoning explainer.
 * Split out of lib/cma/zoning-explainer.ts to hold the per-file size budget.
 *
 * PRIMARY-SOURCE VERIFICATION (2026-07-30): RDC Ch. 8 Sec. 8.010 (purpose of
 * the zoning standards), Secs. 8.100 to 8.120 (zone names), Sec. 8.135 Table A
 * (uses), Sec. 8.137 (R-3A uses), Sec. 8.140 Table B (minimum standards).
 * Read verbatim at library.municode.com.
 *
 * NOTE: Redmond's Secs. 8.100 to 8.120 are heading-only in the adopted code.
 * They carry no per-zone purpose paragraph. Every `purpose` string below is
 * therefore built ONLY from Sec. 8.010's stated objectives plus that zone's own
 * Table B numbers. Nothing is inferred about legislative intent.
 *
 * The use lists are the PRINCIPAL residential and residentially-relevant uses.
 * The cited section is the governing list.
 */
import type { ZoneProfile } from '@/lib/cma/zoning-types'

const REDMOND_TABLE_URL =
  'https://library.municode.com/or/redmond/codes/code_of_ordinances?nodeId=CH8DERE_ARTIZOST_REUSZO_S8.140TABMIST'

// Table B numbers. No legislative intent is inferred.

const REDMOND_CITATION =
  'Redmond Development Code Ch. 8, Sec. 8.010 (purpose), Secs. 8.100 to 8.120 (zone names), Sec. 8.135 Table A (uses), Sec. 8.140 Table B (minimum standards)'

const REDMOND_USES = [
  'Single-family detached dwelling',
  'Duplex, triplex, quadplex, townhouse, and cottage cluster',
  'Accessory dwelling unit or accessory suite',
  'Guest house, without a kitchen',
  'Manufactured home',
  'Single-room occupancy development',
  'Residential care home',
  'Child care home',
  'Home occupation, as an accessory use',
  'Farm use and farming',
  'Livestock, subject to Sec. 8.365',
  'Park and multi-use trail',
]

const REDMOND_CONDITIONAL = [
  'Bed and breakfast',
  'Church or religious institution',
  'Private community center or community pool',
  'Child care center',
  'Planned unit development',
  'Private school',
  'Public facility or emergency management services',
  'Private utility facilities',
]

function redmondProfile(
  zoneName: string,
  opts: {
    purposeTail: string
    minLot: string
    quadLot: string
    minDensity: string
    maxSfDensity: string
    townhouseDensity: string
    interiorSide: string
    rear: string
    height: string
    frontage: string
    extraUses?: string[]
    extraConditional?: string[]
  },
): ZoneProfile {
  return {
    zoneName,
    purpose: `Redmond's zoning standards are adopted to protect the character and values of land and buildings and the economic stability of sound residential districts, and to assure that future development occurs in an orderly and relatively compact manner. ${opts.purposeTail}`,
    permittedOutright: [...REDMOND_USES, ...(opts.extraUses ?? [])],
    conditional: [...REDMOND_CONDITIONAL, ...(opts.extraConditional ?? [])],
    dimensional: [
      { label: 'Minimum lot area, single family / duplex / triplex', value: opts.minLot },
      { label: 'Minimum lot area, quadplex and cottage cluster', value: opts.quadLot },
      { label: 'Minimum lot area, townhouse', value: '1,500 sq ft' },
      { label: 'Minimum density', value: opts.minDensity },
      { label: 'Maximum density, single family', value: opts.maxSfDensity },
      { label: 'Maximum density, townhouse', value: opts.townhouseDensity },
      { label: 'Front setback', value: '10 ft, and 20 ft for an attached garage' },
      { label: 'Interior side setback', value: opts.interiorSide },
      { label: 'Rear setback', value: opts.rear },
      { label: 'Maximum building height, house / plex / ADU', value: opts.height },
      { label: 'Minimum street frontage', value: opts.frontage },
    ],
    citation: REDMOND_CITATION,
    url: REDMOND_TABLE_URL,
  }
}

const REDMOND_R12_TAIL_1 =
  'R-1 is one of Redmond\'s two largest-lot residential zones: 9,000 sq ft minimum for a single-family home, a minimum of 4 units per net acre, and a maximum of 5 units per net acre.'
const REDMOND_R12_TAIL_2 =
  'R-2 carries the same standards as R-1: 9,000 sq ft minimum for a single-family home, a minimum of 4 units per net acre, and a maximum of 5 units per net acre.'

export const REDMOND_ZONES: Record<string, ZoneProfile> = {
  'R-1': redmondProfile('Limited Residential R-1', {
    purposeTail: REDMOND_R12_TAIL_1,
    minLot: '9,000 sq ft',
    quadLot: '9,000 sq ft',
    minDensity: '4 units per net acre',
    maxSfDensity: '5 units per net acre',
    townhouseDensity: '20 units per net acre',
    interiorSide: '5 ft on one side and 10 ft on the other. Both sides drop to 5 ft where alley access is provided',
    rear: '20 ft',
    height: '32 ft',
    frontage: '50 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
  }),
  'R-2': redmondProfile('Limited Residential R-2', {
    purposeTail: REDMOND_R12_TAIL_2,
    minLot: '9,000 sq ft',
    quadLot: '9,000 sq ft',
    minDensity: '4 units per net acre',
    maxSfDensity: '5 units per net acre',
    townhouseDensity: '20 units per net acre',
    interiorSide: '5 ft on one side and 10 ft on the other. Both sides drop to 5 ft where alley access is provided',
    rear: '20 ft',
    height: '32 ft',
    frontage: '50 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
  }),
  'R-3': redmondProfile('Limited Residential R-3', {
    purposeTail:
      'R-3 sits in the middle of Redmond\'s residential range: 7,500 sq ft minimum for a single-family home, a minimum of 5 units per net acre, and a maximum of 5.8 units per net acre.',
    minLot: '7,500 sq ft',
    quadLot: '7,500 sq ft',
    minDensity: '5 units per net acre',
    maxSfDensity: '5.8 units per net acre',
    townhouseDensity: '23.2 units per net acre',
    interiorSide: '5 ft',
    rear: '20 ft',
    height: '32 ft',
    frontage: '50 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
    extraConditional: ['Boarding or rooming house', 'Multi-family complex of five or more units', 'Residential care facility'],
  }),
  'R-3A': redmondProfile('Limited Residential R-3A', {
    purposeTail:
      'R-3A runs on the R-3 standards: 7,500 sq ft minimum for a single-family home, a minimum of 5 units per net acre, and a maximum of 5.8 units per net acre. R-3A additionally permits a multi-family complex outright.',
    minLot: '7,500 sq ft',
    quadLot: '7,500 sq ft',
    minDensity: '5 units per net acre',
    maxSfDensity: '5.8 units per net acre',
    townhouseDensity: '23.2 units per net acre',
    interiorSide: '5 ft',
    rear: '20 ft',
    height: '32 ft',
    frontage: '50 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
    extraUses: ['Multi-family complex'],
    extraConditional: ['Commercial office, retail, restaurant, theater, or art gallery in a qualifying existing building'],
  }),
  'R-4': redmondProfile('General Residential R-4', {
    purposeTail:
      'R-4 is Redmond\'s general residential zone: 5,500 sq ft minimum for a single-family home, a minimum of 5 units per net acre, and a maximum of 8 units per net acre. A multi-family complex is permitted outright.',
    minLot: '5,500 sq ft',
    quadLot: '7,000 sq ft',
    minDensity: '5 units per net acre',
    maxSfDensity: '8 units per net acre',
    townhouseDensity: '25 units per net acre',
    interiorSide: '5 ft',
    rear: '15 ft',
    height: '45 ft',
    frontage: '50 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
    extraUses: ['Multi-family complex of five or more units', 'Manufactured home park', 'Boarding or rooming house'],
    extraConditional: ['Residential care facility', 'Nursing, convalescent, and assisted living facility'],
  }),
  'R-5': redmondProfile('High Density Residential R-5', {
    purposeTail:
      'R-5 is Redmond\'s highest-density residential zone: 5,500 sq ft minimum for a single-family home, a minimum of 8 units per net acre, and a maximum of 8 units per net acre for a house. A multi-family complex is permitted outright at up to 17.4 units per net acre.',
    minLot: '5,500 sq ft',
    quadLot: '7,000 sq ft',
    minDensity: '8 units per net acre',
    maxSfDensity: '8 units per net acre',
    townhouseDensity: '25 units per net acre',
    interiorSide: '5 ft',
    rear: '5 ft',
    height: '45 ft',
    frontage: '40 ft on a standard street, 30 ft on a cul-de-sac, 20 ft on a flag lot',
    extraUses: [
      'Multi-family complex of five or more units, up to 17.4 units per net acre',
      'Manufactured home park',
      'Boarding or rooming house',
      'Residential care facility',
    ],
    extraConditional: ['Nursing, convalescent, and assisted living facility'],
  }),
}

// ── Deschutes County (unincorporated) ───────────────────────────────────────

