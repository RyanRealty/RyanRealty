import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { cityEntityKey, listingDetailPath, listingsBrowsePath, slugify, teamPath, valuationPath } from '../lib/slug'
import { getAllPresetSlugs } from '../lib/search-presets'

const ACTIVE_STATUS_OR =
  'standard_status.is.null,standard_status.ilike.%Active%,standard_status.ilike.%For Sale%,standard_status.ilike.%Coming Soon%'

/**
 * Dynamic sitemap — generates at request time so it always has fresh data.
 * Next.js serves this at /sitemap.xml automatically.
 *
 * Note: we removed generateSitemaps() because it runs at build time
 * when Supabase env vars may not be available, resulting in empty sitemaps.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.vercel.app').replace(/\/$/, '')
  const now = new Date()

  // Static pages — always included even without database
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}${listingsBrowsePath()}`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/communities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/cities`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}${teamPath()}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/guides`, lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${baseUrl}/housing-market`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/housing-market/central-oregon`, lastModified: now, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${baseUrl}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/activity`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/sell`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/sell/plan`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}${valuationPath()}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/buy`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/our-homes`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/videos`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/resources`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/tools/mortgage-calculator`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/tools/appreciation`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/join`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/accessibility`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/fair-housing`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/dmca`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // If Supabase is not configured, return only static pages
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) {
    return staticPages
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const dynamicPages: MetadataRoute.Sitemap = []

  try {
    // Cities
    const { data: cityRows } = await supabase
      .from('listings')
      .select('City')
      .or(ACTIVE_STATUS_OR)
      .not('City', 'is', null)
      .limit(5000)

    const cities = Array.from(
      new Set(
        ((cityRows ?? []) as Array<{ City?: string | null }>)
          .map((row) => (row.City ?? '').trim())
          .filter((city) => city.length > 0)
      )
    )

    for (const city of cities) {
      const key = cityEntityKey(city)
      dynamicPages.push(
        { url: `${baseUrl}/cities/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
        { url: `${baseUrl}/homes-for-sale/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
        { url: `${baseUrl}/open-houses/${key}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
      )

      // Preset filter pages per city
      const presetSlugs = getAllPresetSlugs()
      for (const preset of presetSlugs) {
        dynamicPages.push({
          url: `${baseUrl}/homes-for-sale/${key}/${preset}`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        })
      }
    }

    // Communities
    const { data: communityRows } = await supabase
      .from('communities')
      .select('slug')
      .limit(5000)

    for (const c of (communityRows ?? []) as Array<{ slug: string }>) {
      dynamicPages.push({
        url: `${baseUrl}/communities/${encodeURIComponent(c.slug)}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }

    // Subdivisions per city
    for (const city of cities) {
      const { data: subRows } = await supabase
        .from('listings')
        .select('SubdivisionName')
        .eq('City', city)
        .not('SubdivisionName', 'is', null)
        .limit(5000)

      const subs = Array.from(
        new Set(
          ((subRows ?? []) as Array<{ SubdivisionName?: string | null }>)
            .map((r) => (r.SubdivisionName ?? '').trim())
            .filter((n) => n.length > 0)
        )
      )

      const cityKey = cityEntityKey(city)
      for (const sub of subs) {
        const subSlug = slugify(sub)
        dynamicPages.push(
          { url: `${baseUrl}/cities/${cityKey}/${encodeURIComponent(subSlug)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
          { url: `${baseUrl}/homes-for-sale/${cityKey}/${subSlug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
        )
      }
    }

    // Team members
    const { data: brokers } = await supabase
      .from('brokers')
      .select('slug, updated_at')
      .eq('is_active', true)
      .limit(500)

    for (const b of (brokers ?? []) as Array<{ slug: string; updated_at?: string }>) {
      dynamicPages.push({
        url: `${baseUrl}${teamPath(b.slug)}`,
        lastModified: b.updated_at ? new Date(b.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Listings
    const { data: listings } = await supabase
      .from('listings')
      .select('listing_key, list_number, subdivision_name, city, state, postal_code, street_number, street_name, updated_at')
      .or(ACTIVE_STATUS_OR)
      .limit(50000)

    for (const r of (listings ?? []) as Array<{
      listing_key: string
      list_number?: string | null
      subdivision_name?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      street_number?: string | null
      street_name?: string | null
      updated_at?: string
    }>) {
      dynamicPages.push({
        url: `${baseUrl}${listingDetailPath(
          r.listing_key,
          { streetNumber: r.street_number ?? null, streetName: r.street_name ?? null, city: r.city ?? null, state: r.state ?? null, postalCode: r.postal_code ?? null },
          { city: r.city ?? null, subdivision: r.subdivision_name ?? null },
          { mlsNumber: r.list_number ?? null }
        )}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : now,
        changeFrequency: 'daily',
        priority: 0.7,
      })
    }

    // ZIP codes
    const { data: zipRows } = await supabase
      .from('listings')
      .select('PostalCode')
      .or(ACTIVE_STATUS_OR)
      .not('PostalCode', 'is', null)
      .limit(10000)

    const zips = Array.from(
      new Set(
        ((zipRows ?? []) as Array<{ PostalCode?: string | null }>)
          .map((r) => (r.PostalCode ?? '').replace(/\D/g, '').slice(0, 5))
          .filter((z) => z.length === 5)
      )
    )
    for (const zip of zips) {
      dynamicPages.push({
        url: `${baseUrl}/zip/${zip}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    // Blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .eq('status', 'published')
      .limit(500)

    for (const p of (posts ?? []) as Array<{ slug: string; published_at?: string | null }>) {
      dynamicPages.push({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: p.published_at ? new Date(p.published_at) : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    }

    // Guides
    const { data: guides } = await supabase
      .from('guides')
      .select('slug, published_at, updated_at')
      .eq('status', 'published')
      .limit(1000)

    for (const g of (guides ?? []) as Array<{ slug: string; published_at?: string | null; updated_at?: string | null }>) {
      dynamicPages.push({
        url: `${baseUrl}/guides/${g.slug}`,
        lastModified: g.updated_at ? new Date(g.updated_at) : g.published_at ? new Date(g.published_at) : now,
        changeFrequency: 'monthly',
        priority: 0.65,
      })
    }

    // Market reports
    const { data: reports } = await supabase
      .from('market_reports')
      .select('slug, created_at')
      .limit(500)

    for (const r of (reports ?? []) as Array<{ slug: string; created_at?: string | null }>) {
      dynamicPages.push({
        url: `${baseUrl}/housing-market/reports/${r.slug}`,
        lastModified: r.created_at ? new Date(r.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  } catch (e) {
    console.error('[sitemap] Error generating dynamic pages:', e)
    // Return static pages only if database query fails
  }

  return [...staticPages, ...dynamicPages]
}
