/**
 * Homepage new-construction primary run — live counts, SFR-first doors.
 */
import { searchListingsAllCount } from '@/lib/data'
import {
  BEND_NEW_CON_HOME_NAV_NAMES,
  bendNewConSearchFilter,
  bendNewConSearchHref,
} from '@/lib/site/bend-new-construction'
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

  // The Bend total leads as the run's figure ("216 new homes for sale in
  // Bend"); each building subdivision is a counted row under it, its count a
  // length on the run's one scale (2026-10-01: the cards read as the third
  // run of one card shape, and "Active-building subdivision" as jargon).
  const lead: HomePlaceDoor = {
    label: 'in Bend',
    href: '/new-construction',
    description: 'Counted from the listings the MLS marks as new construction in Bend, by subdivision.',
    ...(bendCount != null ? { count: bendCount } : {}),
  }
  const doors: HomePlaceDoor[] = BEND_NEW_CON_HOME_NAV_NAMES.map((name, i) => ({
    label: name,
    href: bendNewConSearchHref(name),
    ...(navCounts[i] != null ? { count: navCounts[i] } : {}),
  }))

  return {
    name: 'New construction',
    unit: 'new homes for sale',
    unitOne: 'new home for sale',
    layout: 'ledger',
    seeAll: { label: 'Every new home in Bend', href: '/new-construction' },
    lead,
    doors,
  }
}
