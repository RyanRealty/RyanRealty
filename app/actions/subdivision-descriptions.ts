'use server'

import { createClient } from '@supabase/supabase-js'
import { subdivisionEntityKey } from '../../lib/slug'
import { generateGrokText } from '../../lib/grok-text'

const TONE =
  'Use a warm, friendly, welcoming, and honest tone. Write as if you are helping a potential resident or visitor feel at home. Be factual and avoid hype.'

export type SubdivisionTabContent = {
  about: string | null
  attractions: string | null
  dining: string | null
}

export async function getSubdivisionDescription(
  city: string,
  subdivisionName: string
): Promise<string | null> {
  const content = await getSubdivisionTabContent(city, subdivisionName)
  return content.about
}

/** Get all tab content for a subdivision (about, attractions, dining). */
export async function getSubdivisionTabContent(
  city: string,
  subdivisionName: string
): Promise<SubdivisionTabContent> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return { about: null, attractions: null, dining: null }
  }

  try {
    const entityKey = subdivisionEntityKey(city, subdivisionName)
    const supabase = createClient(url, anonKey)
    const { data, error } = await supabase
      .from('subdivision_descriptions')
      .select('description, attractions, dining')
      .eq('entity_key', entityKey)
      .maybeSingle()

    if (error) return { about: null, attractions: null, dining: null }
    const row = data as { description?: string; attractions?: string; dining?: string } | null
    return {
      about: row?.description ?? null,
      attractions: row?.attractions ?? null,
      dining: row?.dining ?? null,
    }
  } catch {
    return { about: null, attractions: null, dining: null }
  }
}

export async function generateSubdivisionDescription(
  city: string,
  subdivisionName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entityKey = subdivisionEntityKey(city, subdivisionName)
  const prompt = `Write a thorough "About" paragraph for the community "${subdivisionName}" in ${city}, Central Oregon, for a real estate website. Include: (1) what the area is like and its character, (2) accurate demographic information (who lives there—e.g. families, retirees, mix of ages, income level if relevant), (3) what the area is famous for or known for (landmarks, lifestyle, activities). ${TONE} Write 4–6 sentences. No bullet points or headers. Be factual and specific.`

  try {
    const description = await generateGrokText({ prompt, max_tokens: 200 })
    if (!description?.trim()) {
      return { ok: false, error: 'Generated description was empty.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
      return { ok: false, error: 'Supabase not configured for writes.' }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    await supabase.from('subdivision_descriptions').upsert(
      { entity_key: entityKey, description: description.trim() },
      { onConflict: 'entity_key' }
    )
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate description.'
    return { ok: false, error: message }
  }
}

export async function generateSubdivisionAttractions(
  city: string,
  subdivisionName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entityKey = subdivisionEntityKey(city, subdivisionName)
  const prompt = `Write a short paragraph about attractions and things to do in the "${subdivisionName}" area of ${city}, Central Oregon, for a real estate website. Mention parks, trails, nearby activities, or community events only if accurate. ${TONE} Keep it to 2–4 sentences. No bullet points or headers.`

  try {
    const attractions = await generateGrokText({ prompt, max_tokens: 200 })
    if (!attractions?.trim()) return { ok: false, error: 'Generated content was empty.' }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
      return { ok: false, error: 'Supabase not configured for writes.' }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase.from('subdivision_descriptions').select('description').eq('entity_key', entityKey).maybeSingle()
    const existing = (data as { description?: string } | null)?.description
    await supabase.from('subdivision_descriptions').upsert(
      { entity_key: entityKey, description: existing ?? '', attractions: attractions.trim() },
      { onConflict: 'entity_key' }
    )
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate.'
    return { ok: false, error: message }
  }
}

export async function generateSubdivisionDining(
  city: string,
  subdivisionName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entityKey = subdivisionEntityKey(city, subdivisionName)
  const prompt = `Write a short paragraph about dining and places to eat in or near "${subdivisionName}" in ${city}, Central Oregon, for a real estate website. Mention the kind of dining (casual, family-friendly, etc.) and vibe. ${TONE} Keep it to 2–4 sentences. No bullet points or headers.`

  try {
    const dining = await generateGrokText({ prompt, max_tokens: 200 })
    if (!dining?.trim()) return { ok: false, error: 'Generated content was empty.' }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
      return { ok: false, error: 'Supabase not configured for writes.' }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase.from('subdivision_descriptions').select('description, attractions').eq('entity_key', entityKey).maybeSingle()
    const row = data as { description?: string; attractions?: string } | null
    await supabase.from('subdivision_descriptions').upsert(
      {
        entity_key: entityKey,
        description: row?.description ?? '',
        attractions: row?.attractions ?? null,
        dining: dining.trim(),
      },
      { onConflict: 'entity_key' }
    )
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate.'
    return { ok: false, error: message }
  }
}
