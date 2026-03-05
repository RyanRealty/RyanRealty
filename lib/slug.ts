/**
 * Normalize display names to URL- and storage-safe keys.
 * Used for banner entity_key and storage paths so web and mobile share the same URLs.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

/** Entity key for a city (e.g. "Bend" -> "bend"). */
export function cityEntityKey(city: string): string {
  return slugify(city)
}

/** Entity key for a subdivision (e.g. city "Bend", subdivision "Sunriver" -> "bend:sunriver"). */
export function subdivisionEntityKey(city: string, subdivision: string): string {
  return `${slugify(city)}:${slugify(subdivision)}`
}
