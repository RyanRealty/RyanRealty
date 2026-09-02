'use server'

import { getLikedListingKeys } from '@/app/actions/likes'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getListingsByKeys } from '@/app/actions/listings'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getLikedCommunityKeys } from '@/app/actions/community-engagement'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'

type CityLike = {
  slug: string
  name: string
}

type CommunityLike = {
  entityKey: string
  slug: string
  city: string
  subdivision: string
}

type ListingLike = Awaited<ReturnType<typeof getListingsByKeys>>[number]

export type DashboardLikesData = {
  listings: ListingLike[]
  cities: CityLike[]
  communities: CommunityLike[]
}

function titleCaseWords(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function getDashboardLikesData(): Promise<DashboardLikesData> {
  const [likedListingKeys, savedListingKeys, citySlugs, likedCommunityKeys, savedCommunityKeys] = await Promise.all([
    getLikedListingKeys(),
    getSavedListingKeys(),
    getSavedCitySlugs(),
    getLikedCommunityKeys(),
    getSavedCommunityKeys(),
  ])

  const listingKeys = [...new Set([...likedListingKeys, ...savedListingKeys].map((k) => String(k).trim()).filter(Boolean))]
  const listings = listingKeys.length > 0 ? await getListingsByKeys(listingKeys) : []

  const citySlugSet = new Set(citySlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  const cityRows = await getCitiesForIndex()
  const cityBySlug = new Map(cityRows.map((city) => [city.slug.toLowerCase(), city]))
  const cities: CityLike[] = [...citySlugSet].map((slug) => {
    const row = cityBySlug.get(slug)
    return {
      slug,
      name: row?.name ?? titleCaseWords(slug),
    }
  })

  const communityKeySet = new Set(
    [...likedCommunityKeys, ...savedCommunityKeys]
      .map((key) => key.trim().toLowerCase())
      .filter((key) => key.includes(':'))
  )
  const communityRows = await getCommunitiesForIndex()
  const communityByKey = new Map(communityRows.map((community) => [community.entityKey.toLowerCase(), community]))
  const communities: CommunityLike[] = [...communityKeySet].map((entityKey) => {
    const row = communityByKey.get(entityKey)
    if (row) {
      return {
        entityKey,
        slug: row.slug,
        city: row.city,
        subdivision: row.subdivision,
      }
    }
    const [citySlug, subdivisionSlug] = entityKey.split(':')
    return {
      entityKey,
      slug: entityKey.replace(':', '-'),
      city: titleCaseWords(citySlug ?? ''),
      subdivision: titleCaseWords(subdivisionSlug ?? ''),
    }
  })

  return {
    listings,
    cities,
    communities,
  }
}

