/**
 * Homepage new-construction primary run — live counts, SFR-first doors.
 */
import { searchListingsAll, searchListingsAllCount } from '@/lib/data'
import {
  BEND_NEW_CON_HOME_NAV_NAMES,
  BEND_NEW_CON_STAGE_FALLBACK_POSTER,
  bendNewConSearchFilter,
  bendNewConSearchHref,
} from '@/lib/site/bend-new-construction'
import { communityImage, preferPlaceHeroOrNull } from '@/lib/geo-images'
import { slugify } from '@/lib/slug'
import type { HomePlaceDoor, HomePlaceRun } from './HomeBrowsePlaces'

function dalReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url?.trim() && key?.trim())
}

async function liveCount(filter: Parameters<typeof searchListingsAllCount>[0]): Promise<number | undefined> {
  if (!dalReady()) return undefined
  try {
    const count = await searchListingsAllCount(filter)
    return Number.isFinite(count) && count > 0 ? count : undefined
  } catch (err) {
    console.error('[loadHomeNewConRun]', err)
    return undefined
  }
}

/**
 * A photograph of one of the subdivision's own new homes for sale, for a door
 * with no place photograph (2026-09-29: two of three doors were a navy plate
 * with a name on it). The newest photographed listing the same filter counts;
 * nothing when there is none, and the plate stays.
 */
async function listedPhoto(filter: Parameters<typeof searchListingsAll>[0]): Promise<string | undefined> {
  if (!dalReady()) return undefined
  try {
    const { rows } = await searchListingsAll({ ...filter, photosCountMin: 1, sort: 'newest', limit: 3 })
    const url = rows.map((row) => row.photoUrl?.trim()).find((src): src is string => Boolean(src))
    return url || undefined
  } catch (err) {
    console.error('[loadHomeNewConRun] photo', err)
    return undefined
  }
}

export async function loadHomeNewConRun(): Promise<HomePlaceRun> {
  const placePhotos = BEND_NEW_CON_HOME_NAV_NAMES.map((name) => preferPlaceHeroOrNull(null, communityImage(slugify(name))))
  const [[bendCount, ...navCounts], listedPhotos] = await Promise.all([
    Promise.all([
      liveCount(bendNewConSearchFilter()),
      ...BEND_NEW_CON_HOME_NAV_NAMES.map((name) => liveCount(bendNewConSearchFilter(name))),
    ]),
    Promise.all(
      BEND_NEW_CON_HOME_NAV_NAMES.map((name, i) =>
        placePhotos[i] ? Promise.resolve(undefined) : listedPhoto(bendNewConSearchFilter(name)),
      ),
    ),
  ])

  const doors: HomePlaceDoor[] = [
    {
      label: 'Bend new homes',
      href: '/new-construction',
      description: 'Single-family first · map and builder savings',
      photoSrc: BEND_NEW_CON_STAGE_FALLBACK_POSTER,
      ...(bendCount != null ? { count: bendCount } : {}),
    },
    ...BEND_NEW_CON_HOME_NAV_NAMES.map((name, i) => {
      const photoSrc = placePhotos[i] ?? listedPhotos[i] ?? null
      return {
        label: name,
        href: bendNewConSearchHref(name),
        description: 'Active-building subdivision',
        ...(photoSrc ? { photoSrc } : {}),
        ...(navCounts[i] != null ? { count: navCounts[i] } : {}),
      }
    }),
  ]

  return {
    name: 'New construction',
    unit: 'new homes for sale',
    // A counted ledger like the towns under it (2026-09-29: three card
    // carousels on one page, featured communities, new construction and the
    // resorts, read as one module three times; at 375 each card was a
    // half-empty box between two arrows).
    seeAll: { label: 'Bend new homes page', href: '/new-construction' },
    doors,
  }
}
