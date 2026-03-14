'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { revalidatePath } from 'next/cache'

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
  updated_at: string
}

const DEFAULT_ID = 'a0000000-0000-0000-0000-000000000001'
const LOGO_BUCKET = 'branding'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient(url, key)
}

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  return createServiceClient(url, anonKey)
}

async function _getBrokerageSettingsUncached(): Promise<BrokerageSettingsRow | null> {
  const supabase = getAnonSupabase()
  if (!supabase) return null
  const { data } = await supabase
    .from('brokerage_settings')
    .select('id, name, logo_url, tagline, primary_email, primary_phone, address_line1, address_line2, city, state, postal_code, hero_video_url, hero_image_url, updated_at')
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
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const { error } = await supabase
    .from('brokerage_settings')
    .update({ logo_url: logoUrl?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', DEFAULT_ID)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Upload logo file to Storage and set as brokerage logo (admin). */
export async function uploadBrokerageLogo(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
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
  revalidatePath('/', 'layout')
  revalidatePath('/')
  return { ok: true }
}
