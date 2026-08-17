/**
 * Live figures a registry resort may print on an index tile, homepage card,
 * newsletter pill, or community metadata.
 *
 * A resort's homes are MLS-tagged under many SubdivisionName values. The
 * literal-name index entity key undercounts every one of them. The community
 * page already prints the alias-aware set (`resortActiveSfrCounts` +
 * `resortTilesForSlug`).
 *
 * Founding case: homepage Tetherow tile 12 ACTIVE vs /communities/tetherow
 * 35 homes for sale (fleet a7a6038f1d78857572e7e2199cf399bf).
 *
 * Snapshot, pulse, and literal-name counts are other sets. Do not pass them
 * in. Withhold the median when the count is 0 (no ask to publish).
 */

import { slugify } from '@/lib/slug'

export type PublishedResortIndexFigures = {
  activeCount: number | null
  medianListPrice: number | null
}

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

function asPositiveMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishResortIndexFigures(input: {
  aliasAwareCount: number | null | undefined
  aliasAwareMedian: number | null | undefined
}): PublishedResortIndexFigures {
  const activeCount = asCount(input.aliasAwareCount)
  return {
    activeCount,
    medianListPrice:
      activeCount != null && activeCount > 0 ? asPositiveMedian(input.aliasAwareMedian) : null,
  }
}

/** Drop a trailing "resort" so A-Z slugs match the registry key. */
export function stripResortSlugSuffix(value: string): string {
  return value.replace(/-resort$/i, '').replace(/\s+resort$/i, '').trim()
}

/** Keys the registry loader must stamp so index slugs cannot miss the overlay. */
export function registryResortOverlayKeys(row: {
  slug: string
  citySlug: string
  label?: string
}): string[] {
  const labelSlug = row.label ? slugify(row.label) : ''
  return Array.from(
    new Set(
      [
        row.slug,
        `${row.citySlug}-${row.slug}`,
        `${row.slug}-resort`,
        `${row.citySlug}-${row.slug}-resort`,
        labelSlug,
        labelSlug ? `${row.citySlug}-${labelSlug}` : '',
        labelSlug ? `${labelSlug}-resort` : '',
        labelSlug ? `${row.citySlug}-${labelSlug}-resort` : '',
      ].filter((key) => key.length > 0),
    ),
  )
}

/**
 * Resolve alias-aware figures for an index / metadata row.
 * Founding miss: A-Z `redmond-eagle-crest-resort` vs overlay `eagle-crest`.
 */
export function lookupRegistryResortFigures<T>(
  overlay: Map<string, T> | Record<string, T>,
  row: { slug: string; citySlug?: string; name?: string; entityKey?: string },
): T | null {
  const get = (key: string): T | undefined =>
    overlay instanceof Map ? overlay.get(key) : overlay[key]
  const slug = row.slug.trim().toLowerCase()
  const citySlug = (row.citySlug ?? '').trim().toLowerCase()
  const nameSlug = row.name ? slugify(row.name) : ''
  const bareFromEntity = row.entityKey?.includes(':')
    ? slugify(row.entityKey.slice(row.entityKey.indexOf(':') + 1))
    : ''
  const candidates = [
    slug,
    citySlug ? `${citySlug}-${slug}` : '',
    nameSlug,
    citySlug && nameSlug ? `${citySlug}-${nameSlug}` : '',
    bareFromEntity,
    stripResortSlugSuffix(slug),
    citySlug ? `${citySlug}-${stripResortSlugSuffix(slug)}` : '',
    nameSlug ? stripResortSlugSuffix(nameSlug) : '',
    citySlug && nameSlug ? `${citySlug}-${stripResortSlugSuffix(nameSlug)}` : '',
    bareFromEntity ? stripResortSlugSuffix(bareFromEntity) : '',
  ].filter((key) => key.length > 0)
  for (const key of candidates) {
    const hit = get(key)
    if (hit) return hit
  }
  return null
}
