/**
 * Authored places on a community page.
 *
 * Each row is a place from the community guide: its name, what it is, and
 * who can use it when that line is a sentence. A one-word access code
 * (Public, DINI) is not a fact a visitor can use, so it stays off the page.
 * Shares of a list are not a figure. Nothing here is invented.
 */

import type { ResortAmenity } from '@/lib/resort-community-content'

export type AmenityPostRef = { slug: string; title: string }

export type AmenityPlace = {
  name: string
  category: string
  description?: string
  access?: string
  href?: string
}

export type AmenityGroup = {
  label: string
  places: AmenityPlace[]
}

export type CommunityAmenityBoard = {
  placeName: string
  total: number
  /** Sentence of every place name. */
  claim: string
  /** Short heading from the category names. */
  heading: string
  groups: AmenityGroup[]
  source: string
}

const ACCESS_CODE = /^(public|dini|recr|well|othe|members?)$/i

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

function categoryLabel(amenity: ResortAmenity): string {
  return trimmed(amenity.category) ?? 'On site'
}

function visitorAccess(access: string | null | undefined): string | undefined {
  const line = trimmed(access)
  if (!line || ACCESS_CODE.test(line)) return undefined
  return line
}

function amenityHref(
  amenity: ResortAmenity,
  posts: Readonly<Record<string, AmenityPostRef>>,
): string | undefined {
  const url = trimmed(amenity.url)
  if (url) return url
  const post = amenity.blog_slug ? posts[amenity.blog_slug] : undefined
  if (post?.slug) return `/blog/${post.slug}`
  return undefined
}

function categoryHeading(labels: readonly string[]): string {
  const words = labels.map((label, i) => (i === 0 ? label : label.toLowerCase()))
  return joinEnglish(words)
}

/**
 * The board behind #amenities. Empty when the config recorded no named place.
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

  const usable = (input.amenities ?? []).filter((amenity) => trimmed(amenity.name))
  if (usable.length === 0) return null

  const posts = input.amenityPosts ?? {}
  const names = usable.map((amenity) => trimmed(amenity.name)!)
  const groups: AmenityGroup[] = []
  for (const amenity of usable) {
    const label = categoryLabel(amenity)
    const place: AmenityPlace = {
      name: trimmed(amenity.name)!,
      category: label,
      ...(trimmed(amenity.description) ? { description: trimmed(amenity.description) } : {}),
      ...(visitorAccess(amenity.access) ? { access: visitorAccess(amenity.access) } : {}),
      ...(amenityHref(amenity, posts) ? { href: amenityHref(amenity, posts) } : {}),
    }
    const current = groups[groups.length - 1]
    if (current && current.label === label) current.places.push(place)
    else groups.push({ label, places: [place] })
  }

  return {
    placeName,
    total: usable.length,
    claim: `${placeName} has ${joinEnglish(names)}.`,
    heading: categoryHeading(groups.map((group) => group.label)),
    groups,
    source: `Amenity names come from the ${placeName} community guide. Not MLS inventory.`,
  }
}

export function amenityItemListItems(
  board: CommunityAmenityBoard,
  pageUrl: string,
): { name: string; url: string }[] {
  return board.groups.flatMap((group) =>
    group.places.map((place) => ({
      name: place.name,
      url: place.href ?? `${pageUrl}#amenities`,
    })),
  )
}
