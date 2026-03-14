import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getBrowseCities, getSubdivisionsInCity } from './actions/listings'
import { cityEntityKey } from '../lib/slug'
import { getAllPresetSlugs } from '../lib/search-presets'
import { listMarketReports } from './actions/market-reports'
import { getPublishedBlogPosts } from './actions/blog'
import { getCommunitiesForIndex } from './actions/communities'
import { getActiveBrokers } from './actions/brokers'

const ACTIVE_STATUS_OR =
  'standard_status.is.null,standard_status.ilike.%Active%,standard_status.ilike.%For Sale%,standard_status.ilike.%Coming Soon%'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/homes-for-sale`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/communities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/listings`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/team`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/reports`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/reports/explore`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/open-houses`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/sell/plan`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/home-valuation`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/buy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/our-homes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/area-guides`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/join`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/reviews`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/accessibility`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/fair-housing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/dmca`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/tools/mortgage-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  // If Supabase is not configured (e.g. during Vercel build), return only static pages.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return staticPages
  }

  const cities = await getBrowseCities()
  const citySlugPages: MetadataRoute.Sitemap = cities.map(({ City }) => ({
    url: `${baseUrl}/cities/${cityEntityKey(City)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))
  const searchCityPages: MetadataRoute.Sitemap = cities.map(({ City }) => ({
    url: `${baseUrl}/homes-for-sale/${cityEntityKey(City)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  const communities = await getCommunitiesForIndex()
  const communityPages: MetadataRoute.Sitemap = communities.map((c) => ({
    url: `${baseUrl}/communities/${encodeURIComponent(c.slug)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const subdivisionPages: MetadataRoute.Sitemap = []
  const searchSubdivisionPages: MetadataRoute.Sitemap = []
  const presetSlugs = getAllPresetSlugs()
  const searchCityPresetPages: MetadataRoute.Sitemap = []
  const searchSubdivisionPresetPages: MetadataRoute.Sitemap = []
  for (const { City } of cities) {
    const cityKey = cityEntityKey(City)
    for (const presetSlug of presetSlugs) {
      searchCityPresetPages.push({
        url: `${baseUrl}/homes-for-sale/${cityKey}/${presetSlug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })
    }
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      const neighborhoodSlug = subdivisionName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      subdivisionPages.push({
        url: `${baseUrl}/cities/${cityEntityKey(City)}/${encodeURIComponent(neighborhoodSlug)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
      const subSlug = subdivisionName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      searchSubdivisionPages.push({
        url: `${baseUrl}/homes-for-sale/${cityEntityKey(City)}/${subSlug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })
      for (const presetSlug of presetSlugs) {
        searchSubdivisionPresetPages.push({
          url: `${baseUrl}/homes-for-sale/${cityKey}/${subSlug}/${presetSlug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.75,
        })
      }
    }
  }

  const brokers = await getActiveBrokers()
  const teamPages: MetadataRoute.Sitemap = brokers.map((b) => ({
    url: `${baseUrl}/team/${encodeURIComponent(b.slug)}`,
    lastModified: new Date(b.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const reports = await listMarketReports(500)
  const reportPages: MetadataRoute.Sitemap = reports.map((r) => ({
    url: `${baseUrl}/reports/${r.slug}`,
    lastModified: new Date(r.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))
  const reportGeoPages: MetadataRoute.Sitemap = []
  for (const { City } of cities) {
    reportGeoPages.push({
      url: `${baseUrl}/reports/city/${encodeURIComponent(City)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })
  }
  for (const c of communities) {
    reportGeoPages.push({
      url: `${baseUrl}/reports/community/${encodeURIComponent(c.subdivision)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let listingPages: MetadataRoute.Sitemap = []
  if (url?.trim() && anonKey?.trim()) {
    const supabase = createClient(url, anonKey)
    const { data } = await supabase
      .from('listings')
      .select('listing_key, updated_at')
      .or(ACTIVE_STATUS_OR)
      .limit(50000)
    const rows = (data ?? []) as { listing_key: string; updated_at?: string }[]
    listingPages = rows.map((r) => {
      const lastMod = r.updated_at ? new Date(r.updated_at) : new Date()
      return { url: `${baseUrl}/listing/${encodeURIComponent(r.listing_key)}`, lastModified: lastMod, changeFrequency: 'daily' as const, priority: 0.7 as const }
    })
  }

  const { posts } = await getPublishedBlogPosts({ limit: 500, offset: 0 })
  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.published_at ? new Date(p.published_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [
    ...staticPages,
    ...searchCityPages,
    ...searchCityPresetPages,
    ...searchSubdivisionPages,
    ...searchSubdivisionPresetPages,
    ...citySlugPages,
    ...communityPages,
    ...subdivisionPages,
    ...teamPages,
    ...reportPages,
    ...reportGeoPages,
    ...listingPages,
    ...blogPages,
  ]
}
