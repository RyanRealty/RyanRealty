import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getBrowseCities, getSubdivisionsInCity } from './actions/listings'
import { cityEntityKey } from '../lib/slug'
import { listMarketReports } from './actions/market-reports'
import { getPublishedBlogPosts } from './actions/blog'
import { getCommunitiesForIndex } from './actions/communities'
import { getActiveBrokers } from './actions/brokers'

const ACTIVE_STATUS_OR =
  'standard_status.is.null,standard_status.ilike.%Active%,standard_status.ilike.%For Sale%,standard_status.ilike.%Coming Soon%'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/communities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cities`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/listings`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/agents`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/reports`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/open-houses`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/tools/mortgage-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  const cities = await getBrowseCities()
  const citySlugPages: MetadataRoute.Sitemap = cities.map(({ City }) => ({
    url: `${baseUrl}/cities/${cityEntityKey(City)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))
  const searchCityPages: MetadataRoute.Sitemap = cities.map(({ City }) => ({
    url: `${baseUrl}/search/${cityEntityKey(City)}`,
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
  for (const { City } of cities) {
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      const neighborhoodSlug = subdivisionName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      subdivisionPages.push({
        url: `${baseUrl}/cities/${cityEntityKey(City)}/${encodeURIComponent(neighborhoodSlug)}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
    }
  }

  const brokers = await getActiveBrokers()
  const agentPages: MetadataRoute.Sitemap = brokers.map((b) => ({
    url: `${baseUrl}/agents/${encodeURIComponent(b.slug)}`,
    lastModified: new Date(b.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const reports = await listMarketReports(50)
  const reportPages: MetadataRoute.Sitemap = reports.map((r) => ({
    url: `${baseUrl}/reports/${r.slug}`,
    lastModified: new Date(r.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let listingPages: MetadataRoute.Sitemap = []
  if (url?.trim() && anonKey?.trim()) {
    const supabase = createClient(url, anonKey)
    const { data } = await supabase
      .from('listings')
      .select('listing_key, updated_at')
      .or(ACTIVE_STATUS_OR)
      .limit(10000)
    const rows = (data ?? []) as { listing_key: string; updated_at?: string }[]
    listingPages = rows.map((r) => ({
      url: `${baseUrl}/listings/${encodeURIComponent(r.listing_key)}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }))
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
    ...citySlugPages,
    ...communityPages,
    ...subdivisionPages,
    ...agentPages,
    ...reportPages,
    ...listingPages,
    ...blogPages,
  ]
}
