/**
 * Down-links from a resort community page to its /types/* filters, and the
 * four slugs the SEO & AEO Desk brief (2026-10-08) names for that treatment.
 *
 * Type pages stay indexed; the community page stays canonical for the head
 * terms. Anchors name the type ("Brasada Ranch houses") so the two URLs do
 * not bid for the same phrase.
 */
import { communityPath } from '@/lib/communities/community-public-pair'
import type { PlaceBuyerGroup } from './community-stock-types'

export const COMMUNITY_ANSWER_SLUGS = [
  'brasada-ranch',
  'black-butte-ranch',
  'tetherow',
  'broken-top',
] as const

export type CommunityAnswerSlug = (typeof COMMUNITY_ANSWER_SLUGS)[number]

export function isCommunityAnswerSlug(slug: string): slug is CommunityAnswerSlug {
  return (COMMUNITY_ANSWER_SLUGS as readonly string[]).includes(slug)
}

export type CommunityTypeDownLink = { href: string; label: string }

/**
 * Visible down-links to /communities/{slug}/types/* when that type is in the
 * listed set. Townhomes only for Broken Top (the type page that outranks the
 * parent for that intent). Empty for every other community.
 */
export function communityTypeDownLinks(input: {
  slug: string
  name: string
  types: readonly PlaceBuyerGroup[]
}): CommunityTypeDownLink[] {
  const { slug, name, types } = input
  if (!isCommunityAnswerSlug(slug) || !name.trim()) return []
  const present = new Set(types)
  const out: CommunityTypeDownLink[] = []
  if (present.has('homes')) {
    out.push({
      href: `${communityPath(slug)}/types/single-family`,
      label: `${name} houses`,
    })
  }
  if (slug === 'broken-top' && present.has('attached')) {
    out.push({
      href: `${communityPath(slug)}/types/townhomes`,
      label: `${name} townhomes`,
    })
  }
  if (present.has('lots')) {
    out.push({
      href: `${communityPath(slug)}/types/lots-and-land`,
      label: `${name} lots`,
    })
  }
  return out
}

/** Visible up-link on /types/* (and plats that already map to a community). */
export function communityAllRealEstateLabel(name: string): string {
  return `All ${name.trim()} real estate`
}
