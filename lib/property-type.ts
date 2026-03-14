/**
 * Canonical property type labels and report segments.
 * Use everywhere (search, listing badges, reports) for consistent labeling.
 */

/** Options for search/filter dropdowns (listings, saved searches). */
export const PROPERTY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Land', label: 'Land' },
  { value: 'Rental', label: 'Rental' },
] as const

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
