/**
 * Sitewide "Homes for sale by area" doors.
 *
 * Exact-match anchors for the inventory queries the city search pages and
 * community hubs own (PAGE_OUTLINE). Footer, listing text links, and blog
 * contextual links read this list so the five cities and the top eight
 * community hubs cannot drift.
 *
 * City doors are /homes-for-sale/{city}. Community doors are /communities/{slug}.
 * Sunriver is in the city list as /homes-for-sale/sunriver (a live city search);
 * it is not repeated in the community eight so the same exact-match phrase
 * does not point at two URLs. SITE-187 still keeps the Markets column door
 * to /communities/sunriver.
 */
import { communityPath } from '@/lib/communities/community-public-pair'
import { homesForSalePath } from '@/lib/slug'
import { placeHomesForSaleHeading } from '@/lib/site/place-homes-heading'

export type AreaHubLink = {
  slug: string
  label: string
  href: string
  /** Exact-match anchor: "{Name} homes for sale". */
  anchor: string
}

const CITY_HUB_LABELS = [
  ['bend', 'Bend'],
  ['redmond', 'Redmond'],
  ['sisters', 'Sisters'],
  ['sunriver', 'Sunriver'],
  ['la-pine', 'La Pine'],
] as const

/** Chrome-promoted resorts plus Caldera Springs (GSC next after that set). */
const COMMUNITY_HUB_LABELS = [
  ['tetherow', 'Tetherow'],
  ['broken-top', 'Broken Top'],
  ['northwest-crossing', 'NorthWest Crossing'],
  ['eagle-crest', 'Eagle Crest'],
  ['black-butte-ranch', 'Black Butte Ranch'],
  ['juniper-preserve', 'Juniper Preserve'],
  ['brasada-ranch', 'Brasada Ranch'],
  ['caldera-springs', 'Caldera Springs'],
] as const

function cityHub(slug: string, label: string): AreaHubLink {
  return {
    slug,
    label,
    href: homesForSalePath(label),
    anchor: placeHomesForSaleHeading(label),
  }
}

function communityHub(slug: string, label: string): AreaHubLink {
  return {
    slug,
    label,
    href: communityPath(slug),
    anchor: placeHomesForSaleHeading(label),
  }
}

export const HOMES_FOR_SALE_CITY_HUBS: readonly AreaHubLink[] = CITY_HUB_LABELS.map(
  ([slug, label]) => cityHub(slug, label),
)

export const HOMES_FOR_SALE_COMMUNITY_HUBS: readonly AreaHubLink[] = COMMUNITY_HUB_LABELS.map(
  ([slug, label]) => communityHub(slug, label),
)

export const HOMES_FOR_SALE_BY_AREA_HEADING = 'Homes for sale by area'

export function cityHubForSlug(slug: string | null | undefined): AreaHubLink | null {
  const key = slug?.trim().toLowerCase() ?? ''
  if (!key) return null
  return HOMES_FOR_SALE_CITY_HUBS.find((hub) => hub.slug === key) ?? null
}

export function cityHubForLabel(label: string | null | undefined): AreaHubLink | null {
  const name = label?.trim().toLowerCase() ?? ''
  if (!name) return null
  return (
    HOMES_FOR_SALE_CITY_HUBS.find((hub) => hub.label.toLowerCase() === name) ??
    cityHubForSlug(name.replace(/\s+/g, '-'))
  )
}
