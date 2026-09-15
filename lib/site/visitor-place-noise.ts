/**
 * Place names a visitor must never see as a neighborhood, community, or plat.
 *
 * Undesignated is a City GIS catch-all, not a district. Permit-glued plat
 * slugs (PLLD…) are county filing ids, not places. Skip both in crumbs,
 * titles, JSON-LD, leftover grains, and atlas frames.
 */
import { slugify } from '@/lib/slug'

export const PLACE_NOISE_SLUGS = new Set([
  'na',
  'n-a',
  'n-a-n-a',
  'none',
  'null',
  'undefined',
  'unknown',
  'outside-city-limits',
  'not-applicable',
  'not-available',
  'unassigned',
  'other',
  'misc',
  'tbd',
  'to-be-determined',
  'undesignated',
])

const UNDESIGNATED_RE = /undesignated/i
const PLLD_PERMIT_RE = /plld\d+/i

export function isVisitorPlaceNoiseSlug(raw: string | null | undefined): boolean {
  const source = (raw ?? '').trim()
  if (!source) return true
  if (UNDESIGNATED_RE.test(source)) return true
  const slug = slugify(source)
  if (!slug) return true
  if (PLACE_NOISE_SLUGS.has(slug)) return true
  if (UNDESIGNATED_RE.test(slug)) return true
  return false
}

export function isVisitorPlaceNoiseLabel(label: string | null | undefined): boolean {
  const t = (label ?? '').trim()
  if (!t) return true
  if (UNDESIGNATED_RE.test(t)) return true
  return isVisitorPlaceNoiseSlug(t)
}

/** County permit id glued onto a plat slug, e.g. stevens-ranch-phase-rs-1-plld20211070. */
export function isPermitGluedPlatSlug(raw: string | null | undefined): boolean {
  return PLLD_PERMIT_RE.test(slugify(raw ?? ''))
}

export function firstVisitorPlaceLabel(
  ...labels: Array<string | null | undefined>
): string | null {
  for (const label of labels) {
    if (label && !isVisitorPlaceNoiseLabel(label)) return label.trim()
  }
  return null
}

export function firstVisitorPlaceSlug(
  ...slugs: Array<string | null | undefined>
): string | null {
  for (const slug of slugs) {
    if (slug && !isVisitorPlaceNoiseSlug(slug) && !isPermitGluedPlatSlug(slug)) {
      return slug.trim()
    }
  }
  return null
}
