/**
 * Alias-plat climb for listing breadcrumbs.
 *
 * data/subdivision-alias-plats.json names a marketing parent (Stevens Ranch)
 * whose MLS SubdivisionName is shared by several recorded county plats. The
 * listing row keeps both: MLS name on subdivisionName, and the recorded plat
 * label on boundarySubdivision. When those differ, the trail should climb
 * parent → plat → street instead of collapsing to one Stevens Ranch crumb.
 */
import aliasPlats from '@/data/subdivision-alias-plats.json'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { slugify } from '@/lib/slug'
import type { PlaceTrailNode } from '@/lib/site/place-trail'

type MemberPlat = { slug?: string; name?: string; csnum?: string }
type AliasEntry = {
  aliasSlug?: string
  mlsName?: string
  memberPlats?: MemberPlat[]
}

type AliasFile = { entries?: AliasEntry[] }

const ENTRIES: AliasEntry[] = Array.isArray((aliasPlats as AliasFile).entries)
  ? ((aliasPlats as AliasFile).entries as AliasEntry[])
  : []

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function findEntry(mlsName: string | null | undefined): AliasEntry | null {
  const needle = norm(mlsName)
  if (!needle) return null
  return (
    ENTRIES.find((e) => norm(e.mlsName) === needle || norm(e.aliasSlug?.replace(/-/g, ' ')) === needle) ??
    null
  )
}

function findMember(entry: AliasEntry, boundaryLabel: string | null | undefined): MemberPlat | null {
  const needle = norm(boundaryLabel)
  if (!needle) return null
  const plats = Array.isArray(entry.memberPlats) ? entry.memberPlats : []
  // Exact label or slug only — do not let "Stevens Ranch" substring-match a phase.
  return (
    plats.find((p) => {
      const name = norm(p.name)
      const slug = (p.slug ?? '').trim().toLowerCase()
      const slugWords = norm(p.slug?.replace(/-/g, ' '))
      return (name !== '' && name === needle) || slug === needle || slugWords === needle
    }) ?? null
  )
}

export type ListingAliasPlatLadder = {
  /** Marketing parent (alias). Not necessarily a /communities resort page. */
  parent: PlaceTrailNode | null
  /** Recorded plat leaf when boundary names a member plat. */
  plat: PlaceTrailNode | null
}

/**
 * When MLS subdivision is an alias parent and boundarySubdivision is a member
 * plat, return parent + plat nodes for listingPlaceTrail. Otherwise nulls.
 */
export function listingAliasPlatLadder(input: {
  mlsSubdivisionName: string | null | undefined
  boundarySubdivision: string | null | undefined
}): ListingAliasPlatLadder {
  const entry = findEntry(input.mlsSubdivisionName)
  if (!entry?.aliasSlug || !entry.mlsName) return { parent: null, plat: null }

  const parent: PlaceTrailNode = {
    label: entry.mlsName.trim(),
    slug: entry.aliasSlug.trim().toLowerCase(),
  }

  const member = findMember(entry, input.boundarySubdivision)
  if (!member) {
    // Same label on MLS and boundary — one crumb is enough; caller keeps
    // placeContext.subdivision.
    const boundary = norm(input.boundarySubdivision)
    const mls = norm(input.mlsSubdivisionName)
    if (boundary && boundary !== mls) {
      // Boundary is some other plat label not in the member list — still climb
      // parent + that plat.
      const published = publishPlatDisplayName(input.boundarySubdivision) ?? input.boundarySubdivision!.trim()
      const slug = slugify(published)
      if (published && slug) {
        return { parent, plat: { label: published, slug } }
      }
    }
    return { parent: null, plat: null }
  }

  const rawName = (member.name ?? '').trim()
  const published = publishPlatDisplayName(rawName) ?? rawName
  const slug = (member.slug ?? '').trim().toLowerCase() || slugify(published)
  if (!published || !slug) return { parent: null, plat: null }

  // Parent and plat must differ or the trail collapses.
  if (norm(parent.label) === norm(published) || parent.slug === slug) {
    return { parent: null, plat: null }
  }

  return { parent, plat: { label: published, slug } }
}
