/**
 * Field property-type language. One taxonomy for the inventory toggle and
 * the typed navy pins. Callers attach `typeKey` / `typeLabel` to a V3FieldItem;
 * V3Field derives chips from the set that is actually present and PlaceFieldMap
 * paints pins from the same keys.
 *
 * Labels come from lib/property-type.ts (SUBTYPE_DISPLAY_LABELS / class codes).
 * V3PlacePropertyTypes is Instrument — market figures per type — and is not
 * this filter.
 */
import {
  propertySubTypeDisplayLabel,
  propertyTypeFilterToCodes,
  SUBTYPE_TO_CLASS,
} from '@/lib/property-type'

export const FIELD_PROPERTY_TYPE_KEYS = [
  'single-family',
  'condo',
  'townhouse',
  'manufactured',
  'land',
  'multi-family',
  'commercial',
] as const

export type FieldPropertyTypeKey = (typeof FIELD_PROPERTY_TYPE_KEYS)[number]

export type FieldPropertyType = {
  key: FieldPropertyTypeKey
  label: string
}

export type FieldPropertyTypeCat = 0 | 1 | 2 | 3 | 4

const LABEL: Record<FieldPropertyTypeKey, string> = {
  'single-family': 'Single-family',
  condo: 'Condo',
  townhouse: 'Townhouse',
  manufactured: 'Manufactured',
  land: 'Land',
  'multi-family': 'Multi-family',
  commercial: 'Commercial',
}

const SUBTYPE_KEY: Record<string, FieldPropertyTypeKey> = {
  'Single Family Residence': 'single-family',
  Condominium: 'condo',
  Townhouse: 'townhouse',
  'Manufactured On Land': 'manufactured',
  'In Park': 'manufactured',
  'On Leased Land': 'manufactured',
  'Residential Leased Land': 'single-family',
  'Tenancy in Common': 'single-family',
  'Stock Cooperative': 'single-family',
  Timeshare: 'single-family',
  Duplex: 'multi-family',
  'Multi Family': 'multi-family',
  Quadruplex: 'multi-family',
  Triplex: 'multi-family',
  'Residential Lots': 'land',
  Commercial: 'land',
  Recreational: 'land',
  Agriculture: 'land',
  Industrial: 'land',
  Rangeland: 'land',
  Investment: 'land',
}

/**
 * Classify one listing for the Field toggle. Null when the feed carried no
 * type we can name — the home still lists, it just does not earn a chip.
 */
export function fieldPropertyType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): FieldPropertyType | null {
  const sub = (input.propertySubType ?? '').trim()
  if (sub) {
    const fromSub = SUBTYPE_KEY[sub]
    if (fromSub) return { key: fromSub, label: LABEL[fromSub] }
    const cls = SUBTYPE_TO_CLASS[sub]
    if (cls === 'B') return { key: 'manufactured', label: LABEL.manufactured }
    if (cls === 'C') return { key: 'multi-family', label: LABEL['multi-family'] }
    if (cls === 'D') return { key: 'land', label: LABEL.land }
    const named = propertySubTypeDisplayLabel(sub)
    if (named.toLowerCase().includes('condo')) return { key: 'condo', label: LABEL.condo }
    if (named.toLowerCase().includes('town')) return { key: 'townhouse', label: LABEL.townhouse }
  }

  const codes = propertyTypeFilterToCodes(input.propertyType)
  if (codes?.includes('D')) return { key: 'land', label: LABEL.land }
  if (codes?.includes('B')) return { key: 'manufactured', label: LABEL.manufactured }
  if (codes?.includes('C')) return { key: 'multi-family', label: LABEL['multi-family'] }
  if (codes?.some((c) => c === 'F' || c === 'G' || c === 'H')) {
    return { key: 'commercial', label: LABEL.commercial }
  }
  if (codes?.includes('E')) return { key: 'land', label: LABEL.land }
  if (codes?.includes('A')) return { key: 'single-family', label: LABEL['single-family'] }
  return null
}

/** Types present in this Field set, in canonical order. Absence is the point. */
export function presentFieldTypes(
  items: ReadonlyArray<{ typeKey?: string | null; typeLabel?: string | null }>,
): FieldPropertyType[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const key = item.typeKey?.trim()
    if (!key) continue
    if (!seen.has(key)) seen.set(key, item.typeLabel?.trim() || key)
  }
  const known = FIELD_PROPERTY_TYPE_KEYS.filter((key) => seen.has(key)).map((key) => ({
    key,
    label: LABEL[key],
  }))
  const extras = [...seen.entries()]
    .filter(([key]) => !FIELD_PROPERTY_TYPE_KEYS.includes(key as FieldPropertyTypeKey))
    .map(([key, label]) => ({ key: key as FieldPropertyTypeKey, label }))
  return [...known, ...extras]
}

/**
 * Cat slot for a type among those present. Order is canonical, then wrap
 * through --v3-cat-0..4 so a fifth type still reads as navy, not a new hue.
 */
export function fieldPropertyTypeCat(
  key: string,
  present: readonly FieldPropertyType[],
): FieldPropertyTypeCat {
  const i = present.findIndex((type) => type.key === key)
  return ((i < 0 ? 0 : i) % 5) as FieldPropertyTypeCat
}

/** Empty selection means the whole set. Selecting one or more keys narrows it. */
export function filterFieldItems<T extends { typeKey?: string | null }>(
  items: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...items]
  const want = new Set(selected)
  return items.filter((item) => item.typeKey != null && want.has(item.typeKey))
}
