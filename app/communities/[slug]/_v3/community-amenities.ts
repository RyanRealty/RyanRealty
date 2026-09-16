/**
 * SITE-116 — the authored amenity list, shaped for beautifului InsightCards.
 *
 * WHY IT IS NOT QUIET. Amenities used to be chip rows inside #belonging. That
 * made the thing a master-planned community is sold on — the course-facing
 * dining room, the spa, the courts, the park across the road — a supporting
 * list under HOA and drive times. Matt 2026-09-14/15: the amenities are the
 * page. This module does not invent a place. It groups the config's own
 * `amenities[]` and counts the share of that authored list. Those shares are
 * composition of a recorded list, not a market figure, and the trace says so.
 *
 * THE CARD IS THE CATALOG'S. AllocationCard (pager + segmented bar + chips)
 * is the installed beautifului InsightCards object. This file only supplies
 * serializable pages. The client reconstructs the Card identity so the
 * interaction stays the catalog's, not a cream-box lookalike.
 */

import type { ResortAmenity } from '@/lib/resort-community-content'

export type AmenityMixSegment = {
  name: string
  label: string
  count: number
  pct: number
  amount: string
  cls: string
  tone: string
}

export type AmenityCategoryPage = {
  key: string
  label: string
  claim: string
  note: string
  pill: string
  pillHref: string
  segments: AmenityMixSegment[]
}

export type CommunityAmenityBoard = {
  placeName: string
  total: number
  claim: string
  names: string[]
  mix: AmenityMixSegment[]
  mixNote: string
  mixPill: string
  mixPillHref: string
  categories: AmenityCategoryPage[]
  source: string
}

export type AmenityPostRef = { slug: string; title: string }

/** Largest-remainder percents that sum to 100. Zero total yields zeros. */
export function integerShares(weights: readonly number[]): number[] {
  const cleaned = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const total = cleaned.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return cleaned.map(() => 0)
  const raw = cleaned.map((w) => (w / total) * 100)
  const floors = raw.map((n) => Math.floor(n))
  const leftover = 100 - floors.reduce((sum, n) => sum + n, 0)
  const order = raw
    .map((n, i) => ({ i, frac: n - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < leftover; k += 1) floors[order[k]!.i] += 1
  return floors
}

export function joinEnglish(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function trimmed(value: string | null | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function amenityLabel(amenity: ResortAmenity): string | undefined {
  return trimmed(amenity.name)
}

function categoryLabel(amenity: ResortAmenity): string {
  return trimmed(amenity.category) ?? 'On site'
}

function shortToken(label: string, used: Set<string>): string {
  const base = label
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 4)
    .toUpperCase()
  const seed = base || 'AMEN'
  let token = seed
  let n = 2
  while (used.has(token)) {
    token = `${seed.slice(0, 3)}${n}`
    n += 1
  }
  used.add(token)
  return token
}

function amenityHref(
  amenity: ResortAmenity,
  posts: Readonly<Record<string, AmenityPostRef>>,
  fallback: string,
): string {
  const url = trimmed(amenity.url)
  if (url) return url
  const post = amenity.blog_slug ? posts[amenity.blog_slug] : undefined
  if (post?.slug) return `/blog/${post.slug}`
  return fallback
}

/**
 * The board behind #amenities. Empty when the config recorded no named amenity.
 * A community with no config is a fact about authoring, not a hole to fill.
 */
export function buildCommunityAmenityBoard(input: {
  placeName: string
  amenities: readonly ResortAmenity[] | null | undefined
  amenityPosts?: Readonly<Record<string, AmenityPostRef>>
  browseHref: string
}): CommunityAmenityBoard | null {
  const placeName = trimmed(input.placeName)
  const browseHref = trimmed(input.browseHref)
  if (!placeName || !browseHref) return null

  const usable = (input.amenities ?? []).filter((amenity) => amenityLabel(amenity))
  if (usable.length === 0) return null

  const posts = input.amenityPosts ?? {}
  const names = usable.map((amenity) => amenityLabel(amenity)!)
  const byCategory = new Map<string, ResortAmenity[]>()
  for (const amenity of usable) {
    const category = categoryLabel(amenity)
    const list = byCategory.get(category) ?? []
    list.push(amenity)
    byCategory.set(category, list)
  }

  const categoryEntries = [...byCategory.entries()]
  const mixShares = integerShares(categoryEntries.map(([, list]) => list.length))
  const mixTokens = new Set<string>()
  const mix: AmenityMixSegment[] = categoryEntries.map(([label, list], i) => ({
    name: shortToken(label, mixTokens),
    label,
    count: list.length,
    pct: mixShares[i] ?? 0,
    amount: list.length === 1 ? '1 on file' : `${list.length} on file`,
    cls: `insight-cards__alloc-seg--${i % 3}`,
    tone: '',
  }))

  const noun = usable.length === 1 ? 'amenity' : 'amenities'
  const claim = `${placeName}'s authored amenity list is ${usable.length} ${noun}: ${joinEnglish(names)}.`

  const categories: AmenityCategoryPage[] = categoryEntries.map(([label, list], i) => {
    const shares = integerShares(list.map(() => 1))
    const tokens = new Set<string>()
    const first = list[0]!
    const firstPost = first.blog_slug ? posts[first.blog_slug] : undefined
    return {
      key: `amenity-${i}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label,
      claim:
        list.length === 1
          ? `${placeName} records one ${label.toLowerCase()} amenity on file: ${amenityLabel(first)}.`
          : `${placeName} records ${list.length} ${label.toLowerCase()} amenities on file: ${joinEnglish(list.map((a) => amenityLabel(a)!))}.`,
      note:
        trimmed(first.description) ??
        `Share of the authored ${label.toLowerCase()} amenities on file for ${placeName}. Not a live inventory count.`,
      pill: firstPost?.title
        ? firstPost.title
        : `See ${placeName} homes`,
      pillHref: amenityHref(first, posts, browseHref),
      segments: list.map((amenity, j) => ({
        name: shortToken(amenityLabel(amenity)!, tokens),
        label: amenityLabel(amenity)!,
        count: 1,
        pct: shares[j] ?? 0,
        amount: trimmed(amenity.access) ?? 'On file',
        cls: `insight-cards__alloc-seg--${j % 3}`,
        tone: '',
      })),
    }
  })

  return {
    placeName,
    total: usable.length,
    claim,
    names,
    mix,
    mixNote: `Share of the ${usable.length} authored ${noun} on file for ${placeName}, grouped by the category the community config records. Not a live inventory count.`,
    mixPill: `See ${placeName} homes`,
    mixPillHref: browseHref,
    categories,
    source: `Authored ${placeName} amenity list on file. Names, access, and categories come from data/resort-community-*.json. Not MLS inventory.`,
  }
}

export function amenityItemListItems(
  board: CommunityAmenityBoard,
  pageUrl: string,
  amenities: readonly ResortAmenity[],
  posts: Readonly<Record<string, AmenityPostRef>> = {},
): { name: string; url: string }[] {
  return amenities
    .map((amenity) => {
      const name = amenityLabel(amenity)
      if (!name) return null
      return { name, url: amenityHref(amenity, posts, `${pageUrl}#amenities`) }
    })
    .filter((item): item is { name: string; url: string } => item != null)
}
