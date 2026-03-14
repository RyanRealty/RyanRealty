'use server'

import { createClient } from '@supabase/supabase-js'
import { getBrokerById, updateBroker } from '@/app/actions/brokers'
import { resolveHeadshotPromptText } from '@/app/actions/headshot-prompts'
import { BROKER_HEADSHOT_NEGATIVE_PROMPT, type HeadshotGender } from '@/lib/headshot-prompt'

const BROKERS_BUCKET = 'brokers'

/** Check if Replicate API token is set (for UI). Does not reveal the token. */
export async function checkReplicateConfigured(): Promise<{ configured: boolean }> {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  return { configured: !!token }
}
const REPLICATE_MODEL_VERSION = 'fofr/face-to-many:352f1ad684b6e7e6d5c0895a73dde3bf22131ebdc4a2b17aa3a64e7c2aa40d96'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function getBrokersPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  return `${base}/storage/v1/object/public/${BROKERS_BUCKET}/${storagePath}`
}

/** Ensure brokers bucket exists and return Supabase client, or null if not configured. */
async function ensureBrokersBucket() {
  const supabase = getServiceSupabase()
  if (!supabase) return null
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BROKERS_BUCKET)) {
    await supabase.storage.createBucket(BROKERS_BUCKET, { public: true })
  }
  return supabase
}

/**
 * Upload a headshot image for a broker. File is stored in Supabase (brokers bucket)
 * and broker.photo_url is updated.
 */
export async function uploadBrokerHeadshot(
  brokerId: string,
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('image/')) {
    return { ok: false, error: 'Please choose an image file (JPEG, PNG, or WebP).' }
  }
  const broker = await getBrokerById(brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }

  const supabase = await ensureBrokersBucket()
  if (!supabase) return { ok: false, error: 'Storage not configured.' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const storagePath = `${brokerId}/headshot.${safeExt}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(BROKERS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }

  const url = getBrokersPublicUrl(storagePath)
  const result = await updateBroker(brokerId, { photo_url: url })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

const INTRO_VIDEO_TYPES = ['video/mp4', 'video/webm']
const INTRO_VIDEO_EXTS = ['mp4', 'webm']

/**
 * Upload an intro video for a broker. File is stored in Supabase (brokers bucket)
 * and broker.intro_video_url is updated. Used as the hero/header video on the broker page.
 */
export async function uploadBrokerIntroVideo(
  brokerId: string,
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('video/')) {
    return { ok: false, error: 'Please choose a video file (MP4 or WebM).' }
  }
  if (!INTRO_VIDEO_TYPES.includes(file.type)) {
    return { ok: false, error: 'Only MP4 and WebM are supported.' }
  }
  const broker = await getBrokerById(brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }

  const supabase = await ensureBrokersBucket()
  if (!supabase) return { ok: false, error: 'Storage not configured.' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const safeExt = INTRO_VIDEO_EXTS.includes(ext) ? ext : 'mp4'
  const storagePath = `${brokerId}/intro-video.${safeExt}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(BROKERS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }

  const url = getBrokersPublicUrl(storagePath)
  const result = await updateBroker(brokerId, { intro_video_url: url })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

/**
 * Generate a professional headshot from a source photo using Replicate (fofr/face-to-many).
 * Uploads source to storage, runs prediction, saves result as broker headshot.
 * promptId: 'default' for built-in prompt, or a headshot_prompts.id for a custom prompt.
 */
export async function generateBrokerHeadshot(
  brokerId: string,
  formData: FormData,
  gender: HeadshotGender,
  promptId: string = 'default'
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file?.size || !file.type.startsWith('image/')) {
    return { ok: false, error: 'Please choose a source photo (JPEG, PNG, or WebP).' }
  }
  const broker = await getBrokerById(brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }

  const apiToken = process.env.REPLICATE_API_TOKEN?.trim()
  if (!apiToken) {
    return {
      ok: false,
      error:
        'REPLICATE_API_TOKEN is not set. Add it to .env.local (see .env.example) and restart the dev server (npm run dev).',
    }
  }

  const supabase = await ensureBrokersBucket()
  if (!supabase) return { ok: false, error: 'Storage not configured.' }

  // Upload source image so Replicate can fetch it via URL
  const ts = Date.now()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const sourcePath = `${brokerId}/source-${ts}.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: sourceUploadError } = await supabase.storage
    .from(BROKERS_BUCKET)
    .upload(sourcePath, buffer, { contentType: file.type, upsert: true })
  if (sourceUploadError) {
    return { ok: false, error: `Failed to upload source image: ${sourceUploadError.message}` }
  }
  const sourceUrl = getBrokersPublicUrl(sourcePath)

  const promptRaw = await resolveHeadshotPromptText(promptId, gender)
  if (!promptRaw?.trim()) {
    return { ok: false, error: 'Invalid or missing prompt. Select the default prompt or a saved custom prompt.' }
  }
  // Single-line prompt so the API receives the full text; some runtimes truncate or mishandle newlines
  const prompt = promptRaw.replace(/\s+/g, ' ').trim()

  // Stronger prompt influence and more change from source so the model follows wardrobe/lighting/background
  const promptStrength = 11
  const denoisingStrength = 0.72
  const seed = Math.floor(Math.random() * 2 ** 31)

  // Create Replicate prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL_VERSION,
      input: {
        image: sourceUrl,
        prompt,
        negative_prompt: BROKER_HEADSHOT_NEGATIVE_PROMPT,
        prompt_strength: promptStrength,
        denoising_strength: denoisingStrength,
        instant_id_strength: 0.85,
        seed,
      },
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    return { ok: false, error: `Replicate API error: ${createRes.status} ${text}` }
  }
  const prediction = (await createRes.json()) as { id: string; urls?: { get: string } }
  const getUrl = prediction.urls?.get
  if (!getUrl) return { ok: false, error: 'Replicate did not return prediction URL.' }

  // Poll until succeeded (or failed)
  let output: string[] | null = null
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const statusRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiToken}` } })
    if (!statusRes.ok) return { ok: false, error: `Replicate status check failed: ${statusRes.status}` }
    const status = (await statusRes.json()) as { status: string; output?: string[]; error?: string }
    if (status.status === 'succeeded') {
      output = status.output ?? null
      break
    }
    if (status.status === 'failed') {
      return { ok: false, error: status.error ?? 'Replicate prediction failed.' }
    }
  }
  if (!output?.length) return { ok: false, error: 'AI headshot generation timed out or returned no image.' }

  const generatedImageUrl = output[0]
  if (!generatedImageUrl?.startsWith('http')) {
    return { ok: false, error: 'Invalid image URL from Replicate.' }
  }

  // Download generated image and store in our bucket (unique path so user can generate many, then pick one)
  const imageRes = await fetch(generatedImageUrl, { next: { revalidate: 0 } })
  if (!imageRes.ok) return { ok: false, error: 'Failed to download generated headshot.' }
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
  const headshotPath = `${brokerId}/ai-headshot-${ts}.jpg`
  const { error: headshotUploadError } = await supabase.storage
    .from(BROKERS_BUCKET)
    .upload(headshotPath, imageBuffer, { contentType: 'image/jpeg', upsert: true })
  if (headshotUploadError) {
    return { ok: false, error: `Failed to save headshot: ${headshotUploadError.message}` }
  }

  const url = getBrokersPublicUrl(headshotPath)
  return { ok: true, url }
}

/** Add a headshot URL to the broker's saved list (no duplicate). Does not set as default. */
export async function addBrokerSavedHeadshot(
  brokerId: string,
  url: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const broker = await getBrokerById(brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }
  const current = (broker as { saved_headshot_urls?: string[] | null }).saved_headshot_urls ?? []
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, error: 'Invalid URL.' }
  if (current.includes(trimmed)) return { ok: true }
  const next = [...current, trimmed]
  const result = await updateBroker(brokerId, { saved_headshot_urls: next })
  return result
}

/** Set a headshot URL as the broker's default (photo_url) and add to saved if not already. */
export async function setBrokerHeadshotDefault(
  brokerId: string,
  url: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const broker = await getBrokerById(brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, error: 'Invalid URL.' }
  const current = (broker as { saved_headshot_urls?: string[] | null }).saved_headshot_urls ?? []
  const saved = current.includes(trimmed) ? current : [...current, trimmed]
  const result = await updateBroker(brokerId, { photo_url: trimmed, saved_headshot_urls: saved })
  return result
}
