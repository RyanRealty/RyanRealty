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
  void createServiceClient
  const { getBrokerSelfRecord } = await import('@/lib/data')
  const data = await getBrokerSelfRecord(role.brokerId)
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
  void createServiceClient
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
  const { updateBrokerById } = await import('@/lib/data')
  const res = await updateBrokerById(broker.id, payload)
  if (!res.ok) return { ok: false, error: res.error ?? 'update failed' }
  revalidatePath(`/team/${broker.slug}`)
  revalidatePath(`/team/${broker.slug}/edit`)
  return { ok: true }
}

export async function getCurrentBrokerDashboard() {
  const broker = await getCurrentBrokerRecord()
  if (!broker) return null
  void createServiceClient
  const { getListingKeysForBrokerByLicense, getListingKeysForBrokerByEmail } = await import('@/lib/data')
  let listingKeys: string[] = []
  if (broker.license_number?.trim()) {
    listingKeys = await getListingKeysForBrokerByLicense(broker.license_number)
  } else if (broker.email?.trim()) {
    listingKeys = await getListingKeysForBrokerByEmail(broker.email)
  } else {
    return { broker, activeListings: 0, sold24m: 0, soldVolume24m: 0, viewCount: 0, saveCount: 0, likeCount: 0 }
  }
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

  const { sumEngagementForListingKeys } = await import('@/lib/data')
  const { viewCount, saveCount, likeCount } = await sumEngagementForListingKeys(listingKeys.slice(0, 1000))

  return { broker, activeListings, sold24m, soldVolume24m, viewCount, saveCount, likeCount }
}

export async function requireBrokerSelfServiceSlug(slug: string): Promise<void> {
  const broker = await getCurrentBrokerRecord()
  if (!broker || broker.slug !== slug) {
    redirect('/admin/access-denied')
  }
}
