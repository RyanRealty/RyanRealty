'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { revalidatePath } from 'next/cache'
import { getListingTiles } from '@/lib/data'

type BrokerSelfRow = {
  id: string
  slug: string
  display_name: string
  title: string
  bio: string | null
  phone: string | null
  email: string | null
  tagline: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_linkedin: string | null
  social_youtube: string | null
  social_tiktok: string | null
  social_x: string | null
  license_number: string | null
}

async function getCurrentBrokerRecord(): Promise<BrokerSelfRow | null> {
  const session = await getSession()
  const email = session?.user?.email?.trim()
  if (!email) return null
  const role = await getAdminRoleForEmail(email)
  if (!role?.brokerId) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('brokers')
    .select(
      'id, slug, display_name, title, bio, phone, email, tagline, social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, social_x, license_number'
    )
    .eq('id', role.brokerId)
    .maybeSingle()
  return (data as BrokerSelfRow | null) ?? null
}

export async function getCurrentBrokerForSelfService(): Promise<BrokerSelfRow | null> {
  return getCurrentBrokerRecord()
}

export async function updateCurrentBrokerProfile(input: {
  bio?: string
  phone?: string
  tagline?: string
  social_instagram?: string
  social_facebook?: string
  social_linkedin?: string
  social_youtube?: string
  social_tiktok?: string
  social_x?: string
}): Promise<{ ok: boolean; error?: string }> {
  const broker = await getCurrentBrokerRecord()
  if (!broker) return { ok: false, error: 'Broker account not found for this login.' }
  const supabase = createServiceClient()
  const payload = {
    bio: input.bio?.trim() || null,
    phone: input.phone?.trim() || null,
    tagline: input.tagline?.trim() || null,
    social_instagram: input.social_instagram?.trim() || null,
    social_facebook: input.social_facebook?.trim() || null,
    social_linkedin: input.social_linkedin?.trim() || null,
    social_youtube: input.social_youtube?.trim() || null,
    social_tiktok: input.social_tiktok?.trim() || null,
    social_x: input.social_x?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('brokers').update(payload).eq('id', broker.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/team/${broker.slug}`)
  revalidatePath(`/team/${broker.slug}/edit`)
  return { ok: true }
}

export async function getCurrentBrokerDashboard() {
  const broker = await getCurrentBrokerRecord()
  if (!broker) return null
  const supabase = createServiceClient()

  let listingAgentQuery = supabase
    .from('listing_agents')
    .select('listing_key')
    .in('agent_role', ['list', 'listing'])
    .limit(5000)
  if (broker.license_number?.trim()) {
    const digits = broker.license_number.replace(/\D/g, '')
    listingAgentQuery = listingAgentQuery.ilike('agent_license', `%${digits}%`)
  } else if (broker.email?.trim()) {
    listingAgentQuery = listingAgentQuery.ilike('agent_email', broker.email.trim())
  } else {
    return { broker, activeListings: 0, sold24m: 0, soldVolume24m: 0, viewCount: 0, saveCount: 0, likeCount: 0 }
  }
  const { data: agentRows } = await listingAgentQuery
  const listingKeys = [...new Set((agentRows ?? []).map((row: { listing_key?: string | null }) => (row.listing_key ?? '').trim()).filter(Boolean))]
  if (listingKeys.length === 0) {
    return { broker, activeListings: 0, sold24m: 0, soldVolume24m: 0, viewCount: 0, saveCount: 0, likeCount: 0 }
  }

  // DAL: count broker's active listings + last-24mo sold/volume.
  const activeTiles = await getListingTiles({
    listingKeys: listingKeys.slice(0, 1000),
    status: 'active',
    limit: 500,
  })
  const activeListings = activeTiles.length

  const since = new Date()
  since.setMonth(since.getMonth() - 24)
  const sinceIso = since.toISOString().slice(0, 10)
  const soldTiles = await getListingTiles({
    listingKeys: listingKeys.slice(0, 1000),
    status: 'closed',
    sort: 'close-newest',
    limit: 500,
  })
  const soldFiltered = soldTiles.filter(
    (t) => t.closeDate != null && t.closeDate >= sinceIso,
  )
  const sold24m = soldFiltered.length
  const soldVolume24m = soldFiltered.reduce(
    (sum, t) => sum + Number(t.closePrice ?? 0),
    0,
  )

  const { data: engagementRows } = await supabase
    .from('engagement_metrics')
    .select('view_count, save_count, like_count')
    .in('listing_key', listingKeys.slice(0, 1000))
  const viewCount = (engagementRows ?? []).reduce((sum: number, row: { view_count?: number | null }) => sum + Number(row.view_count ?? 0), 0)
  const saveCount = (engagementRows ?? []).reduce((sum: number, row: { save_count?: number | null }) => sum + Number(row.save_count ?? 0), 0)
  const likeCount = (engagementRows ?? []).reduce((sum: number, row: { like_count?: number | null }) => sum + Number(row.like_count ?? 0), 0)

  return { broker, activeListings, sold24m, soldVolume24m, viewCount, saveCount, likeCount }
}

export async function requireBrokerSelfServiceSlug(slug: string): Promise<void> {
  const broker = await getCurrentBrokerRecord()
  if (!broker || broker.slug !== slug) {
    redirect('/admin/access-denied')
  }
}
