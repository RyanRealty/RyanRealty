'use server'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  displayName: string | null
  phone: string | null
  defaultCity: string | null
  updatedAt: string
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('display_name, phone, default_city, updated_at')
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return {
    displayName: data.display_name ?? null,
    phone: data.phone ?? null,
    defaultCity: data.default_city ?? null,
    updatedAt: data.updated_at,
  }
}

export async function updateProfile(updates: {
  displayName?: string | null
  phone?: string | null
  defaultCity?: string | null
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }
  if (updates.displayName !== undefined) row.display_name = updates.displayName?.trim() || null
  if (updates.phone !== undefined) row.phone = updates.phone?.trim() || null
  if (updates.defaultCity !== undefined) row.default_city = updates.defaultCity?.trim() || null

  const { error } = await supabase.from('profiles').upsert(row, {
    onConflict: 'user_id',
  })
  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Set default home city. For signed-in users updates profile; for anonymous returns city so client can set cookie.
 * Returns { setCookie: string } when not signed in so the client sets the cookie and refreshes.
 */
export async function setDefaultHomeCity(city: string): Promise<{ error?: string; setCookie?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const trimmed = city?.trim() || null
  if (user && trimmed) {
    const { error } = await updateProfile({ defaultCity: trimmed })
    return error ? { error } : {}
  }
  if (user && !trimmed) {
    const { error } = await updateProfile({ defaultCity: null })
    return error ? { error } : {}
  }
  return { setCookie: trimmed || 'Bend' }
}
