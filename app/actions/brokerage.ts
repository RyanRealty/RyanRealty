'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { unstable_cache } from 'next/cache'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/app/actions/log-admin-action'

export type BrokerageSettingsRow = {
  id: string
  name: string
  logo_url: string | null
  tagline: string | null
  primary_email: string | null
  primary_phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  hero_video_url: string | null
  hero_image_url: string | null
  team_image_url: string | null
  updated_at: string
}

const DEFAULT_ID = 'a0000000-0000-0000-0000-000000000001'
const LOGO_BUCKET = 'branding'

function getServiceSupabase() {
  try {
    return createServiceClient()
  } catch {
    return null
  }
}

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  return createSupabaseClient(url, anonKey)
}

async function _getBrokerageSettingsUncached(): Promise<BrokerageSettingsRow | null> {
  const supabase = getAnonSupabase()
  if (!supabase) return null
  const { data } = await supabase
    .from('brokerage_settings')
    .select('id, name, logo_url, tagline, primary_email, primary_phone, address_line1, address_line2, city, state, postal_code, hero_video_url, hero_image_url, team_image_url, updated_at')
    .eq('id', DEFAULT_ID)
    .single()
  return data as BrokerageSettingsRow | null
}

export const getBrokerageSettings = unstable_cache(
  _getBrokerageSettingsUncached,
  ['brokerage-settings'],
  { revalidate: 300, tags: ['brokerage-settings'] }
)

/** Update brokerage logo URL (admin). Call from admin only. */
export async function updateBrokerageLogoUrl(logoUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  // In-body auth (RC5 fix): branding writes had no gate — an unauthenticated caller
  // could swap the brokerage logo used across the public site + PDFs.
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const { error } = await supabase
    .from('brokerage_settings')
    .update({ logo_url: logoUrl?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', DEFAULT_ID)
  if (error) return { ok: false, error: error.message }
  await logBrokerageAudit({ field: 'logo_url', logo_url: logoUrl?.trim() || null })
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Upload logo file to Storage and set as brokerage logo (admin). */
export async function uploadBrokerageLogo(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('image/')) return { ok: false, error: 'Please choose an image file.' }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const storagePath = `logo.${ext}`
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === LOGO_BUCKET)) {
    await supabase.storage.createBucket(LOGO_BUCKET, { public: true })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  const url = `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${storagePath}`
  const result = await updateBrokerageLogoUrl(url)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

/** Update homepage hero video and/or image URL (admin). */
export async function updateBrokerageHeroMedia(heroVideoUrl: string | null, heroImageUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const { error } = await supabase
    .from('brokerage_settings')
    .update({
      hero_video_url: heroVideoUrl?.trim() || null,
      hero_image_url: heroImageUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', DEFAULT_ID)
  if (error) return { ok: false, error: error.message }
  await logBrokerageAudit({
    field: 'hero_media',
    hero_video_url: heroVideoUrl?.trim() || null,
    hero_image_url: heroImageUrl?.trim() || null,
  })
  revalidatePath('/', 'layout')
  revalidatePath('/')
  return { ok: true }
}

/** Update team/social proof image URL (admin). Used by the homepage testimonials section. */
export async function updateBrokerageTeamImageUrl(teamImageUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const { error } = await supabase
    .from('brokerage_settings')
    .update({ team_image_url: teamImageUrl?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', DEFAULT_ID)
  if (error) return { ok: false, error: error.message }
  await logBrokerageAudit({ field: 'team_image_url', team_image_url: teamImageUrl?.trim() || null })
  revalidatePath('/', 'layout')
  revalidatePath('/')
  return { ok: true }
}

/** Upload team image to Storage and set as brokerage team photo (admin). Same bucket as logo. */
export async function uploadBrokerageTeamImage(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('image/')) return { ok: false, error: 'Please choose an image file.' }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const storagePath = `team.${ext}`
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === LOGO_BUCKET)) {
    await supabase.storage.createBucket(LOGO_BUCKET, { public: true })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  const url = `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${storagePath}`
  const result = await updateBrokerageTeamImageUrl(url)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

async function ensureBrandingBucket() {
  const supabase = getServiceSupabase()
  if (!supabase) return null
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === LOGO_BUCKET)) {
    await supabase.storage.createBucket(LOGO_BUCKET, { public: true })
  }
  return supabase
}

function getPublicBrandingUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  return `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${path}`
}

async function logBrokerageAudit(details: Record<string, unknown>) {
  const session = await getSession()
  const adminEmail = session?.user?.email ?? ''
  if (!adminEmail) return
  const role = adminEmail ? (await getAdminRoleForEmail(adminEmail))?.role ?? null : null
  if (!role) return
  await logAdminAction({
    adminEmail,
    role,
    actionType: 'update',
    resourceType: 'brokerage_settings',
    resourceId: DEFAULT_ID,
    details,
  })
}

export async function uploadBrokerageHeroImage(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('image/')) {
    return { ok: false, error: 'Please choose an image file.' }
  }
  const supabase = await ensureBrandingBucket()
  if (!supabase) return { ok: false, error: 'Server not configured' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg'
  const storagePath = `hero-image.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }

  const url = getPublicBrandingUrl(storagePath)
  const current = await _getBrokerageSettingsUncached()
  const result = await updateBrokerageHeroMedia(current?.hero_video_url ?? null, url)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

export async function uploadBrokerageHeroVideo(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const gate = await checkAdminAction('content.site')
  if (!gate.ok) return { ok: false, error: gate.error }
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('video/')) {
    return { ok: false, error: 'Please choose a video file.' }
  }
  if (!['video/mp4', 'video/webm'].includes(file.type)) {
    return { ok: false, error: 'Only MP4 and WebM are supported.' }
  }
  const supabase = await ensureBrandingBucket()
  if (!supabase) return { ok: false, error: 'Server not configured' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const safeExt = ['mp4', 'webm'].includes(ext) ? ext : 'mp4'
  const storagePath = `hero-video.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }

  const url = getPublicBrandingUrl(storagePath)
  const current = await _getBrokerageSettingsUncached()
  const result = await updateBrokerageHeroMedia(url, current?.hero_image_url ?? null)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}
