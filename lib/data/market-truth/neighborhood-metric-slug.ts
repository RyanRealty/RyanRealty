/**
 * Nested city neighborhood URLs key GIS as `{city}-{neighborhood}`.
 * Market Truth neighborhood geo_slug is often the community slug
 * (`sunriver`, `northwest-crossing`), not the prefixed GIS key.
 * Probe is identity: any mt-v1 neighborhood row, not a published figure.
 */
import { cache } from 'react'
import { createServiceClient } from '@/lib/data/client'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { dedupeInflight } from '@/lib/data/cache/inflight'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function probeNeighborhoodSlug(slug: string): Promise<boolean> {
  const sb = createServiceClient()
  // One row is enough to prove the slug exists. An unbounded geo_slug IN-list
  // on sunriver matched 21,699 history rows (1.1s mean / 16s max on 2026-10-14).
  const { data, error } = await sb
    .from('market_metric')
    .select('geo_slug')
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', 'neighborhood')
    .eq('geo_slug', slug)
    .limit(1)
  if (error) throw new Error(`resolveNeighborhoodMetricSlug: ${error.message}`)
  return Array.isArray(data) && data.length > 0
}

const probeNeighborhoodSlugCached = unstable_cache(
  probeNeighborhoodSlug,
  ['market-metric-nbh-slug-v1'],
  { revalidate: CACHE_WINDOWS.marketMetric, tags: [cacheTag.market] },
)

const probeNeighborhoodSlugDeduped = cache((slug: string) =>
  dedupeInflight(`market-metric-nbh-slug:${slug}`, () => probeNeighborhoodSlugCached(slug)),
)

export async function resolveNeighborhoodMetricSlug(input: {
  citySlug: string
  neighborhoodSlug: string
}): Promise<string> {
  const neighborhood = hyphenSlug(input.neighborhoodSlug)
  const city = hyphenSlug(input.citySlug)
  const prefixed = [city, neighborhood].filter(Boolean).join('-')
  const candidates: string[] = []
  if (neighborhood) candidates.push(neighborhood)
  if (prefixed && prefixed !== neighborhood) candidates.push(prefixed)
  if (candidates.length === 0) return prefixed

  for (const slug of candidates) {
    if (await probeNeighborhoodSlugDeduped(slug)) return slug
  }
  return prefixed
}
