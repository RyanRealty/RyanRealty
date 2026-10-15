/**
 * Area / community facts for Sarah. Registry only — no listing scan, no
 * invented inventory counts. Per docs/DATABASE_FOR_AI_AGENTS.md §0.
 */
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { parseSarahPage, type SarahPlaceFacts } from './listing-answer'

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function getSarahPlaceFacts(pathname: string): SarahPlaceFacts | null {
  const page = parseSarahPage(pathname)
  if (page.kind === 'community' && page.communitySlug) {
    const row = getResortCommunityBySlug(page.communitySlug)
    return {
      kind: 'community',
      name: row?.label ?? titleFromSlug(page.communitySlug),
      city: row?.city ?? null,
      description: row?.description ?? null,
      character: row?.character ?? null,
      hoaAnnual: row?.hoa_annual_estimate ?? null,
    }
  }
  if (page.kind === 'neighborhood' && page.neighborhoodSlug) {
    return {
      kind: 'neighborhood',
      name: titleFromSlug(page.neighborhoodSlug),
      city: page.citySlug ? titleFromSlug(page.citySlug) : null,
      description: null,
      character: null,
      hoaAnnual: null,
    }
  }
  if (page.kind === 'city' && page.citySlug) {
    return {
      kind: 'city',
      name: titleFromSlug(page.citySlug),
      city: titleFromSlug(page.citySlug),
      description: null,
      character: null,
      hoaAnnual: null,
    }
  }
  return null
}
