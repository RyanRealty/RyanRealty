'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export type BrokerRow = {
  id: string
  slug: string
  display_name: string
  title: string
  license_number: string | null
  bio: string | null
  photo_url: string | null
  email: string | null
  phone: string | null
  google_review_url: string | null
  zillow_review_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  intro_video_url?: string | null
  saved_headshot_urls?: string[] | null
}

const BROKER_SELECT =
  'id, slug, display_name, title, license_number, bio, photo_url, email, phone, google_review_url, zillow_review_url, sort_order, is_active, created_at, updated_at, tagline, specialties, designations, years_experience, social_instagram, social_facebook, social_linkedin, social_youtube, social_tiktok, intro_video_url, saved_headshot_urls'

export async function getActiveBrokers(): Promise<BrokerRow[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true })
  return (data ?? []) as BrokerRow[]
}

export async function getBrokerBySlug(slug: string): Promise<BrokerRow | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .eq('slug', slug.trim())
    .eq('is_active', true)
    .single()
  return data as BrokerRow | null
}

/** All brokers for admin (including inactive). */
export async function getBrokersForAdmin(): Promise<BrokerRow[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true })
  return (data ?? []) as BrokerRow[]
}

/** Single broker by id (for admin edit). */
export async function getBrokerById(id: string): Promise<BrokerRow | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('brokers')
    .select(BROKER_SELECT)
    .eq('id', id.trim())
    .single()
  return data as BrokerRow | null
}

export type BrokerUpdateInput = {
  display_name?: string
  title?: string
  license_number?: string | null
  bio?: string | null
  photo_url?: string | null
  email?: string | null
  phone?: string | null
  google_review_url?: string | null
  zillow_review_url?: string | null
  sort_order?: number
  is_active?: boolean
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  intro_video_url?: string | null
  saved_headshot_urls?: string[] | null
}

/** Update broker (admin only; uses service role). */
export async function updateBroker(id: string, input: BrokerUpdateInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.display_name !== undefined) payload.display_name = input.display_name
  if (input.title !== undefined) payload.title = input.title
  if (input.license_number !== undefined) payload.license_number = input.license_number
  if (input.bio !== undefined) payload.bio = input.bio
  if (input.photo_url !== undefined) payload.photo_url = input.photo_url
  if (input.email !== undefined) payload.email = input.email
  if (input.phone !== undefined) payload.phone = input.phone
  if (input.google_review_url !== undefined) payload.google_review_url = input.google_review_url
  if (input.zillow_review_url !== undefined) payload.zillow_review_url = input.zillow_review_url
  if (input.sort_order !== undefined) payload.sort_order = input.sort_order
  if (input.is_active !== undefined) payload.is_active = input.is_active
  if (input.tagline !== undefined) payload.tagline = input.tagline
  if (input.specialties !== undefined) payload.specialties = input.specialties
  if (input.designations !== undefined) payload.designations = input.designations
  if (input.years_experience !== undefined) payload.years_experience = input.years_experience
  if (input.social_instagram !== undefined) payload.social_instagram = input.social_instagram
  if (input.social_facebook !== undefined) payload.social_facebook = input.social_facebook
  if (input.social_linkedin !== undefined) payload.social_linkedin = input.social_linkedin
  if (input.social_youtube !== undefined) payload.social_youtube = input.social_youtube
  if (input.social_tiktok !== undefined) payload.social_tiktok = input.social_tiktok
  if (input.intro_video_url !== undefined) payload.intro_video_url = input.intro_video_url
  if (input.saved_headshot_urls !== undefined) payload.saved_headshot_urls = input.saved_headshot_urls
  const { error } = await supabase.from('brokers').update(payload).eq('id', id.trim())
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'update', resourceType: 'broker', resourceId: id, details: payload })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true }
}

export type BrokerCreateInput = {
  slug: string
  display_name: string
  title: string
  license_number: string
  bio?: string | null
  photo_url?: string | null
  email?: string | null
  phone?: string | null
  google_review_url?: string | null
  zillow_review_url?: string | null
  sort_order?: number
  is_active?: boolean
  tagline?: string | null
  specialties?: string[] | null
  designations?: string[] | null
  years_experience?: number | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  social_youtube?: string | null
  social_tiktok?: string | null
  intro_video_url?: string | null
}

/** Create broker (admin only; uses service role). Required: slug, display_name, title, license_number. */
export async function createBroker(input: BrokerCreateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!input.display_name?.trim()) return { ok: false, error: 'Display name is required.' }
  if (!input.title?.trim()) return { ok: false, error: 'Title is required.' }
  if (!input.license_number?.trim()) return { ok: false, error: 'License number is required (Oregon advertising compliance).' }
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('brokers')
    .insert({
      slug,
      display_name: input.display_name.trim(),
      title: input.title.trim(),
      license_number: input.license_number.trim(),
      bio: input.bio?.trim() || null,
      photo_url: input.photo_url?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      google_review_url: input.google_review_url?.trim() || null,
      zillow_review_url: input.zillow_review_url?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      tagline: input.tagline?.trim() || null,
      specialties: input.specialties ?? null,
      designations: input.designations ?? null,
      years_experience: input.years_experience ?? null,
      social_instagram: input.social_instagram?.trim() || null,
      social_facebook: input.social_facebook?.trim() || null,
      social_linkedin: input.social_linkedin?.trim() || null,
      social_youtube: input.social_youtube?.trim() || null,
      social_tiktok: input.social_tiktok?.trim() || null,
      intro_video_url: input.intro_video_url?.trim() || null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'create', resourceType: 'broker', resourceId: data.id, details: { slug } })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true, id: data.id }
}

/** Delete broker (admin only; uses service role). Removes broker row; admin_roles.broker_id will be set NULL by FK. */
export async function deleteBroker(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('brokers').delete().eq('id', id.trim())
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const role = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role, actionType: 'delete', resourceType: 'broker', resourceId: id })
  revalidatePath('/team')
  revalidatePath('/admin/brokers')
  return { ok: true }
}
