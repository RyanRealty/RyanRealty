import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmNeighborhoodOptions — the canonical neighborhood picker options for the
 * People-list filter. Reads the geo boundaries (geo_type='neighborhood') so the
 * filter's Neighborhood dimension offers the same canonical set the geo pipeline
 * resolves crm_people.neighborhood_slug against. The filter matches the COLUMN,
 * not a tag.
 *
 * DAL boundary (G1): the raw .from('boundaries') read lives here in lib/data/.
 * Cached (neighborhoods change rarely); fails soft to [] so the filter degrades
 * to "no neighborhoods" rather than crashing the page.
 */
export type CrmNeighborhoodOption = { key: string; label: string }

/** Titlecase a slug into a picker label; drop the redundant "bend-" district prefix. */
function labelFor(slug: string): string {
  return slug
    .replace(/^bend-/, '')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

async function query(): Promise<CrmNeighborhoodOption[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('boundaries')
    .select('geo_slug')
    .eq('geo_type', 'neighborhood')
  if (error || !data) {
    if (error) console.error('[getCrmNeighborhoodOptions]', error.message)
    return []
  }
  const seen = new Set<string>()
  const out: CrmNeighborhoodOption[] = []
  for (const r of data as Array<{ geo_slug: string | null }>) {
    const slug = (r.geo_slug ?? '').trim()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ key: slug, label: labelFor(slug) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export function getCrmNeighborhoodOptions(): Promise<CrmNeighborhoodOption[]> {
  return unstable_cache(query, ['crm-neighborhood-options'], {
    revalidate: 3600,
    tags: ['crm-neighborhoods'],
  })()
}
