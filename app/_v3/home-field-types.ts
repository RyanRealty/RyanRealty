/**
 * Homepage Field property types. Types that exist in the listed set become
 * the multi-select. Cats 0–4 are the navy alphas on the map pins.
 *
 * Homepage only. City / hood / plat Fields are another agent's surface.
 */

export type HomeFieldTypeKey =
  | 'house'
  | 'condo'
  | 'townhouse'
  | 'manufactured'
  | 'multi'
  | 'land'
  | 'commercial'
  | 'other'

export type HomeFieldCat = 0 | 1 | 2 | 3 | 4

export type HomeFieldTypeChip = {
  key: HomeFieldTypeKey
  label: string
  cat: HomeFieldCat
}

export const HOME_FIELD_TYPE_ORDER: readonly {
  key: HomeFieldTypeKey
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

export function classifyHomeFieldType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { key: HomeFieldTypeKey; label: string } {
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

export function typesInHomeField(
  items: readonly { typeKey: HomeFieldTypeKey }[],
): HomeFieldTypeChip[] {
  const present = new Set(items.map((item) => item.typeKey))
  return HOME_FIELD_TYPE_ORDER.filter((type) => present.has(type.key)).map(
    (type, index) => ({
      ...type,
      cat: (index % 5) as HomeFieldCat,
    }),
  )
}

export function withHomeFieldCats<T extends { typeKey: HomeFieldTypeKey }>(
  items: readonly T[],
  types: readonly HomeFieldTypeChip[] = typesInHomeField(items),
): Array<T & { cat: HomeFieldCat }> {
  const catByKey = new Map(types.map((type) => [type.key, type.cat]))
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

/** Empty selection means every type in the set. */
export function filterHomeFieldByTypes<T extends { typeKey: string }>(
  items: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...items]
  const want = new Set(selected)
  return items.filter((item) => want.has(item.typeKey))
}

export function visibleHomeField<T extends { typeKey: string }>(
  items: readonly T[],
  selected: readonly string[],
  limit: number,
): T[] {
  return filterHomeFieldByTypes(items, selected).slice(0, limit)
}

export function toggleHomeFieldType(
  selected: readonly string[],
  key: string,
): string[] {
  return selected.includes(key)
    ? selected.filter((item) => item !== key)
    : [...selected, key]
}

/**
 * One pass per type so a 3,000-row SFR-heavy feed cannot fill the preview
 * before a condo or a lot appears. Types that do not exist never get a chip.
 */
export function takeHomeFieldByType<T extends { typeKey: HomeFieldTypeKey }>(
  items: readonly T[],
  limit: number,
): Array<T & { cat: HomeFieldCat }> {
  const types = typesInHomeField(items)
  if (types.length === 0 || limit <= 0) return []

  const buckets = new Map<HomeFieldTypeKey, T[]>()
  for (const type of types) buckets.set(type.key, [])
  for (const item of items) {
    const bucket = buckets.get(item.typeKey)
    if (bucket) bucket.push(item)
  }

  const out: T[] = []
  let depth = 0
  while (out.length < limit) {
    let added = false
    for (const type of types) {
      const next = buckets.get(type.key)?.[depth]
      if (!next) continue
      out.push(next)
      added = true
      if (out.length >= limit) break
    }
    if (!added) break
    depth += 1
  }
  return withHomeFieldCats(out, types)
}
