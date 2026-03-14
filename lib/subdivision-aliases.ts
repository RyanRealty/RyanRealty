/**
 * MLS SubdivisionName can differ from our canonical community name (e.g. "Pronghorn Resort" vs "Pronghorn").
 * This map lists alternate names so counts and filters match. Key = canonical (display) name; value = names to match in DB.
 */
const SUBDIVISION_ALIASES: Record<string, string[]> = {
  Pronghorn: ['Pronghorn', 'Pronghorn Resort', 'Pronghorn Golf Club'],
  Sunriver: ['Sunriver', 'Sunriver Resort'],
  'Black Butte Ranch': ['Black Butte Ranch', 'Black Butte'],
  'Eagle Crest Resort': ['Eagle Crest Resort', 'Eagle Crest'],
  'Brasada Ranch': ['Brasada Ranch', 'Brasada'],
  Tetherow: ['Tetherow', 'Tetherow Resort'],
  Crosswater: ['Crosswater', 'Crosswater at Sunriver'],
  'Caldera Springs': ['Caldera Springs', 'Caldera Springs at Sunriver'],
  'Broken Top': ['Broken Top', 'Broken Top Club'],
  'Seventh Mountain': ['Seventh Mountain', 'Seventh Mountain Resort'],
  'Mt. Bachelor Village': ['Mt. Bachelor Village', 'Mt Bachelor Village', 'Mount Bachelor Village'],
  Petrosa: ['Petrosa', 'Petrosa Estates', 'Petrosa at Bend'],
}

/**
 * Return possible SubdivisionName values to match in listings for a given canonical subdivision name.
 * Includes the name itself so single-name subdivisions still work.
 */
export function getSubdivisionMatchNames(canonicalName: string): string[] {
  const trimmed = (canonicalName ?? '').trim()
  if (!trimmed) return []
  const aliases = SUBDIVISION_ALIASES[trimmed]
  if (aliases && aliases.length > 0) return [...aliases]
  return [trimmed]
}
