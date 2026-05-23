/**
 * Listing detail bundles — photos, agents, open houses, videos, history rows.
 *
 * Owns the read paths the listing detail page uses to override the JSONB
 * `details` blob with canonical normalized rows. Lives behind the DAL
 * boundary; app/actions/listing-detail.ts delegates.
 */

import { supabaseAnon } from '@/lib/data/client'

export type ListingDetailPhotoRow = {
  id: string
  listing_key: string
  photo_url: string
  cdn_url?: string | null
  sort_order: number | null
  caption?: string | null
  is_hero?: boolean | null
}

export type ListingDetailAgentRow = {
  id: string
  listing_key: string
  agent_role: string
  agent_name?: string | null
  agent_mls_id?: string | null
  agent_license?: string | null
  agent_email?: string | null
  agent_phone?: string | null
  office_name?: string | null
  office_mls_id?: string | null
  office_phone?: string | null
}

export type ListingDetailOpenHouseRow = {
  id: string
  listing_key: string
  event_date: string
  start_time?: string | null
  end_time?: string | null
  host_agent_name?: string | null
  remarks?: string | null
}

export type ListingDetailVideoRow = {
  id: string
  video_url: string
  sort_order: number | null
}

export type ListingHistoryEventRow = {
  id?: string
  listing_key?: string
  event?: string
  event_date?: string | null
  price?: number | null
  price_change?: number | null
  description?: string | null
  raw?: unknown
}

/** All photos for a listing, sorted ASC by sort_order. */
export async function getListingDetailPhotos(listingKey: string): Promise<ListingDetailPhotoRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('listing_photos')
    .select('id, listing_key, photo_url, cdn_url, sort_order, caption, is_hero')
    .eq('listing_key', listingKey)
    .order('sort_order', { ascending: true })
  return (data ?? []) as ListingDetailPhotoRow[]
}

/** Listing agent rows (role in 'list' | 'listing'). */
export async function getListingDetailAgents(listingKey: string): Promise<ListingDetailAgentRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('listing_agents')
    .select(
      'id, listing_key, agent_role, agent_name, agent_mls_id, agent_license, agent_email, agent_phone, office_name, office_mls_id, office_phone'
    )
    .eq('listing_key', listingKey)
    .in('agent_role', ['list', 'listing'])
  return (data ?? []) as ListingDetailAgentRow[]
}

/** Upcoming open houses for a listing (event_date >= today, ASC). */
export async function getListingDetailOpenHouses(
  listingKey: string
): Promise<ListingDetailOpenHouseRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await sb
    .from('open_houses')
    .select('id, listing_key, event_date, start_time, end_time, host_agent_name, remarks')
    .eq('listing_key', listingKey)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
  return (data ?? []) as ListingDetailOpenHouseRow[]
}

/** Listing videos for the detail player, sorted by sort_order ASC. */
export async function getListingDetailVideos(listingKey: string): Promise<ListingDetailVideoRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('listing_videos')
    .select('id, video_url, sort_order')
    .eq('listing_key', listingKey)
    .order('sort_order', { ascending: true })
  return (data ?? []) as ListingDetailVideoRow[]
}

/** Full listing_history events for the timeline view (capped at 100). */
export async function getListingDetailHistory(
  listingKey: string
): Promise<ListingHistoryEventRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('listing_history')
    .select('id, listing_key, event, event_date, price, price_change, description, raw')
    .eq('listing_key', listingKey)
    .order('event_date', { ascending: true })
    .limit(100)
  return (data ?? []) as ListingHistoryEventRow[]
}

/** Community + neighborhood + city resolution by community slug. */
export type CommunityResolution = {
  id: string
  name: string
  slug: string
  neighborhoodName: string | null
  neighborhoodSlug: string | null
  citySlug: string | null
}

export async function resolveCommunityChainBySlug(
  communitySlug: string
): Promise<CommunityResolution | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data: comm } = await sb
    .from('communities')
    .select('id, name, slug, neighborhood_id, city_id')
    .eq('slug', communitySlug)
    .maybeSingle()
  if (!comm) return null
  const c = comm as {
    id: string
    name: string
    slug: string
    neighborhood_id?: string | null
    city_id?: string | null
  }
  let neighborhoodName: string | null = null
  let neighborhoodSlug: string | null = null
  let citySlug: string | null = null
  if (c.neighborhood_id) {
    const { data: nh } = await sb
      .from('neighborhoods')
      .select('name, slug')
      .eq('id', c.neighborhood_id)
      .maybeSingle()
    if (nh) {
      neighborhoodName = (nh as { name?: string | null }).name ?? null
      neighborhoodSlug = (nh as { slug?: string | null }).slug ?? null
    }
  }
  if (c.city_id) {
    const { data: cityRow } = await sb
      .from('cities')
      .select('slug')
      .eq('id', c.city_id)
      .maybeSingle()
    citySlug = (cityRow as { slug?: string | null } | null)?.slug ?? null
  }
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    neighborhoodName,
    neighborhoodSlug,
    citySlug,
  }
}
