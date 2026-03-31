'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export type PlaceContentRow = {
  id: string
  place_type: 'city' | 'community' | 'neighborhood'
  place_key: string
  place_name: string
  city_name: string | null
  overview: string | null
  history: string | null
  lifestyle: string | null
  schools: string | null
  outdoor_recreation: string | null
  dining: string | null
  shopping: string | null
  arts_culture: string | null
  transportation: string | null
  healthcare: string | null
  events_festivals: string | null
  family_life: string | null
  real_estate_overview: string | null
  schools_data: SchoolItem[] | null
  dining_data: DiningItem[] | null
  recreation_data: RecreationItem[] | null
  events_data: EventItem[] | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[] | null
  faqs: FaqItem[] | null
  generated_at: string | null
  generated_by: string | null
  last_edited_at: string | null
  last_edited_by: string | null
}

export type SchoolItem = {
  name: string
  type?: string
  grades?: string
  rating?: string
  notes?: string
}

export type DiningItem = {
  name: string
  cuisine?: string
  price?: string
  notes?: string
}

export type RecreationItem = {
  name: string
  type?: string
  difficulty?: string
  notes?: string
}

export type EventItem = {
  name: string
  when?: string
  notes?: string
}

export type FaqItem = {
  question: string
  answer: string
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export async function getPlaceContent(
  placeType: 'city' | 'community' | 'neighborhood',
  placeKey: string
): Promise<PlaceContentRow | null> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('place_content')
      .select('id, place_type, place_key, place_name, city_name, overview, history, lifestyle, schools, outdoor_recreation, dining, shopping, arts_culture, transportation, healthcare, events_festivals, family_life, real_estate_overview, schools_data, dining_data, recreation_data, events_data, seo_title, seo_description, seo_keywords, faqs, generated_at, generated_by, last_edited_at, last_edited_by')
      .eq('place_type', placeType)
      .eq('place_key', placeKey)
      .maybeSingle()

    if (error) {
      if (!error.message?.includes('place_content')) {
        console.error('[getPlaceContent]', error)
      }
      return null
    }

    if (!data) return null

    return {
      ...data,
      schools_data: parseJsonbArray<SchoolItem>(data.schools_data),
      dining_data: parseJsonbArray<DiningItem>(data.dining_data),
      recreation_data: parseJsonbArray<RecreationItem>(data.recreation_data),
      events_data: parseJsonbArray<EventItem>(data.events_data),
      faqs: parseJsonbArray<FaqItem>(data.faqs),
    } as PlaceContentRow
  } catch (err) {
    console.error('[getPlaceContent]', err)
    return null
  }
}

export async function upsertPlaceContent(
  content: Partial<PlaceContentRow> & {
    place_type: 'city' | 'community' | 'neighborhood'
    place_key: string
    place_name: string
  }
): Promise<{ error: string | null }> {
  try {
    const sb = getServiceSupabase()
    if (!sb) return { error: 'Supabase service client not configured' }

    const { error } = await sb.from('place_content').upsert(
      {
        ...content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'place_type,place_key' }
    )

    if (error) {
      console.error('[upsertPlaceContent]', error)
      return { error: error.message }
    }
    return { error: null }
  } catch (err) {
    console.error('[upsertPlaceContent]', err)
    return { error: 'Failed to save place content' }
  }
}

const EDITABLE_FIELDS = new Set([
  'overview',
  'history',
  'lifestyle',
  'schools',
  'outdoor_recreation',
  'dining',
  'shopping',
  'arts_culture',
  'transportation',
  'healthcare',
  'events_festivals',
  'family_life',
  'real_estate_overview',
])

export async function updatePlaceContentField(
  placeType: 'city' | 'community' | 'neighborhood',
  placeKey: string,
  field: string,
  value: string | null,
  editedBy?: string
): Promise<{ error: string | null }> {
  if (!EDITABLE_FIELDS.has(field)) {
    return { error: `Field "${field}" is not editable` }
  }

  try {
    const sb = getServiceSupabase()
    if (!sb) return { error: 'Supabase service client not configured' }

    const { error } = await sb
      .from('place_content')
      .update({
        [field]: value,
        last_edited_at: new Date().toISOString(),
        last_edited_by: editedBy ?? 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('place_type', placeType)
      .eq('place_key', placeKey)

    if (error) {
      console.error('[updatePlaceContentField]', error)
      return { error: error.message }
    }
    return { error: null }
  } catch (err) {
    console.error('[updatePlaceContentField]', err)
    return { error: 'Failed to update field' }
  }
}

export type PlaceContentListItem = {
  id: string
  place_type: 'city' | 'community' | 'neighborhood'
  place_key: string
  place_name: string
  city_name: string | null
  overview: string | null
  history: string | null
  lifestyle: string | null
  schools: string | null
  outdoor_recreation: string | null
  dining: string | null
  shopping: string | null
  arts_culture: string | null
  transportation: string | null
  healthcare: string | null
  events_festivals: string | null
  family_life: string | null
  real_estate_overview: string | null
  generated_at: string | null
  last_edited_at: string | null
}

export async function listPlaceContent(
  placeType?: 'city' | 'community' | 'neighborhood'
): Promise<PlaceContentListItem[]> {
  try {
    const supabase = await createServerClient()
    let query = supabase
      .from('place_content')
      .select('id, place_type, place_key, place_name, city_name, overview, history, lifestyle, schools, outdoor_recreation, dining, shopping, arts_culture, transportation, healthcare, events_festivals, family_life, real_estate_overview, generated_at, last_edited_at')
      .order('place_name')
      .limit(500)

    if (placeType) {
      query = query.eq('place_type', placeType)
    }

    const { data, error } = await query
    if (error) {
      console.error('[listPlaceContent]', error)
      return []
    }

    return (data ?? []) as PlaceContentListItem[]
  } catch (err) {
    console.error('[listPlaceContent]', err)
    return []
  }
}

export async function getContentCompletionStats(): Promise<{
  total: number
  withOverview: number
  withSchools: number
  withDining: number
  withRecreation: number
  byType: Record<string, number>
}> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('place_content')
      .select('place_type, overview, schools, dining, outdoor_recreation')

    if (error || !data) {
      return { total: 0, withOverview: 0, withSchools: 0, withDining: 0, withRecreation: 0, byType: {} }
    }

    const byType: Record<string, number> = {}
    let withOverview = 0
    let withSchools = 0
    let withDining = 0
    let withRecreation = 0

    for (const row of data) {
      byType[row.place_type] = (byType[row.place_type] ?? 0) + 1
      if (row.overview?.trim()) withOverview++
      if (row.schools?.trim()) withSchools++
      if (row.dining?.trim()) withDining++
      if (row.outdoor_recreation?.trim()) withRecreation++
    }

    return { total: data.length, withOverview, withSchools, withDining, withRecreation, byType }
  } catch {
    return { total: 0, withOverview: 0, withSchools: 0, withDining: 0, withRecreation: 0, byType: {} }
  }
}

function parseJsonbArray<T>(val: unknown): T[] | null {
  if (!val) return null
  if (Array.isArray(val)) return val as T[]
  if (typeof val === 'object' && val !== null && 'items' in val) {
    return (val as { items: T[] }).items
  }
  return null
}
