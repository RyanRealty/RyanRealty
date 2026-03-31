'use server'

import { createClient } from '@supabase/supabase-js'
import { generateGrokText } from '@/lib/grok-text'

const TONE = `Write in a warm, factual, welcoming tone appropriate for a real estate website. Be specific, accurate, and useful. Do not use hype words like stunning, nestled, boasts, must see, exclusive, unparalleled, world-class, exquisite, or once in a lifetime. Write substantive content that search engines and LLMs will value for its accuracy and depth.`

type PlaceInput = {
  placeType: 'city' | 'community' | 'neighborhood'
  placeKey: string
  placeName: string
  cityName: string | null
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

async function generateJson<T>(prompt: string): Promise<T | null> {
  try {
    const raw = await generateGrokText({
      prompt: `You are a knowledgeable real estate content writer. Return ONLY valid JSON, no markdown, no code fences. If uncertain about details, omit entries.\n\n${prompt}`,
      max_tokens: 1200,
    })
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

export async function generatePlaceContentSingle(
  input: PlaceInput
): Promise<{ error: string | null }> {
  const sb = getServiceSupabase()
  if (!sb) return { error: 'Supabase service client not configured' }

  const { placeType, placeKey, placeName, cityName } = input
  const location = cityName ? `${placeName} in ${cityName}, Oregon` : `${placeName}, Oregon`
  const typeLabel = placeType === 'community' ? 'community/subdivision' : placeType

  try {
    const overview = await generateGrokText({
      prompt: `Write a comprehensive overview of ${location} for a real estate landing page. This is a ${typeLabel}. Include: what the area is like, its character, geographic setting, why someone would want to live here, and notable facts. ${TONE} Write 3-5 flowing paragraphs, no bullet points or headers.`,
      max_tokens: 1200,
    })

    const history = await generateGrokText({
      prompt: `Write a brief history of ${location} in 2-3 paragraphs. Cover establishment, key milestones, and evolution. ${TONE}`,
      max_tokens: 800,
    })

    const lifestyle = await generateGrokText({
      prompt: `Describe the lifestyle and daily life in ${location} in 2-3 paragraphs. ${TONE}`,
      max_tokens: 800,
    })

    const schools = await generateGrokText({
      prompt: `Write about schools and education near ${location} in 2-3 paragraphs. ${TONE} Only mention schools you are confident exist.`,
      max_tokens: 800,
    })

    const outdoor_recreation = await generateGrokText({
      prompt: `Write about outdoor recreation near ${location} in 2-3 paragraphs. ${TONE} Be specific about actual locations.`,
      max_tokens: 800,
    })

    const dining = await generateGrokText({
      prompt: `Write about the dining scene near ${location} in 2-3 paragraphs. ${TONE} Only mention places you are confident exist.`,
      max_tokens: 800,
    })

    const shopping = await generateGrokText({
      prompt: `Write about shopping and services near ${location} in 1-2 paragraphs. ${TONE}`,
      max_tokens: 600,
    })

    const transportation = await generateGrokText({
      prompt: `Write about transportation and getting around in ${location} in 1-2 paragraphs. ${TONE}`,
      max_tokens: 600,
    })

    const healthcare = await generateGrokText({
      prompt: `Write about healthcare near ${location} in 1-2 paragraphs. ${TONE}`,
      max_tokens: 600,
    })

    const events_festivals = await generateGrokText({
      prompt: `Write about events and community gatherings near ${location} in 1-2 paragraphs. ${TONE} Only mention events you are confident exist.`,
      max_tokens: 600,
    })

    const family_life = await generateGrokText({
      prompt: `Write about family life in ${location} in 1-2 paragraphs. ${TONE}`,
      max_tokens: 600,
    })

    const arts_culture = await generateGrokText({
      prompt: `Write about arts, culture, and entertainment in and around ${location} in 1-2 paragraphs. Cover galleries, theaters, music, and cultural programs. ${TONE}`,
      max_tokens: 600,
    })

    const real_estate_overview = await generateGrokText({
      prompt: `Write a real estate overview for ${location} (a ${typeLabel}) in 2-3 paragraphs. Do not quote specific prices. ${TONE}`,
      max_tokens: 800,
    })

    const faqs = await generateJson<Array<{ question: string; answer: string }>>(
      `Generate 5-7 FAQs about living in ${location} as JSON array: [{"question":"...","answer":"..."}]. ${TONE}`
    )

    const seoData = await generateJson<{ seo_title?: string; seo_description?: string; seo_keywords?: string[] }>(
      `Generate SEO for a real estate page about ${location}. JSON: {"seo_title":"... | Ryan Realty","seo_description":"under 160 chars","seo_keywords":["keyword1","keyword2"]}`
    )

    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      place_type: placeType,
      place_key: placeKey,
      place_name: placeName,
      city_name: cityName,
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
      faqs: faqs ?? null,
      seo_title: seoData?.seo_title ?? null,
      seo_description: seoData?.seo_description ?? null,
      seo_keywords: seoData?.seo_keywords ?? null,
      generated_at: now,
      generated_by: 'grok-2-1212',
      updated_at: now,
    }

    const { error } = await sb.from('place_content').upsert(row, { onConflict: 'place_type,place_key' })

    if (error) {
      console.error('[generatePlaceContentSingle]', error)
      return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    console.error('[generatePlaceContentSingle]', err)
    return { error: err instanceof Error ? err.message : 'Failed to generate content' }
  }
}
