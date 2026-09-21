/**
 * Nearby place peers for keep-exploring (SITE-128 Look punch, 2026-09-18).
 *
 * A city-wide lifetime-sales dump is not a neighbor list. Rank comes from the
 * GIS ring (plats that touch or sit next to this one), then resort siblings.
 * Closed-count sort never enters this file.
 *
 * otherCommunitySubdivs is the same-community sibling rail (listing / place
 * keep-exploring). Visitor names only — no plat-name leaks, no counts.
 */
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { slugify } from '@/lib/slug'
import { subdivisionHref } from '@/lib/site/place-href'
import {
  isPermitGluedPlatSlug,
  isVisitorPlaceNoiseLabel,
  isVisitorPlaceNoiseSlug,
} from '@/lib/site/visitor-place-noise'

export type NearbyPlacePeer = {
  name: string
  href: string
}

export type NearbyRingPlat = {
  slug: string
  label: string
  rank: number
}

const DEFAULT_CAP = 8

function slugFromHref(href: string): string {
  return href.split('/').filter(Boolean).at(-1) ?? ''
}

function slugTokens(slug: string): string[] {
  return slug.toLowerCase().split(/[-_]+/).filter(Boolean)
}

/**
 * Two-or-more token suffix twin: river-woods ⊂ deschutes-river-woods.
 * A single leftover token (woods ⊂ deschutes-river-woods) is not a twin.
 */
export function isTwoTokenSuffixTwin(shorterSlug: string, longerSlug: string): boolean {
  const shorter = slugTokens(shorterSlug)
  const longer = slugTokens(longerSlug)
  if (shorter.length < 2 || longer.length <= shorter.length) return false
  return shorter.every((token, i) => token === longer[longer.length - shorter.length + i])
}

function collapseTwinChildEntries(rows: NearbyPlacePeer[]): NearbyPlacePeer[] {
  const drop = new Set<number>()
  const slugs = rows.map((row) => slugFromHref(row.href).toLowerCase())
  const names = rows.map((row) => row.name.trim().toLowerCase())
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = 0; j < rows.length; j += 1) {
      if (i === j) continue
      if (isTwoTokenSuffixTwin(slugs[i], slugs[j])) {
        drop.add(i)
        continue
      }
      if (names[i] && names[i] === names[j]) {
        if (slugs[i].length < slugs[j].length) drop.add(i)
        else if (slugs[i].length === slugs[j].length && i > j) drop.add(i)
      }
    }
  }
  return rows.filter((_, i) => !drop.has(i))
}

/**
 * Name-only doors, caller order preserved, self dropped, cap applied.
 * Empty when nothing nearby is named — the section then omits itself.
 */
export function nearbySubdivisionPeers(input: {
  selfSlug: string
  ring?: { ring: readonly NearbyRingPlat[] } | null
  resortPeers?: ReadonlyArray<{ name: string; href: string }>
  cap?: number
}): NearbyPlacePeer[] {
  const cap = input.cap ?? DEFAULT_CAP
  const self = input.selfSlug.trim()
  const seen = new Set<string>(self ? [self] : [])
  const out: NearbyPlacePeer[] = []

  const push = (slug: string, name: string, href?: string) => {
    const key = slug.trim()
    const label = name.trim()
    if (!key || !label || seen.has(key) || out.length >= cap) return
    seen.add(key)
    out.push({ name: label, href: href ?? `/subdivisions/${key}` })
  }

  const ranked = [...(input.ring?.ring ?? [])].sort((a, b) => a.rank - b.rank)
  for (const row of ranked) {
    push(row.slug, row.label)
  }
  for (const peer of input.resortPeers ?? []) {
    push(slugFromHref(peer.href), peer.name, peer.href)
  }
  return out
}

/** Deduped name-only child cards. First occurrence wins; counts never attach. */
export function nameOnlyChildEntries(
  groups: ReadonlyArray<ReadonlyArray<{ name: string; href: string }>>,
): NearbyPlacePeer[] {
  const seen = new Set<string>()
  const out: NearbyPlacePeer[] = []
  for (const group of groups) {
    for (const row of group) {
      const href = row.href.trim()
      const name = publishPlatDisplayName(row.name)
      if (!href || !name || seen.has(href)) continue
      seen.add(href)
      out.push({ name, href })
    }
  }
  return collapseTwinChildEntries(out)
}

function visitorSubdivCard(label: string, slug: string): NearbyPlacePeer | null {
  const rawLabel = label.trim()
  const rawSlug = slug.trim().toLowerCase()
  if (!rawLabel || !rawSlug) return null
  if (
    isVisitorPlaceNoiseLabel(rawLabel) ||
    isVisitorPlaceNoiseSlug(rawSlug) ||
    isPermitGluedPlatSlug(rawSlug)
  ) {
    return null
  }
  const name = publishPlatDisplayName(rawLabel)
  const href = subdivisionHref(rawSlug)
  if (!name || !href) return null
  return { name, href }
}

/**
 * Sibling subdivs in the same community. Name-only cards. No city dump,
 * no sales sort, no plat-name leaks (permit-glued / MLS abbreviations).
 * Empty when the frame is a city or nothing visitor-named remains.
 */
export function otherCommunitySubdivs(input: {
  selfSlug?: string | null
  plats?: ReadonlyArray<{ slug: string; label: string }>
  aliases?: readonly string[]
  cap?: number
}): NearbyPlacePeer[] {
  const self = (input.selfSlug ?? '').trim().toLowerCase()
  const cards: NearbyPlacePeer[] = []
  for (const plat of input.plats ?? []) {
    const card = visitorSubdivCard(plat.label, plat.slug)
    if (card) cards.push(card)
  }
  for (const alias of input.aliases ?? []) {
    const published = publishPlatDisplayName(alias)
    const slug = published ? slugify(published) : slugify(alias)
    if (!published || !slug) continue
    const card = visitorSubdivCard(published, slug)
    if (card) cards.push(card)
  }
  const deduped = nameOnlyChildEntries([cards]).filter(
    (row) => slugFromHref(row.href).toLowerCase() !== self,
  )
  deduped.sort((a, b) => a.name.localeCompare(b.name, 'en-US'))
  return deduped.slice(0, input.cap ?? DEFAULT_CAP)
}
