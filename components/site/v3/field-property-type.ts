/**
 * Field property types. Types that exist in the listed set become the
 * multi-select. Cats 0–4 are the navy alphas on the map pins (`--v3-cat-N`).
 *
 * Same vocabulary the homepage Field uses (house | condo | townhouse | …)
 * so a pin color means the same thing on every grain. Classification is
 * local to this file so place pages do not import homepage modules.
 */

export type FieldTypeKey =
  | 'house'
  | 'condo'
  | 'townhouse'
  | 'manufactured'
  | 'multi'
  | 'land'
  | 'commercial'
  | 'other'

export type FieldCat = 0 | 1 | 2 | 3 | 4

export type FieldTypeChip = {
  key: FieldTypeKey
  label: string
  cat: FieldCat
}

export const FIELD_TYPE_ORDER: readonly {
  key: FieldTypeKey
  label: string
}[] = [
  { key: 'house', label: 'House' },
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhouse' },
  { key: 'manufactured', label: 'Manufactured' },
  { key: 'multi', label: 'Multi-family' },
  { key: 'land', label: 'Land' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'other', label: 'Other' },
]

export function classifyFieldType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { key: FieldTypeKey; label: string } {
  const sub = (input.propertySubType ?? '').trim()
  const cls = (input.propertyType ?? '').trim().toUpperCase()

  switch (sub) {
    case 'Single Family Residence':
    case 'Tenancy in Common':
    case 'Residential Leased Land':
    case 'Stock Cooperative':
    case 'Timeshare':
      return { key: 'house', label: 'House' }
    case 'Condominium':
      return { key: 'condo', label: 'Condo' }
    case 'Townhouse':
      return { key: 'townhouse', label: 'Townhouse' }
    case 'Manufactured On Land':
    case 'In Park':
    case 'On Leased Land':
      return { key: 'manufactured', label: 'Manufactured' }
    case 'Duplex':
    case 'Triplex':
    case 'Quadruplex':
    case 'Multi Family':
      return { key: 'multi', label: 'Multi-family' }
    case 'Residential Lots':
    case 'Recreational':
    case 'Agriculture':
    case 'Rangeland':
    case 'Investment':
    case 'Industrial':
      return { key: 'land', label: 'Land' }
    default:
      break
  }

  if (cls === 'D' || cls === 'E') return { key: 'land', label: 'Land' }
  if (cls === 'C') return { key: 'multi', label: 'Multi-family' }
  if (cls === 'B') return { key: 'manufactured', label: 'Manufactured' }
  if (cls === 'F' || cls === 'G' || cls === 'H') {
    return { key: 'commercial', label: 'Commercial' }
  }
  return { key: 'house', label: 'House' }
}

export function typesInField(
  items: readonly { typeKey?: string | null }[],
): FieldTypeChip[] {
  const present = new Set(
    items
      .map((item) => item.typeKey)
      .filter((key): key is FieldTypeKey =>
        FIELD_TYPE_ORDER.some((type) => type.key === key),
      ),
  )
  return FIELD_TYPE_ORDER.filter((type) => present.has(type.key)).map(
    (type, index) => ({
      ...type,
      cat: (index % 5) as FieldCat,
    }),
  )
}

export function withFieldCats<T extends { typeKey: FieldTypeKey }>(
  items: readonly T[],
  types: readonly FieldTypeChip[] = typesInField(items),
): Array<T & { cat: FieldCat }> {
  const catByKey = new Map(types.map((type) => [type.key, type.cat]))
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

/** Empty selection means every type in the set. */
export function filterFieldByTypes<T extends { typeKey?: string }>(
  items: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...items]
  const want = new Set(selected)
  return items.filter((item) => item.typeKey != null && want.has(item.typeKey))
}

export function toggleFieldType(selected: readonly string[], key: string): string[] {
  return selected.includes(key)
    ? selected.filter((item) => item !== key)
    : [...selected, key]
}
