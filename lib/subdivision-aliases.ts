import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'

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
 *
 * REGISTRY-FIRST (2026-09-01). The hand map above predates the resort registry
 * and silently diverged from it — the founding case is Black Butte Ranch: this
 * map expanded it to two names matching 3 listings while the community page's
 * face counted 33 through the registry's full `subdivision_aliases`, so the
 * same page printed 33 in the hero and 3 in the map. One curated alias truth
 * exists (data/resort-communities.json); consult it first and keep the hand
 * map only as a supplement for names the registry does not carry.
 */
export function getSubdivisionMatchNames(canonicalName: string): string[] {
  const trimmed = (canonicalName ?? '').trim()
  if (!trimmed) return []
  const names = new Set<string>([trimmed])
  const registryEntry = getResortCommunityBySubdivisionName(trimmed)
  if (registryEntry) {
    names.add(registryEntry.label.trim())
    for (const alias of registryEntry.subdivision_aliases ?? []) {
      const a = alias.trim()
      if (a) names.add(a)
    }
    for (const former of registryEntry.former_labels ?? []) {
      const f = former.trim()
      if (f) names.add(f)
    }
  }
  for (const alias of SUBDIVISION_ALIASES[trimmed] ?? []) {
    const a = alias.trim()
    if (a) names.add(a)
  }
  return [...names]
}
