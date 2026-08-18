/**
 * MLS SubdivisionName can differ from our canonical community name (e.g. "Pronghorn Resort" vs "Pronghorn").
 * This map lists alternate names so counts and filters match. Key = canonical (display) name; value = names to match in DB.
 * Registry `subdivision_aliases` merge in so Crooked River Ranch search/listings include Crr*.
 */
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { slugify } from '@/lib/slug'

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

type RegistryRow = {
  slug: string
  label: string
  subdivision_aliases?: string[]
}

function registryAliasesForName(name: string): string[] {
  const needle = name.trim().toLowerCase()
  const slug = slugify(name)
  const entry = (resortRegistry.communities as RegistryRow[]).find(
    (row) => row.label.toLowerCase() === needle || row.slug === slug,
  )
  return entry?.subdivision_aliases ?? []
}

function hardcodedAliasesForName(name: string): string[] {
  const needle = name.trim().toLowerCase()
  const hit = Object.entries(SUBDIVISION_ALIASES).find(([key]) => key.toLowerCase() === needle)
  return hit?.[1] ?? []
}

/**
 * Return possible SubdivisionName values to match in listings for a given canonical subdivision name.
 * Includes the name itself so single-name subdivisions still work.
 */
export function getSubdivisionMatchNames(canonicalName: string): string[] {
  const trimmed = (canonicalName ?? '').trim()
  if (!trimmed) return []
  const out: string[] = [trimmed]
  for (const alias of [...hardcodedAliasesForName(trimmed), ...registryAliasesForName(trimmed)]) {
    if (!out.some((existing) => existing.toLowerCase() === alias.toLowerCase())) out.push(alias)
  }
  return out
}
