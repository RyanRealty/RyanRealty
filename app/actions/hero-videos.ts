'use server'

import { createClient } from '@supabase/supabase-js'
import { cityEntityKey } from '../../lib/slug'
import { generateFlyoverVideo, generateImageToVideo } from '../../lib/grok-video'
import { refreshPlaceBanner, getBannerUrl } from './banners'

const BUCKET = 'banners'
const VIDEO_PREFIX = 'videos'

/** City-specific landscape prompts: cinematic aerial, focus on Central Oregon scenery from that city's perspective. */
const CITY_VIDEO_PROMPTS: Record<string, string> = {
  bend: 'Cinematic 10-second aerial drone flyover of Central Oregon from Bend: the Three Sisters mountains, Deschutes River winding through town, high desert and forest. Stunning landscape focus, golden light. No text, no people. Realistic, beautiful.',
  redmond: 'Cinematic 10-second aerial drone flyover of Central Oregon from Redmond: dry river canyon, high desert plains, Cascade Mountains in the distance. Landscape-focused, dramatic scenery. No text, no people. Realistic.',
  sisters: 'Cinematic 10-second aerial drone flyover of Sisters, Oregon: views of the Three Sisters and Cascade Mountains from town, Western landscape, ponderosa pine. Stunning mountain focus. No text, no people. Realistic.',
  sunriver: 'Cinematic 10-second aerial drone flyover of Sunriver area: Deschutes River, ponderosa pine forest, Cascade foothills. Peaceful Central Oregon landscape. No text, no people. Realistic.',
  'la pine': 'Cinematic 10-second aerial drone flyover of La Pine area: Deschutes National Forest, mixed forest and high desert. Central Oregon landscape. No text, no people. Realistic.',
  prineville: 'Cinematic 10-second aerial drone flyover of Prineville and Crook County: Ochoco Mountains, high desert, rural Central Oregon. Landscape from this location. No text, no people. Realistic.',
  madras: 'Cinematic 10-second aerial drone flyover of Madras, Oregon: Mount Jefferson and Cascade range, agricultural land, high desert. Central Oregon landscape. No text, no people. Realistic.',
}

const DEFAULT_VIDEO_PROMPT =
  'Cinematic 10-second aerial drone flyover of Central Oregon: high desert, Cascade Mountains, clear daylight. Landscape-focused, beautiful. No text, no people. Realistic.'

/**
 * Get public URL for a **city** hero video. Communities (subdivisions) reuse the city video — only city videos are stored.
 */
export async function getHeroVideoUrl(
  entityType: 'city' | 'subdivision',
  entityKey: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null

  const supabase = createClient(url, anonKey)
  const cityKey = entityType === 'subdivision' ? entityKey.split(':')[0] ?? entityKey : entityKey
  const { data, error } = await supabase
    .from('hero_videos')
    .select('storage_path')
    .eq('entity_type', 'city')
    .eq('entity_key', cityKey)
    .maybeSingle()

  if (error) return null
  const path = (data as { storage_path?: string } | null)?.storage_path
  if (!path) return null

  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * Generate hero video for a **city** only. Landscape-focused, city-specific prompt. Communities reuse the city video.
 */
export async function generateHeroVideoForPage(params: {
  entityType: 'city' | 'subdivision'
  entityKey: string
  displayName: string
  city?: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured for writes.' }
  }

  const cityKey = params.entityType === 'subdivision' ? (params.entityKey.split(':')[0] ?? params.entityKey) : params.entityKey
  const cityName = params.entityType === 'city' ? params.displayName : (params.city ?? params.displayName)
  const prompt =
    CITY_VIDEO_PROMPTS[cityName.trim().toLowerCase()] ??
    DEFAULT_VIDEO_PROMPT.replace('Central Oregon', `${cityName}, Central Oregon`)

  let videoUrl: string
  try {
    videoUrl = await generateFlyoverVideo({ prompt, duration: 10, aspect_ratio: '16:9', resolution: '720p' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Video generation failed.'
    return { ok: false, error: message }
  }

  const res = await fetch(videoUrl)
  if (!res.ok) {
    return { ok: false, error: `Failed to download generated video: ${res.status}` }
  }
  const buffer = Buffer.from(await res.arrayBuffer())

  const storagePath = `${VIDEO_PREFIX}/cities/${cityKey}.mp4`

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  })
  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` }
  }

  const { error: dbError } = await supabase.from('hero_videos').upsert(
    { entity_type: 'city', entity_key: cityKey, storage_path: storagePath },
    { onConflict: 'entity_type,entity_key' }
  )
  if (dbError) {
    return { ok: false, error: `DB upsert failed: ${dbError.message}` }
  }

  const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
  return { ok: true, url }
}

/**
 * Refresh hero media for a city/subdivision: fetch new image from Unsplash, store as banner,
 * then animate that image to a 3–8 second video via xAI image-to-video and store as hero video.
 * Single "Refresh" action for development.
 */
export async function refreshHeroMedia(params: {
  entityType: 'city' | 'subdivision'
  entityKey: string
  searchQuery: string
}): Promise<{ ok: true; videoUrl: string; imageUrl: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured for writes.' }
  }

  const { entityType, entityKey, searchQuery } = params
  const cityKey = entityType === 'subdivision' ? (entityKey.split(':')[0] ?? entityKey) : entityKey

  const bannerResult = await refreshPlaceBanner(entityType, entityKey, searchQuery)
  if (!bannerResult.ok) return { ok: false, error: bannerResult.error }

  const imageUrl = bannerResult.url
  let videoUrl: string
  try {
    videoUrl = await generateImageToVideo({
      image_url: imageUrl,
      duration: 5,
      prompt: 'Gentle cinematic motion, slow zoom, landscape comes to life. No text. Subtle movement only.',
      aspect_ratio: '16:9',
      resolution: '720p',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Image-to-video failed.'
    return { ok: false, error: message }
  }

  const res = await fetch(videoUrl)
  if (!res.ok) {
    return { ok: false, error: `Failed to download generated video: ${res.status}` }
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  const storagePath = `${VIDEO_PREFIX}/cities/${cityKey}.mp4`

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  })
  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` }
  }

  const { error: dbError } = await supabase.from('hero_videos').upsert(
    { entity_type: 'city', entity_key: cityKey, storage_path: storagePath },
    { onConflict: 'entity_type,entity_key' }
  )
  if (dbError) {
    return { ok: false, error: `DB upsert failed: ${dbError.message}` }
  }

  const storedVideoUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
  return { ok: true, videoUrl: storedVideoUrl, imageUrl }
}
