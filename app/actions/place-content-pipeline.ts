'use server'

/**
 * Background place-content pipeline: research and write robust, brand-voice copy
 * for every city, neighborhood, community, and resort community. Runs in chunks via cron;
 * not done on-the-fly at page generation. Uses listing and report data to enrich copy.
 */

import { createClient } from '@supabase/supabase-js'
import { getBrowseCities } from './listings'
import { getSubdivisionsInCity } from './listings'
import { getMarketStatsForCity } from './market-stats'
import { getNeighborhoodBySlug } from './cities'
import { subdivisionEntityKey } from '@/lib/slug'
import { generateGrokText } from '@/lib/grok-text'

const BRAND_VOICE =
  'Write in a warm, factual, and welcoming tone. Be specific and accurate. Do not use hype words like stunning, nestled, boasts, don\'t miss, must see, exclusive, unparalleled, world-class, exquisite, or once in a lifetime. CTAs should be specific (e.g. "See all Bend listings" not "Learn more"). Write for search engines and readers; aim for substantive, useful copy that helps buyers and sellers understand the area.'

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export type PlaceContentChunkOptions = {
  limitCities?: number
  limitNeighborhoods?: number
  limitCommunities?: number
}

export type PlaceContentChunkResult = {
  updated: number
  failed: number
  errors: string[]
  citiesProcessed: number
  neighborhoodsProcessed: number
  communitiesProcessed: number
}

/** List all cities from DB (id, name, slug) for content refresh. */
export async function listCitiesForContentRefresh(): Promise<
  { id: string; name: string; slug: string }[]
> {
  void serviceSupabase
  const { getAllCitiesForAdminUpload } = await import('@/lib/data')
  const cities = await getAllCitiesForAdminUpload()
  return cities
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** List all neighborhoods from DB with city slug for content refresh. */
export async function listNeighborhoodsForContentRefresh(): Promise<
  { id: string; name: string; slug: string; cityName: string; citySlug: string }[]
> {
  void serviceSupabase
  const { getAllNeighborhoodsWithCity } = await import('@/lib/data')
  const list = await getAllNeighborhoodsWithCity()
  return list
    .map((r) => {
      const city = Array.isArray(r.cities) ? r.cities[0] : r.cities
      if (!city?.name || !city?.slug) return null
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        cityName: city.name,
        citySlug: city.slug,
      }
    })
    .filter((row): row is { id: string; name: string; slug: string; cityName: string; citySlug: string } => row !== null)
}

/** List all community (subdivision) entity keys for content refresh. */
export async function listCommunitiesForContentRefresh(): Promise<
  { city: string; subdivisionName: string; entityKey: string }[]
> {
  const cities = await getBrowseCities()
  const out: { city: string; subdivisionName: string; entityKey: string }[] = []
  const seen = new Set<string>()
  for (const { City } of cities) {
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      const entityKey = subdivisionEntityKey(City, subdivisionName)
      if (seen.has(entityKey)) continue
      seen.add(entityKey)
      out.push({ city: City, subdivisionName, entityKey })
    }
  }
  return out
}

/** Generate and write city content (description + SEO). */
async function generateAndWriteCityContent(
  cityId: string,
  cityName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const stats = await getMarketStatsForCity(cityName)
    const priceStr =
      stats.medianPrice != null && Number.isFinite(stats.medianPrice)
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
            stats.medianPrice
          )
        : null
    const dataBlurb = [
      `Active listings: ${stats.count}`,
      priceStr ? `Median list price: ${priceStr}` : '',
      stats.closedLast12Months > 0 ? `Closed in last 12 months: ${stats.closedLast12Months}` : '',
    ]
      .filter(Boolean)
      .join('. ')

    const prompt = `Write a thorough, SEO-friendly "About ${cityName}" section for a Central Oregon real estate website. Include: (1) what the city is like—character, location, and why people live or visit; (2) demographics and community (who lives there, families, retirees, remote workers—only if you can be accurate); (3) things to do—parks, trails, dining, events—only if factual; (4) real estate context—types of homes, market note. Use this current market data: ${dataBlurb}. ${BRAND_VOICE} Write 4–6 substantial paragraphs. No bullet points or headers. Output only the body copy.`

    const description = await generateGrokText({ prompt, max_tokens: 550 })
    if (!description?.trim()) return { ok: false, error: 'Generated description was empty.' }

    void serviceSupabase
    const { updateCityById } = await import('@/lib/data')

    const seoTitle = `Homes for Sale in ${cityName}, Oregon | Ryan Realty`
    const seoDesc =
      stats.count > 0 && priceStr
        ? `${stats.count} homes for sale in ${cityName}. Median price ${priceStr}. Explore communities and market stats.`
        : `Explore ${cityName}, Oregon. Communities, neighborhoods, and real estate overview.`

    await updateCityById(cityId, {
      description: description.trim(),
      seo_title: seoTitle,
      seo_description: seoDesc,
      updated_at: new Date().toISOString(),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Generate and write neighborhood content (description + SEO). */
async function generateAndWriteNeighborhoodContent(
  neighborhoodId: string,
  neighborhoodName: string,
  neighborhoodSlug: string,
  cityName: string,
  citySlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const detail = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
    const activeCount = detail?.activeCount ?? 0
    const priceStr =
      detail?.medianPrice != null && Number.isFinite(detail.medianPrice)
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
            detail.medianPrice
          )
        : null
    const dataBlurb = [
      activeCount > 0 ? `${activeCount} active listings` : '',
      priceStr ? `median list price ${priceStr}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    const prompt = `Write a thorough, SEO-friendly "About ${neighborhoodName}" section for a real estate website. ${neighborhoodName} is a neighborhood in ${cityName}, Central Oregon. Include: (1) where it is and what it's like—character, housing mix; (2) who lives there and why (only if accurate); (3) nearby schools, parks, or amenities if relevant; (4) real estate context. Use this data: ${dataBlurb || 'current market data on the site.'} ${BRAND_VOICE} Write 3–5 substantial paragraphs. No bullet points or headers. Output only the body copy.`

    const description = await generateGrokText({ prompt, max_tokens: 450 })
    if (!description?.trim()) return { ok: false, error: 'Generated description was empty.' }

    void serviceSupabase
    const { updateNeighborhoodById } = await import('@/lib/data')

    const seoTitle = `${neighborhoodName} Homes for Sale | ${cityName}, Oregon | Ryan Realty`
    const seoDesc =
      dataBlurb
        ? `${neighborhoodName} in ${cityName}: ${dataBlurb}. Browse listings and market info.`
        : `Explore ${neighborhoodName}, ${cityName}, Oregon. Neighborhood info and homes for sale.`

    await updateNeighborhoodById(neighborhoodId, {
      description: description.trim(),
      seo_title: seoTitle,
      seo_description: seoDesc,
      updated_at: new Date().toISOString(),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Run one chunk of the place-content pipeline: cities, neighborhoods, and communities. */
export async function runPlaceContentChunk(
  options: PlaceContentChunkOptions
): Promise<PlaceContentChunkResult> {
  const limitCities = options.limitCities ?? 2
  const limitNeighborhoods = options.limitNeighborhoods ?? 5
  const limitCommunities = options.limitCommunities ?? 15
  const errors: string[] = []
  let updated = 0
  let failed = 0
  let citiesProcessed = 0
  let neighborhoodsProcessed = 0
  let communitiesProcessed = 0

  const [cities, neighborhoods, communities] = await Promise.all([
    listCitiesForContentRefresh(),
    listNeighborhoodsForContentRefresh(),
    listCommunitiesForContentRefresh(),
  ])

  for (let i = 0; i < Math.min(limitCities, cities.length); i++) {
    const c = cities[i]!
    citiesProcessed++
    const r = await generateAndWriteCityContent(c.id, c.name)
    if (r.ok) updated++
    else {
      failed++
      errors.push(`city ${c.name}: ${r.error}`)
    }
  }

  for (let i = 0; i < Math.min(limitNeighborhoods, neighborhoods.length); i++) {
    const n = neighborhoods[i]!
    neighborhoodsProcessed++
    const r = await generateAndWriteNeighborhoodContent(n.id, n.name, n.slug, n.cityName, n.citySlug)
    if (r.ok) updated++
    else {
      failed++
      errors.push(`neighborhood ${n.cityName}/${n.name}: ${r.error}`)
    }
  }

  const { generateSubdivisionDescription, generateSubdivisionAttractions } = await import(
    './subdivision-descriptions'
  )
  const { getSubdivisionTabContent } = await import('./subdivision-descriptions')
  for (let i = 0; i < Math.min(limitCommunities, communities.length); i++) {
    const { city, subdivisionName, entityKey } = communities[i]!
    communitiesProcessed++
    try {
      const content = await getSubdivisionTabContent(city, subdivisionName)
      if (!content.about?.trim()) {
        const r = await generateSubdivisionDescription(city, subdivisionName)
        if (r.ok) updated++
        else {
          failed++
          errors.push(`${entityKey} about: ${r.error}`)
        }
      }
      if (!content.attractions?.trim()) {
        const r = await generateSubdivisionAttractions(city, subdivisionName)
        if (r.ok) updated++
        else {
          failed++
          errors.push(`${entityKey} attractions: ${r.error}`)
        }
      }
    } catch (e) {
      failed++
      errors.push(`${entityKey}: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  return {
    updated,
    failed,
    errors,
    citiesProcessed,
    neighborhoodsProcessed,
    communitiesProcessed,
  }
}
