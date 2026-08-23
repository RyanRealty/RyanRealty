/**
 * Canonical property type labels and report segments.
 * Use everywhere (search, listing badges, reports) for consistent labeling.
 */

/**
 * Primary Home-type chip options (class layer).
 *
 * Values are what we put in `?propertyType=` — mapped to MLS letter codes by
 * `propertyTypeFilterToCodes`. Prefer single-class codes (A/B/multi-family/Land)
 * so buyers can separate duplexes and manufactured parks from SFR without
 * opening All filters. Legacy `Residential` (A+B+C) still resolves for old URLs.
 */
export const PROPERTY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'A', label: 'Residential' },
  { value: 'multi-family', label: 'Multi-family' },
  { value: 'B', label: 'Manufactured' },
  { value: 'Land', label: 'Land' },
  { value: 'Commercial', label: 'Commercial' },
] as const

/**
 * Map a search property-type filter VALUE to the MLS PropertyType CODES stored in
 * `listing_tile_mv.property_type` / `listings.PropertyType` (single letters A-H).
 *
 * The search UI offers human labels but the feed stores codes, so a naive
 * `.eq('property_type', 'Residential')` matched NOTHING and silently emptied
 * filtered searches. Verified against the live MV (2026-06-08):
 *   A = residential dwellings (SFR, condo, townhouse, manufactured-on-land, …)
 *   B = manufactured in park / leased land
 *   C = multi-family / income (duplex / tri / quad / multi family)
 *   D = land/lots
 *   E–H = commercial + other
 *
 * Returns the codes to constrain by, or null when the value should NOT filter
 * (empty / "all" / an unmapped value — never silently zero the results).
 */
export function propertyTypeFilterToCodes(value: string | null | undefined): string[] | null {
  const v = (value ?? '').trim().toLowerCase()
  if (!v || v === 'all') return null
  if (/^[a-h]$/.test(v)) return [v.toUpperCase()] // already a raw code
  // Legacy bucket (pre two-layer Home type): dwellings + income + park MH.
  if (v === 'residential') return ['A', 'B', 'C']
  if (v === 'land' || v === 'lots' || v === 'acreage') return ['D']
  if (v === 'farm' || v === 'ranch') return ['E']
  if (v === 'commercial') return ['F']
  if (v === 'lease' || v === 'commercial lease') return ['G']
  if (v === 'business') return ['H']
  // Multi-family / income (duplex/tri/quad) — code C. Powers the multi-family
  // search preset (lib/search-presets.ts) and the primary Home-type chip.
  if (v === 'multi-family' || v === 'multifamily' || v === 'multi family' || v === 'income') {
    return ['C']
  }
  if (v === 'manufactured' || v === 'mobile') return ['B']
  return null
}

/**
 * Buyer-facing labels for exact MLS PropertySubType feed strings.
 * Registry / DAL keep the feed strings; UI never shows "In Park" raw.
 */
export const SUBTYPE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  'Single Family Residence': 'Single-family home',
  'Manufactured On Land': 'Manufactured on land',
  Townhouse: 'Townhouse',
  Condominium: 'Condo',
  'Tenancy in Common': 'Tenancy in common',
  'Residential Leased Land': 'Home on leased land',
  'Stock Cooperative': 'Co-op',
  Timeshare: 'Timeshare',
  'In Park': 'Manufactured in park',
  'On Leased Land': 'Manufactured on leased land',
  Duplex: 'Duplex',
  'Multi Family': 'Multi-family (5+ units)',
  Quadruplex: 'Fourplex',
  Triplex: 'Triplex',
  'Residential Lots': 'Residential lots',
  Commercial: 'Commercial land',
  Recreational: 'Recreational land',
  Agriculture: 'Agriculture',
  Industrial: 'Industrial land',
  Rangeland: 'Rangeland',
  Investment: 'Investment land',
}

/** Readable label for a feed PropertySubType, or the raw string if unmapped. */
export function propertySubTypeDisplayLabel(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  return SUBTYPE_DISPLAY_LABELS[v] ?? v
}

/** MLS PropertyType class codes that carry enumerated sub types. */
export type PropertySubTypeClass = 'A' | 'B' | 'C' | 'D'

/**
 * Every live PropertySubType value -> its one MLS PropertyType class code.
 * Measured from listing_search_mv (all 9,648 on-market rows, 2026-07-30):
 * 21 distinct values, each observed under exactly one class. Pure data for
 * the class-aware sub-type UI (plan §4.5.3): picking 'Duplex' auto-narrows
 * the class filter to C; picking across classes widens to both. Keys match
 * the propertySubTypes registry field options 1:1 (tested).
 */
export const SUBTYPE_TO_CLASS: Readonly<Record<string, PropertySubTypeClass>> = {
  // Class A — residential
  'Single Family Residence': 'A',
  'Manufactured On Land': 'A',
  Townhouse: 'A',
  Condominium: 'A',
  'Tenancy in Common': 'A',
  'Residential Leased Land': 'A',
  'Stock Cooperative': 'A',
  Timeshare: 'A',
  // Class B — manufactured
  'In Park': 'B',
  'On Leased Land': 'B',
  // Class C — multi-family / income
  Duplex: 'C',
  'Multi Family': 'C',
  Quadruplex: 'C',
  Triplex: 'C',
  // Class D — land
  'Residential Lots': 'D',
  Commercial: 'D',
  Recreational: 'D',
  Agriculture: 'D',
  Industrial: 'D',
  Rangeland: 'D',
  Investment: 'D',
}

/** Report segment key matching backend include flags (SFR, condo/town, manufactured, acreage). */
export type ReportPropertyTypeSegmentKey =
  | 'residential'
  | 'condo_town'
  | 'manufactured'
  | 'acreage'

export type ReportSegmentFilters = {
  includeCondoTown: boolean
  includeManufactured: boolean
  includeAcreage: boolean
}

/** Segments for "break out by property type" in reports. Labels match site badges. */
export const REPORT_PROPERTY_TYPE_SEGMENTS: Array<{
  key: ReportPropertyTypeSegmentKey
  label: string
  filters: ReportSegmentFilters
}> = [
  { key: 'residential', label: 'Residential', filters: { includeCondoTown: false, includeManufactured: false, includeAcreage: false } },
  { key: 'condo_town', label: 'Condo & Townhouse', filters: { includeCondoTown: true, includeManufactured: false, includeAcreage: false } },
  { key: 'manufactured', label: 'Manufactured', filters: { includeCondoTown: false, includeManufactured: true, includeAcreage: false } },
  { key: 'acreage', label: 'Acreage / Land', filters: { includeCondoTown: false, includeManufactured: false, includeAcreage: true } },
]

/** Filter options for report "property type" single filter (same labels as segments). */
export const REPORT_PROPERTY_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All property types' },
  ...REPORT_PROPERTY_TYPE_SEGMENTS.map((s) => ({ value: s.key, label: s.label })),
]

/**
 * Normalize raw PropertyType from DB to a display label (for badges, details, reports).
 * Handles common MLS values and maps to our canonical labels.
 */
export function getPropertyTypeLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Property'
  const lower = raw.trim().toLowerCase()
  if (lower.includes('condo') || lower.includes('townhouse') || lower.includes('town home')) return 'Condo & Townhouse'
  if (lower.includes('manufactured') || lower.includes('mobile')) return 'Manufactured'
  if (lower.includes('acreage') || lower.includes('land') || lower === 'acreage') return 'Acreage / Land'
  if (lower.includes('residential') || lower.includes('single') || lower.includes('family')) return 'Residential'
  if (lower === 'e' || lower.includes('farm')) return 'Farm'
  if (lower === 'g' || lower.includes('lease')) return 'Commercial lease'
  if (lower.includes('commercial')) return 'Commercial'
  if (lower.includes('rental')) return 'Rental'
  // Return title-case of first 30 chars for unknown values
  return raw.trim().length > 30 ? raw.trim().slice(0, 27) + '…' : raw.trim()
}

/**
 * Map raw PropertyType to report segment key (for grouping pending/closed in market reports).
 */
export function getPropertyTypeSegmentKey(raw: string | null | undefined): ReportPropertyTypeSegmentKey | null {
  if (!raw?.trim()) return 'residential'
  const lower = raw.trim().toLowerCase()
  if (lower.includes('condo') || lower.includes('town')) return 'condo_town'
  if (lower.includes('manufactured') || lower.includes('mobile')) return 'manufactured'
  if (lower.includes('acreage') || lower.includes('land')) return 'acreage'
  return 'residential'
}
