import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getBrowseCities, getSubdivisionsInCity } from './actions/listings'
import { cityEntityKey } from '../lib/slug'
import { listMarketReports } from './actions/market-reports'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/listings`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/listings?view=map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/reports`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  ]

  const cities = await getBrowseCities()
  const cityPages: MetadataRoute.Sitemap = cities.map(({ City }) => ({
    url: `${baseUrl}/search/${encodeURIComponent(City)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  const reports = await listMarketReports(50)
  const reportPages: MetadataRoute.Sitemap = reports.map((r) => ({
    url: `${baseUrl}/reports/${r.slug}`,
    lastModified: new Date(r.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const subdivisionPages: MetadataRoute.Sitemap = []
  for (const { City } of cities) {
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      subdivisionPages.push({
        url: `${baseUrl}/search/${cityEntityKey(City)}/${encodeURIComponent(subdivisionName)}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.75,
      })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let listingPages: MetadataRoute.Sitemap = []
  if (url?.trim() && anonKey?.trim()) {
    const supabase = createClient(url, anonKey)
    const { data } = await supabase.from('listings').select('ListingKey').limit(5000)
    const keys = (data ?? []) as { ListingKey: string }[]
    listingPages = keys.map(({ ListingKey }) => ({
      url: `${baseUrl}/listing/${ListingKey}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  }

  return [...staticPages, ...cityPages, ...subdivisionPages, ...reportPages, ...listingPages]
}
