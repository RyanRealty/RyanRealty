'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { revalidatePath } from 'next/cache'

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

export async function requireBrokerSelfServiceSlug(slug: string): Promise<void> {
  const broker = await getCurrentBrokerRecord()
  if (!broker || broker.slug !== slug) {
    redirect('/admin/access-denied')
  }
}
