/**
 * Homepage new-construction primary run — live counts, SFR-first doors.
 */
import { searchListingsAllCount } from '@/lib/data'
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

export async function loadHomeNewConRun(): Promise<HomePlaceRun> {
  const [bendCount, ...navCounts] = await Promise.all([
    liveCount(bendNewConSearchFilter()),
    ...BEND_NEW_CON_HOME_NAV_NAMES.map((name) => liveCount(bendNewConSearchFilter(name))),
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
      const photoSrc = preferPlaceHeroOrNull(null, communityImage(slugify(name)))
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
    layout: 'carousel',
    seeAll: { label: 'Bend new homes page', href: '/new-construction' },
    doors,
  }
}
