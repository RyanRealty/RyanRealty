/**
 * Nested city neighborhood URLs key GIS as `{city}-{neighborhood}`.
 * Market Truth neighborhood geo_slug is often the community slug
 * (`sunriver`, `northwest-crossing`), not the prefixed GIS key.
 * Probe is identity: any mt-v1 neighborhood row, not a published figure.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('geo_slug')
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', 'neighborhood')
    .in('geo_slug', candidates)

  if (error) throw new Error(`resolveNeighborhoodMetricSlug: ${error.message}`)

  const found = new Set<string>()
  for (const raw of data ?? []) {
    const slug = (raw as { geo_slug?: unknown }).geo_slug
    if (typeof slug === 'string' && slug.length > 0) found.add(slug)
  }
  for (const slug of candidates) {
    if (found.has(slug)) return slug
  }
  return prefixed
}
