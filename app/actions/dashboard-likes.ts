'use server'

import { getLikedListingKeys, unlikeListing } from '@/app/actions/likes'
import { getSavedListingKeys, unsaveListing } from '@/app/actions/saved-listings'
import { getListingsByKeys } from '@/app/actions/listings'
import { getSavedCitySlugs, unsaveCity } from '@/app/actions/saved-cities'
import { getLikedCommunityKeys, removeCommunityLike } from '@/app/actions/community-engagement'
import { getSavedCommunityKeys, unsaveCommunity } from '@/app/actions/saved-communities'
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

export async function removeLikeItem(
  kind: 'listing' | 'city' | 'community',
  id: string
): Promise<{ error: string | null }> {
  const normalizedId = id.trim()
  if (!normalizedId) return { error: 'Missing id' }

  if (kind === 'listing') {
    const [likeResult, saveResult] = await Promise.all([
      unlikeListing(normalizedId),
      unsaveListing(normalizedId),
    ])
    return { error: likeResult.error ?? saveResult.error ?? null }
  }

  if (kind === 'city') {
    return unsaveCity(normalizedId.toLowerCase())
  }

  const [likedResult, savedResult] = await Promise.all([
    removeCommunityLike(normalizedId.toLowerCase()),
    unsaveCommunity(normalizedId.toLowerCase()),
  ])
  return { error: likedResult.error ?? savedResult.error ?? null }
}
