/**
 * Free rent estimates from HUD Fair Market Rents (FMR).
 *
 * HUD FMR is the best FREE, official rent reference: the 40th-percentile gross
 * rent by bedroom for an area, published annually by the U.S. Dept. of Housing
 * and Urban Development. It is AREA-level (county), not property-specific — a
 * conservative starting point a user edits, NOT a comp-backed appraisal.
 *
 * Source: HUD FMR — https://www.huduser.gov/portal/datasets/fmr.html (FY2025).
 * These are the published HUD FMR values for the service-area counties. To keep
 * them current automatically, set HUD_FMR_TOKEN (a FREE token from huduser.gov);
 * getCountyRents() then supersedes these with the live current-year API values.
 *
 * CLAUDE.md §0: every figure traces to HUD. The estimate is labeled with its
 * source + fiscal year + "area estimate, edit to your property" wherever shown.
 */

export type BedroomRents = readonly [studio: number, br1: number, br2: number, br3: number, br4: number]

const FMR_SOURCE_URL = 'https://www.huduser.gov/portal/datasets/fmr.html'
const FMR_FISCAL_YEAR = 2025

// FY2025 HUD FMR by county FIPS. studio / 1BR / 2BR / 3BR / 4BR.
const FMR_BY_FIPS: Record<string, { county: string; rents: BedroomRents }> = {
  '41017': { county: 'Deschutes', rents: [1285, 1318, 1667, 2336, 2799] }, // Bend-Redmond MSA
  '41013': { county: 'Crook', rents: [862, 1000, 1257, 1761, 2111] },
  '41031': { county: 'Jefferson', rents: [784, 871, 1143, 1602, 1798] },
}

// Service-area city -> county FIPS. Lowercased, trimmed.
const CITY_TO_FIPS: Record<string, string> = {
  bend: '41017',
  redmond: '41017',
  sisters: '41017',
  sunriver: '41017',
  'la pine': '41017',
  lapine: '41017',
  tumalo: '41017',
  terrebonne: '41017',
  tetherow: '41017',
  prineville: '41013',
  'powell butte': '41013',
  madras: '41031',
  culver: '41031',
  'camp sherman': '41031',
}

export function countyFipsForCity(city: string | null | undefined): string | null {
  if (!city) return null
  return CITY_TO_FIPS[city.toLowerCase().trim()] ?? null
}

export type AreaRentEstimate = {
  value: number
  low: number
  high: number
  source: 'hud-fmr'
  fiscalYear: number
  county: string
  bedrooms: number
  label: string
  sourceUrl: string
}

/**
 * Area rent estimate for a listing's city + bedroom count, from HUD FMR.
 * Returns null when the city is outside the mapped service area, or when the
 * feed states no bedroom count. Bedrooms clamp to HUD's studio..4BR bands.
 *
 * WHY AN UNSTATED BEDROOM COUNT RETURNS NULL RATHER THAN TWO (2026-08-19).
 * This function read `bedrooms ?? 2` and then labelled its answer with the
 * count it had substituted. On a row where the feed states no bedrooms that
 * printed a fabricated number under a sourced label — verified on the rendered
 * page /listing/20260403195603425451000000 (MLS 220218536, 57379 Beaver Ridge,
 * Sunriver): "Estimate $1,667 ($1,500–$1,925) · HUD Fair Market Rent (FY2025),
 * Deschutes County, 2BR", where $1,667 is exactly the Deschutes 2BR row below
 * and the feed states no bedrooms, no baths and no living area for that
 * listing. Everything downstream came off it: "Gross rent $1,667", "Cash flow
 * $1,054/mo", "Cap rate 71.2%", "Cash on cash 324.3%".
 *
 * §0 forbids an estimate without a named basis, and §0.7 decides the null case:
 * publish no figure. Population, live `listings` 2026-08-19, Active or Active
 * Under Contract, PropertyType 'A' — 4,688 rows, of which 46 state no bedroom
 * count. All 46 also state no living area, so none of them can be sized any
 * other way either.
 *
 * A stated zero is a studio and still publishes: three Powder Village Condo
 * rows in Sunriver (220212529, 220205003, 220213995) carry beds 0 over 392–448
 * sq ft, and HUD prices a studio.
 */
export function getAreaRentEstimate(
  city: string | null | undefined,
  bedrooms: number | null | undefined,
): AreaRentEstimate | null {
  const fips = countyFipsForCity(city)
  if (!fips) return null
  const entry = FMR_BY_FIPS[fips]
  if (!entry) return null
  if (typeof bedrooms !== 'number' || !Number.isFinite(bedrooms) || bedrooms < 0) return null
  const idx = Math.max(0, Math.min(4, Math.round(bedrooms)))
  const value = entry.rents[idx]
  return {
    value,
    low: Math.round((value * 0.9) / 25) * 25,
    high: Math.round((value * 1.15) / 25) * 25,
    source: 'hud-fmr',
    fiscalYear: FMR_FISCAL_YEAR,
    county: entry.county,
    bedrooms: idx,
    label: `HUD Fair Market Rent (FY${FMR_FISCAL_YEAR}), ${entry.county} County, ${idx === 0 ? 'studio' : idx + 'BR'}`,
    sourceUrl: FMR_SOURCE_URL,
  }
}
