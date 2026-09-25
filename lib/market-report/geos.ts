/**
 * The markets a monthly edition covers, in the order it prints them.
 *
 * Geography keys match market_report_series (geo_type, geo_slug). Cities are
 * MLS city text (Market Truth D5), the same population the website's city
 * pages publish. Neighborhood districts and resort communities are primary
 * membership: a home inside a named community counts in that community, not
 * in the district around it. Quadrants are defined in the migration
 * (address NW/NE/SE/SW, else the district's quadrant, else rural Bend).
 *
 * Cadence follows the sample floor, not taste: a median needs 10 sales, so a
 * market that rarely clears 10 in a month is read by quarter, the way the
 * region's appraisal reports read the smaller towns.
 */

export type ReportGeoType = 'region' | 'city' | 'neighborhood' | 'quadrant'

export type ReportGeo = {
  type: ReportGeoType
  slug: string
  label: string
}

export const REGION: ReportGeo = { type: 'region', slug: 'central-oregon', label: 'Central Oregon' }

/** Full monthly sections. */
export const MONTHLY_CITIES: readonly ReportGeo[] = [
  { type: 'city', slug: 'bend', label: 'Bend' },
  { type: 'city', slug: 'redmond', label: 'Redmond' },
]

/** Towns read by quarter, each with its own section. */
export const QUARTERLY_TOWNS: readonly ReportGeo[] = [
  { type: 'city', slug: 'sisters', label: 'Sisters' },
  { type: 'city', slug: 'sunriver', label: 'Sunriver' },
  { type: 'city', slug: 'la-pine', label: 'La Pine' },
  { type: 'city', slug: 'prineville', label: 'Prineville' },
  { type: 'city', slug: 'madras', label: 'Madras' },
  { type: 'city', slug: 'terrebonne', label: 'Terrebonne' },
  { type: 'city', slug: 'culver', label: 'Culver' },
  { type: 'city', slug: 'powell-butte', label: 'Powell Butte' },
  { type: 'city', slug: 'camp-sherman', label: 'Camp Sherman' },
]

export const BEND_QUADRANTS: readonly ReportGeo[] = [
  { type: 'quadrant', slug: 'bend-nw', label: 'Northwest Bend' },
  { type: 'quadrant', slug: 'bend-ne', label: 'Northeast Bend' },
  { type: 'quadrant', slug: 'bend-se', label: 'Southeast Bend' },
  { type: 'quadrant', slug: 'bend-sw', label: 'Southwest Bend' },
  { type: 'quadrant', slug: 'bend-outside', label: 'Rural Bend' },
]

/** The City of Bend's neighborhood districts, grouped by the quadrant each maps to. */
export const BEND_DISTRICTS: readonly (ReportGeo & { quadrant: string })[] = [
  { type: 'neighborhood', slug: 'bend-awbrey-butte', label: 'Awbrey Butte', quadrant: 'bend-nw' },
  { type: 'neighborhood', slug: 'bend-summit-west', label: 'Summit West', quadrant: 'bend-nw' },
  { type: 'neighborhood', slug: 'bend-river-west', label: 'River West', quadrant: 'bend-nw' },
  { type: 'neighborhood', slug: 'bend-old-bend', label: 'Old Bend', quadrant: 'bend-nw' },
  { type: 'neighborhood', slug: 'bend-boyd-acres', label: 'Boyd Acres', quadrant: 'bend-ne' },
  { type: 'neighborhood', slug: 'bend-mountain-view', label: 'Mountain View', quadrant: 'bend-ne' },
  { type: 'neighborhood', slug: 'bend-orchard-district', label: 'Orchard District', quadrant: 'bend-ne' },
  { type: 'neighborhood', slug: 'bend-old-farm-district', label: 'Old Farm District', quadrant: 'bend-se' },
  { type: 'neighborhood', slug: 'bend-larkspur', label: 'Larkspur', quadrant: 'bend-se' },
  { type: 'neighborhood', slug: 'bend-southeast-bend', label: 'Southeast Bend', quadrant: 'bend-se' },
  { type: 'neighborhood', slug: 'bend-southwest-bend', label: 'Southwest Bend', quadrant: 'bend-sw' },
  { type: 'neighborhood', slug: 'bend-century-west', label: 'Century West', quadrant: 'bend-sw' },
  { type: 'neighborhood', slug: 'bend-southern-crossing', label: 'Southern Crossing', quadrant: 'bend-sw' },
]

/**
 * Resort and master-planned communities. Sunriver is read as a town above
 * (its MLS city and its community boundary hold the same homes), so it is not
 * repeated here. Labels follow data/resort-communities.json.
 */
export const COMMUNITIES: readonly (ReportGeo & { near: string })[] = [
  { type: 'neighborhood', slug: 'tetherow', label: 'Tetherow', near: 'Bend' },
  { type: 'neighborhood', slug: 'broken-top', label: 'Broken Top', near: 'Bend' },
  { type: 'neighborhood', slug: 'awbrey-glen', label: 'Awbrey Glen', near: 'Bend' },
  { type: 'neighborhood', slug: 'northwest-crossing', label: 'NorthWest Crossing', near: 'Bend' },
  { type: 'neighborhood', slug: 'widgi-creek', label: 'Widgi Creek', near: 'Bend' },
  { type: 'neighborhood', slug: 'pronghorn', label: 'Juniper Preserve', near: 'Bend' },
  { type: 'neighborhood', slug: 'vandevert-ranch', label: 'Vandevert Ranch', near: 'Bend' },
  { type: 'neighborhood', slug: 'three-rivers', label: 'Three Rivers', near: 'Bend' },
  { type: 'neighborhood', slug: 'caldera-springs', label: 'Caldera Springs', near: 'Sunriver' },
  { type: 'neighborhood', slug: 'crosswater', label: 'Crosswater', near: 'Sunriver' },
  { type: 'neighborhood', slug: 'eagle-crest', label: 'Eagle Crest', near: 'Redmond' },
  { type: 'neighborhood', slug: 'brasada-ranch', label: 'Brasada Ranch', near: 'Powell Butte' },
  { type: 'neighborhood', slug: 'black-butte-ranch', label: 'Black Butte Ranch', near: 'Sisters' },
]

export function geoKey(g: Pick<ReportGeo, 'type' | 'slug'>): string {
  return `${g.type}:${g.slug}`
}

/** Every geography an edition reads, for the series fetch. */
export function allEditionGeos(): ReportGeo[] {
  return [REGION, ...MONTHLY_CITIES, ...QUARTERLY_TOWNS, ...BEND_QUADRANTS, ...BEND_DISTRICTS, ...COMMUNITIES]
}
