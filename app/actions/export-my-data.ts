'use server'

import { createClient } from '@/lib/supabase/server'
import { getListingAlertsForUser } from '@/lib/data/leads/listingAlerts'

export type ExportMyDataResult = {
  savedListings: Array<{ listing_key: string; created_at: string }>
  savedSearches: Array<Record<string, unknown>>
  savedCities: Array<Record<string, unknown>>
  savedCommunities: Array<Record<string, unknown>>
  profile: Record<string, unknown> | null
  userEventsSample: Array<{ event_type: string; event_at: string; page_path: string | null }>
}

/**
 * Export current user's data for GDPR/CCPA. Returns structured data; caller can offer as JSON download.
 * Only returns data for the authenticated user.
 *
 * savedSearches unions the unified listing_alerts rows (the live alert model
 * since 2026-07-07) with any legacy saved_searches rows (public-search feature
 * + pre-unification data) so the export stays complete across the migration.
 */
export async function exportMyData(): Promise<ExportMyDataResult | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not signed in' }

  const [savedListingsRes, listingAlerts, legacySearchesRes, savedCitiesRes, savedCommunitiesRes, profileRes, eventsRes] = await Promise.all([
    supabase.from('saved_listings').select('listing_key, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    getListingAlertsForUser(user.id),
    supabase.from('saved_searches').select('*').eq('user_id', user.id),
    supabase.from('saved_cities').select('*').eq('user_id', user.id),
    supabase.from('saved_communities').select('*').eq('user_id', user.id),
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_events').select('event_type, event_at, page_path').eq('user_id', user.id).order('event_at', { ascending: false }).limit(500),
  ])

  return {
    savedListings: (savedListingsRes.data ?? []) as ExportMyDataResult['savedListings'],
    savedSearches: [
      ...(listingAlerts as unknown as Array<Record<string, unknown>>),
      ...((legacySearchesRes.data ?? []) as Array<Record<string, unknown>>),
    ],
    savedCities: (savedCitiesRes.data ?? []) as ExportMyDataResult['savedCities'],
    savedCommunities: (savedCommunitiesRes.data ?? []) as ExportMyDataResult['savedCommunities'],
    profile: profileRes.data as ExportMyDataResult['profile'],
    userEventsSample: (eventsRes.data ?? []) as ExportMyDataResult['userEventsSample'],
  }
}
