'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificationPreferences = {
  emailEnabled?: boolean
  savedSearchFrequency?: 'instant' | 'daily' | 'weekly'
  priceDropAlerts?: boolean
  statusChangeAlerts?: boolean
  openHouseReminders?: boolean
  marketDigestFrequency?: 'weekly' | 'monthly' | 'off'
  blogUpdates?: boolean
}

export type BuyerPreferencesProfile = {
  preferredCities?: string[]
  preferredCommunities?: string[]
  budgetMin?: number | null
  budgetMax?: number | null
  beds?: number | null
  baths?: number | null
  mustHaves?: string[]
  moveInTimeline?: string
}

export type Profile = {
  displayName: string | null
  phone: string | null
  defaultCity: string | null
  updatedAt: string
  notificationPreferences?: NotificationPreferences | null
  buyerPreferences?: BuyerPreferencesProfile | null
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('display_name, phone, default_city, updated_at, notification_preferences, buyer_preferences')
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  const row = data as {
    display_name: string | null
    phone: string | null
    default_city: string | null
    updated_at: string
    notification_preferences?: unknown
    buyer_preferences?: unknown
  }
  return {
    displayName: row.display_name ?? null,
    phone: row.phone ?? null,
    defaultCity: row.default_city ?? null,
    updatedAt: row.updated_at,
    notificationPreferences: (row.notification_preferences as NotificationPreferences) ?? null,
    buyerPreferences: (row.buyer_preferences as BuyerPreferencesProfile) ?? null,
  }
}

export async function updateProfile(updates: {
  displayName?: string | null
  phone?: string | null
  defaultCity?: string | null
  notificationPreferences?: NotificationPreferences | null
  buyerPreferences?: BuyerPreferencesProfile | null
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
  if (updates.notificationPreferences !== undefined) row.notification_preferences = updates.notificationPreferences ?? {}
  if (updates.buyerPreferences !== undefined) row.buyer_preferences = updates.buyerPreferences ?? {}

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
