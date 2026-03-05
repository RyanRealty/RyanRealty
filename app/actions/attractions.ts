'use server'

import { createClient } from '@supabase/supabase-js'
import { cityEntityKey, subdivisionEntityKey } from '../../lib/slug'

export type PlaceAttraction = {
  id: string
  name: string
  phone: string | null
  description: string | null
  is_coming: boolean
  sort_order: number
}

/**
 * Get structured attractions (with phone numbers, coming events) for a city or community.
 * Use entityKey from cityEntityKey(city) or subdivisionEntityKey(city, subdivisionName).
 */
export async function getPlaceAttractions(entityKey: string): Promise<PlaceAttraction[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  try {
    const supabase = createClient(url, anonKey)
    const { data, error } = await supabase
      .from('place_attractions')
      .select('id, name, phone, description, is_coming, sort_order')
      .eq('entity_key', entityKey)
      .order('is_coming', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) return []
    return (data ?? []) as PlaceAttraction[]
  } catch {
    return []
  }
}
