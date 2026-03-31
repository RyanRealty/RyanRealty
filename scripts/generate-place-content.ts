/**
 * Content generation script for city, community, and neighborhood landing pages.
 *
 * Usage:
 *   npx tsx scripts/generate-place-content.ts                    # Generate for all places
 *   npx tsx scripts/generate-place-content.ts --type city        # Only cities
 *   npx tsx scripts/generate-place-content.ts --type community   # Only communities
 *   npx tsx scripts/generate-place-content.ts --type neighborhood # Only neighborhoods
 *   npx tsx scripts/generate-place-content.ts --place "bend"     # Specific place key
 *   npx tsx scripts/generate-place-content.ts --dry-run          # Preview without writing
 *   npx tsx scripts/generate-place-content.ts --force            # Overwrite existing content
 *
 * Requires: XAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const MODEL = 'grok-2-1212'
const MAX_TOKENS = 1200

const TONE = `Write in a warm, factual, welcoming tone appropriate for a real estate website. Be specific, accurate, and useful. Provide real information that helps someone considering moving to or buying property in this area. Do not use hype words like stunning, nestled, boasts, must see, exclusive, unparalleled, world-class, exquisite, or once in a lifetime. Write substantive content that search engines and LLMs will value for its accuracy and depth.`

type PlaceInfo = {
  place_type: 'city' | 'community' | 'neighborhood'
  place_key: string
  place_name: string
  city_name: string | null
}

async function generateGrokText(prompt: string, maxTokens = MAX_TOKENS): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey?.trim()) throw new Error('XAI_API_KEY not set')

  const res = await fetch(XAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a knowledgeable real estate content writer specializing in Central Oregon communities. You provide accurate, well-researched information about places in Oregon. Always be factual and specific. If you are not certain about a specific detail, omit it rather than fabricate it.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`xAI API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data?.choices?.[0]?.message?.content?.trim() ?? ''
}

async function generateGrokJson<T>(prompt: string, maxTokens = MAX_TOKENS): Promise<T | null> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey?.trim()) throw new Error('XAI_API_KEY not set')

  const res = await fetch(XAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a knowledgeable real estate content writer. Return ONLY valid JSON, no markdown, no code fences, no explanation. If you are not certain about specific details, omit entries rather than fabricate them.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? ''
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned) as T
  } catch {
    console.warn('  ⚠ Failed to parse JSON response, skipping structured data')
    return null
  }
}

function buildOverviewPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`
  const typeLabel = place.place_type === 'community' ? 'community/subdivision' : place.place_type

  return `Write a comprehensive overview of ${location} for a real estate website landing page. This is a ${typeLabel}.

Include the following in 3-5 well-structured paragraphs:
1. What the area is like, its character, and what makes it distinctive
2. The general vibe and atmosphere: who lives here, what the community feels like
3. Geographic setting: what surrounds it, notable natural features, proximity to key areas
4. Why someone would want to live here: quality of life factors
5. Any notable facts that make this place interesting or unique

${TONE}

Do NOT include bullet points or headers. Write flowing, informative paragraphs.`
}

function buildHistoryPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write a brief history of ${location} in 2-3 paragraphs. Cover:
- When and how the area was established or developed
- Key historical milestones or turning points
- How the community has evolved over time
- What has shaped its current character

${TONE} Be factual. If this is a newer subdivision or community, focus on the development history and the vision behind it. Write flowing paragraphs, no bullet points or headers.`
}

function buildLifestylePrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Describe the lifestyle and daily life in ${location} in 2-3 paragraphs. Cover:
- What a typical day or week looks like for residents
- The pace of life, community engagement
- Popular activities and how people spend their time
- The general atmosphere and culture

${TONE} Write flowing paragraphs, no bullet points.`
}

function buildSchoolsPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name}, ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about schools and education options in or near ${location} in 2-3 paragraphs. Cover:
- Which school district(s) serve the area
- Notable public schools (elementary, middle, high school)
- Any private or charter school options
- General reputation of the schools and education quality
- Any higher education institutions nearby

${TONE} Be factual. Only mention specific schools you are confident exist. Write flowing paragraphs, no bullet points.`
}

function buildOutdoorRecPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about outdoor recreation and activities in and around ${location} in 2-3 paragraphs. Cover:
- Parks, trails, and green spaces in the immediate area
- Nearby hiking, biking, skiing, fishing, or water sports
- Seasonal outdoor activities available
- Any notable natural attractions or recreational facilities

${TONE} Be specific about actual locations and activities. Write flowing paragraphs, no bullet points.`
}

function buildDiningPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about the dining and food scene in and around ${location} in 2-3 paragraphs. Cover:
- The general character of the dining options (casual, upscale, family-friendly, etc.)
- Types of cuisine available
- Any notable restaurants, breweries, cafes, or food-related businesses
- Farmers markets or local food culture

${TONE} Only mention specific restaurants or businesses you are confident exist. Write flowing paragraphs, no bullet points.`
}

function buildShoppingPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about shopping and services in and around ${location} in 1-2 paragraphs. Cover:
- Nearby shopping centers, grocery stores, or retail districts
- Local boutiques or specialty shops
- Proximity to major retail and essential services

${TONE} Be factual. Write flowing paragraphs, no bullet points.`
}

function buildArtsCulturePrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about arts, culture, and entertainment in and around ${location} in 1-2 paragraphs. Cover:
- Galleries, theaters, museums, or cultural venues
- Music and arts community
- Libraries and cultural programs

${TONE} Be factual. Write flowing paragraphs, no bullet points.`
}

function buildTransportationPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about transportation and getting around in ${location} in 1-2 paragraphs. Cover:
- Major highways and road access
- Distance to the nearest commercial airport
- Public transit options (if any)
- Bikeability and walkability
- Commute times to nearby cities

${TONE} Be factual and specific. Write flowing paragraphs, no bullet points.`
}

function buildHealthcarePrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about healthcare and medical services in or near ${location} in 1-2 paragraphs. Cover:
- Nearest hospitals and major medical facilities
- Availability of clinics, urgent care, and specialists
- General healthcare access for residents

${TONE} Be factual. Write flowing paragraphs, no bullet points.`
}

function buildEventsPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about events, festivals, and community gatherings in and around ${location} in 1-2 paragraphs. Cover:
- Annual events or festivals
- Regular community gatherings (markets, concerts, etc.)
- Seasonal celebrations

${TONE} Only mention events you are confident exist. Write flowing paragraphs, no bullet points.`
}

function buildFamilyLifePrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Write about family life in ${location} in 1-2 paragraphs. Cover:
- Is it family-friendly? Why?
- Kid-friendly activities and resources
- Childcare and youth programs
- Safety and community feel for families

${TONE} Write flowing paragraphs, no bullet points.`
}

function buildRealEstatePrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`
  const typeLabel = place.place_type === 'community' ? 'community/subdivision' : place.place_type

  return `Write a real estate market overview for ${location} (a ${typeLabel}) in 2-3 paragraphs. Cover:
- Types of properties commonly available (single-family, townhomes, condos, land, etc.)
- General character of the housing stock (newer construction, established, mixed)
- Any HOA or community association information if applicable
- What makes buying here attractive from a real estate perspective
- General price positioning relative to the broader Central Oregon market

${TONE} Do not quote specific prices (those come from live data). Write flowing paragraphs, no bullet points.`
}

function buildSchoolsDataPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Return a JSON array of schools serving ${location}. Include only schools you are confident exist. Format:
[{"name": "School Name", "type": "public|private|charter", "grades": "K-5|6-8|9-12|K-12", "notes": "brief note"}]
Return at most 8 schools. Return an empty array [] if you are not confident about schools in this area.`
}

function buildDiningDataPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Return a JSON array of notable restaurants and dining options in or very near ${location}. Include only places you are confident exist. Format:
[{"name": "Restaurant Name", "cuisine": "American|Italian|Mexican|etc", "price": "$|$$|$$$", "notes": "brief description"}]
Return at most 8 restaurants. Return an empty array [] if you are not confident about dining options.`
}

function buildRecreationDataPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`

  return `Return a JSON array of outdoor recreation options in or near ${location}. Include only places/activities you are confident exist. Format:
[{"name": "Trail/Park/Activity Name", "type": "Hiking|Biking|Skiing|Fishing|Park|Golf|etc", "notes": "brief description"}]
Return at most 8 items. Return an empty array [] if you are not confident about recreation options.`
}

function buildFaqsPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`
  const typeLabel = place.place_type === 'community' ? 'community' : place.place_type

  return `Generate 5-7 frequently asked questions and answers about living in ${location} for a real estate website. Questions should cover topics like:
- Cost of living / home prices
- Schools and education
- Outdoor activities
- Climate and weather
- Commute and transportation
- Community character

Format as a JSON array:
[{"question": "What is it like to live in ${place.place_name}?", "answer": "Detailed, factual answer..."}]

${TONE} Each answer should be 2-4 sentences. Be factual.`
}

function buildSeoPrompt(place: PlaceInfo): string {
  const location = place.city_name ? `${place.place_name} in ${place.city_name}, Oregon` : `${place.place_name}, Oregon`
  const typeLabel = place.place_type === 'community' ? 'community' : place.place_type

  return `Generate SEO metadata for a real estate landing page about ${location} (a ${typeLabel}). Return JSON:
{"seo_title": "Page Title | Ryan Realty", "seo_description": "Meta description under 160 chars", "seo_keywords": ["keyword1", "keyword2", ...]}
The title should include "${place.place_name}" and "homes for sale" or "real estate". Keywords should be relevant search terms (5-10 keywords).`
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = ReturnType<typeof createClient>

async function generateContentForPlace(
  sb: SbClient,
  place: PlaceInfo,
  force: boolean,
  dryRun: boolean
): Promise<boolean> {
  const { place_type, place_key, place_name, city_name } = place
  const label = city_name ? `${place_name} (${city_name})` : place_name

  // Check for existing content
  const { data: existing } = await sb
    .from('place_content')
    .select('id, overview')
    .eq('place_type', place_type)
    .eq('place_key', place_key)
    .maybeSingle()

  const existingRow = existing as { id: string; overview: string | null } | null
  if (existingRow?.overview && !force) {
    console.log(`  ⏭ ${label}: already has content, skipping (use --force to overwrite)`)
    return false
  }

  console.log(`  📝 Generating content for ${label}...`)

  if (dryRun) {
    console.log(`    [DRY RUN] Would generate overview, history, lifestyle, schools, outdoor rec, dining, shopping, arts, transportation, healthcare, events, family, real estate, FAQs, SEO`)
    return false
  }

  const delayMs = 1500

  try {
    // Generate text content sections in batches to avoid rate limits
    console.log(`    → Overview...`)
    const overview = await generateGrokText(buildOverviewPrompt(place))
    await sleep(delayMs)

    console.log(`    → History...`)
    const history = await generateGrokText(buildHistoryPrompt(place))
    await sleep(delayMs)

    console.log(`    → Lifestyle...`)
    const lifestyle = await generateGrokText(buildLifestylePrompt(place))
    await sleep(delayMs)

    console.log(`    → Schools...`)
    const schools = await generateGrokText(buildSchoolsPrompt(place))
    await sleep(delayMs)

    console.log(`    → Outdoor recreation...`)
    const outdoor_recreation = await generateGrokText(buildOutdoorRecPrompt(place))
    await sleep(delayMs)

    console.log(`    → Dining...`)
    const dining = await generateGrokText(buildDiningPrompt(place))
    await sleep(delayMs)

    console.log(`    → Shopping...`)
    const shopping = await generateGrokText(buildShoppingPrompt(place))
    await sleep(delayMs)

    console.log(`    → Arts & culture...`)
    const arts_culture = await generateGrokText(buildArtsCulturePrompt(place))
    await sleep(delayMs)

    console.log(`    → Transportation...`)
    const transportation = await generateGrokText(buildTransportationPrompt(place))
    await sleep(delayMs)

    console.log(`    → Healthcare...`)
    const healthcare = await generateGrokText(buildHealthcarePrompt(place))
    await sleep(delayMs)

    console.log(`    → Events & festivals...`)
    const events_festivals = await generateGrokText(buildEventsPrompt(place))
    await sleep(delayMs)

    console.log(`    → Family life...`)
    const family_life = await generateGrokText(buildFamilyLifePrompt(place))
    await sleep(delayMs)

    console.log(`    → Real estate overview...`)
    const real_estate_overview = await generateGrokText(buildRealEstatePrompt(place))
    await sleep(delayMs)

    // Generate structured data
    console.log(`    → Schools data (JSON)...`)
    const schools_data = await generateGrokJson<Array<{ name: string; type?: string; grades?: string; notes?: string }>>(buildSchoolsDataPrompt(place))
    await sleep(delayMs)

    console.log(`    → Dining data (JSON)...`)
    const dining_data = await generateGrokJson<Array<{ name: string; cuisine?: string; price?: string; notes?: string }>>(buildDiningDataPrompt(place))
    await sleep(delayMs)

    console.log(`    → Recreation data (JSON)...`)
    const recreation_data = await generateGrokJson<Array<{ name: string; type?: string; notes?: string }>>(buildRecreationDataPrompt(place))
    await sleep(delayMs)

    console.log(`    → FAQs (JSON)...`)
    const faqs = await generateGrokJson<Array<{ question: string; answer: string }>>(buildFaqsPrompt(place))
    await sleep(delayMs)

    console.log(`    → SEO metadata...`)
    const seoData = await generateGrokJson<{ seo_title?: string; seo_description?: string; seo_keywords?: string[] }>(buildSeoPrompt(place))
    await sleep(delayMs)

    // Upsert to database
    console.log(`    → Saving to database...`)
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      place_type,
      place_key,
      place_name,
      city_name,
      overview: overview || null,
      history: history || null,
      lifestyle: lifestyle || null,
      schools: schools || null,
      outdoor_recreation: outdoor_recreation || null,
      dining: dining || null,
      shopping: shopping || null,
      arts_culture: arts_culture || null,
      transportation: transportation || null,
      healthcare: healthcare || null,
      events_festivals: events_festivals || null,
      family_life: family_life || null,
      real_estate_overview: real_estate_overview || null,
      schools_data: schools_data ?? null,
      dining_data: dining_data ?? null,
      recreation_data: recreation_data ?? null,
      events_data: null,
      faqs: faqs ?? null,
      seo_title: seoData?.seo_title ?? null,
      seo_description: seoData?.seo_description ?? null,
      seo_keywords: seoData?.seo_keywords ?? null,
      generated_at: now,
      generated_by: MODEL,
      updated_at: now,
    }
    const { error } = await sb.from('place_content').upsert(row, { onConflict: 'place_type,place_key' })

    if (error) {
      console.error(`    ✗ Error saving: ${error.message}`)
      return false
    }

    console.log(`    ✓ Content saved for ${label}`)
    return true
  } catch (err) {
    console.error(`    ✗ Error generating content for ${label}:`, err instanceof Error ? err.message : err)
    return false
  }
}

function slugify(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function paginatedSelect(
  sb: SbClient,
  table: string,
  columns: string,
  filters?: (q: ReturnType<SbClient['from']>) => ReturnType<SbClient['from']>
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000
  const results: Record<string, unknown>[] = []
  let page = 0
  while (true) {
    let query = sb.from(table).select(columns).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (filters) query = filters(query) as typeof query
    const { data, error } = await query
    if (error || !data || data.length === 0) break
    results.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE_SIZE) break
    page++
    if (page > 1000) break
  }
  return results
}

async function getAllPlaces(sb: SbClient): Promise<PlaceInfo[]> {
  const places: PlaceInfo[] = []

  // Get all cities from listings (paginated to get all)
  console.log('📊 Fetching cities from listings...')
  const cityRows = await paginatedSelect(sb, 'listings', '"City"')

  const cityNames = new Set<string>()
  for (const row of cityRows) {
    const city = (row as { City?: string }).City
    if (city?.trim()) cityNames.add(city.trim())
  }

  for (const cityName of cityNames) {
    places.push({
      place_type: 'city',
      place_key: slugify(cityName),
      place_name: cityName,
      city_name: null,
    })
  }
  console.log(`  Found ${cityNames.size} cities`)

  // Get all communities (subdivisions) from listings (paginated)
  console.log('📊 Fetching communities from listings...')
  const communityRows = await paginatedSelect(sb, 'listings', '"City", "SubdivisionName"')

  const communitySet = new Set<string>()
  for (const row of communityRows) {
    const r = row as { City?: string; SubdivisionName?: string }
    const city = r.City?.trim()
    const sub = r.SubdivisionName?.trim()
    if (city && sub) {
      const key = `${slugify(city)}:${slugify(sub)}`
      if (!communitySet.has(key)) {
        communitySet.add(key)
        places.push({
          place_type: 'community',
          place_key: key,
          place_name: sub,
          city_name: city,
        })
      }
    }
  }
  console.log(`  Found ${communitySet.size} communities`)

  // Get neighborhoods from neighborhoods table
  console.log('📊 Fetching neighborhoods...')
  const { data: neighborhoodRows } = await sb
    .from('neighborhoods')
    .select('id, name, slug, city_id')

  if (neighborhoodRows && neighborhoodRows.length > 0) {
    // Get city names for neighborhoods
    const cityIds = [...new Set(neighborhoodRows.map((n) => (n as { city_id: string }).city_id).filter(Boolean))]
    const { data: cityData } = await sb
      .from('cities')
      .select('id, name')
      .in('id', cityIds)

    const cityMap = new Map<string, string>()
    for (const c of cityData ?? []) {
      const row = c as { id: string; name: string }
      cityMap.set(row.id, row.name)
    }

    for (const n of neighborhoodRows) {
      const row = n as { id: string; name: string; slug: string; city_id: string }
      const cityName = cityMap.get(row.city_id)
      if (cityName) {
        places.push({
          place_type: 'neighborhood',
          place_key: `${slugify(cityName)}:${row.slug}`,
          place_name: row.name,
          city_name: cityName,
        })
      }
    }
    console.log(`  Found ${neighborhoodRows.length} neighborhoods`)
  } else {
    console.log('  No neighborhoods found in database')
  }

  return places
}

async function main() {
  const args = process.argv.slice(2)
  const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null
  const placeFilter = args.includes('--place') ? args[args.indexOf('--place') + 1] : null
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  console.log('🏠 Place Content Generator')
  console.log('='.repeat(60))
  if (dryRun) console.log('🔍 DRY RUN MODE — no content will be written')
  if (force) console.log('⚡ FORCE MODE — existing content will be overwritten')
  if (typeFilter) console.log(`📋 Filtering to type: ${typeFilter}`)
  if (placeFilter) console.log(`📍 Filtering to place: ${placeFilter}`)
  console.log()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.XAI_API_KEY

  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }
  if (!apiKey?.trim()) {
    console.error('❌ XAI_API_KEY is required for content generation')
    process.exit(1)
  }

  const sb = createClient(supabaseUrl, serviceKey)

  let places = await getAllPlaces(sb)

  if (typeFilter) {
    places = places.filter((p) => p.place_type === typeFilter)
  }
  if (placeFilter) {
    const filterLower = placeFilter.toLowerCase()
    places = places.filter(
      (p) =>
        p.place_key.includes(filterLower) ||
        p.place_name.toLowerCase().includes(filterLower)
    )
  }

  console.log(`\n📝 Processing ${places.length} places...\n`)

  let generated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < places.length; i++) {
    const place = places[i]!
    console.log(`[${i + 1}/${places.length}] ${place.place_type}: ${place.place_name}${place.city_name ? ` (${place.city_name})` : ''}`)

    try {
      const didGenerate = await generateContentForPlace(sb, place, force, dryRun)
      if (didGenerate) generated++
      else skipped++
    } catch (err) {
      console.error(`  ✗ Failed:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`  ✓ Generated: ${generated}`)
  console.log(`  ⏭ Skipped:   ${skipped}`)
  console.log(`  ✗ Failed:    ${failed}`)
  console.log(`  Total:       ${places.length}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
