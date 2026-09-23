/**
 * One entity per broker across the site's JSON-LD (AEO-6, visibility audit
 * 2026-09-22).
 *
 * components/JsonLd.tsx emits every broker as the Organization's founder or
 * employee under `${site}/team/<slug>#person`. /team/<slug> emitted its own
 * RealEstateAgent node with NO @id and no sameAs, so an engine reading the
 * broker's own page saw a second, unlinked person. Both now take the id and
 * the verified profiles from here, so the two nodes merge into one entity.
 */
import { teamPath } from '@/lib/slug'
import { BROKER_SAME_AS } from '@/lib/brand/contact'

export function brokerPersonId(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, '')}${teamPath(slug)}#person`
}

/** Third-party profiles verified to be this broker (lib/brand/contact.ts BROKER_SAME_AS). */
export function brokerSameAs(slug: string): string[] {
  return [...(BROKER_SAME_AS[slug] ?? [])]
}
