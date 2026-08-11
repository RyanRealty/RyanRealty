/**
 * Distinct active-builder names for /builders index.
 * Bounded Active + new_construction query with toast-ok (not a full-table sweep UI).
 */

import { slugify } from '@/lib/slug'
import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type ActiveBuilderRow = {
  name: string
  slug: string
  /** Approximate active count in the sample window (not market-wide). */
  sampleCount: number
}

async function fetchActiveBuilders(): Promise<ActiveBuilderRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  // toast-ok: builders index sample — Active SFR new construction only, hard limit 500 rows
  const { data, error } = await sb
    .from('listings')
    .select('BuilderName:details->>BuilderName')
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', 'A')
    .eq('new_construction_yn', true)
    .not('details->>BuilderName', 'is', null)
    .limit(500)

  if (error) throw new Error(`[getActiveBuilders] ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const raw = (row as { BuilderName?: string | null }).BuilderName?.trim()
    if (!raw || raw.length < 2) continue
    // Skip noise
    const lower = raw.toLowerCase()
    if (lower === 'n/a' || lower === 'na' || lower === 'none' || lower === 'unknown') continue
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, sampleCount]) => ({
      name,
      slug: slugify(name),
      sampleCount,
    }))
    .filter((b) => b.sampleCount >= 1 && b.slug.length > 1)
    .sort((a, b) => b.sampleCount - a.sampleCount || a.name.localeCompare(b.name))
    .slice(0, 80)
}

const cached = makeResilientCached(
  fetchActiveBuilders,
  ['active-builders-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  [],
)

export function getActiveBuilders(): Promise<ActiveBuilderRow[]> {
  return cached()
}

/** Resolve a URL slug to a builder display name (best match from active set). */
export async function resolveBuilderNameFromSlug(slug: string): Promise<string | null> {
  const all = await getActiveBuilders()
  const hit = all.find((b) => b.slug === slug)
  if (hit) return hit.name
  // Fallback: unslugify for direct links from listing rails before cache warms
  const guess = slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return guess || null
}
