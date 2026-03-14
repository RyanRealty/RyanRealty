'use server'

import { createClient } from '@supabase/supabase-js'
import { getBrokerById, updateBroker } from '@/app/actions/brokers'
import { createSynthesiaVideo } from '@/app/actions/synthesia'

const BROKERS_BUCKET = 'brokers'

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

async function ensureBrokersBucket() {
  const supabase = getServiceSupabase()
  if (!supabase) return null
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BROKERS_BUCKET)) {
    await supabase.storage.createBucket(BROKERS_BUCKET, { public: true })
  }
  return supabase
}

export type BrokerGeneratedMediaRow = {
  id: string
  broker_id: string
  type: 'video' | 'photo'
  url: string
  title: string | null
  source: 'synthesia' | 'upload'
  external_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function listBrokerGeneratedMedia(brokerId: string): Promise<BrokerGeneratedMediaRow[]> {
  const supabase = getServiceSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('broker_generated_media')
    .select('id, broker_id, type, url, title, source, external_id, metadata, created_at')
    .eq('broker_id', brokerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as BrokerGeneratedMediaRow[]
}

export async function updateBrokerGeneratedMedia(
  id: string,
  input: { title?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }
  const { error } = await supabase
    .from('broker_generated_media')
    .update({ title: input.title ?? null })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteBrokerGeneratedMedia(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }
  const { error } = await supabase.from('broker_generated_media').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Set broker intro_video_url to the URL of a generated video. */
export async function setBrokerIntroVideoFromGenerated(
  brokerId: string,
  generatedMediaId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }
  const { data: row } = await supabase
    .from('broker_generated_media')
    .select('url, type')
    .eq('id', generatedMediaId)
    .eq('broker_id', brokerId)
    .single()
  if (!row || (row as { type: string }).type !== 'video') {
    return { ok: false, error: 'Generated media not found or is not a video.' }
  }
  const url = (row as { url: string }).url
  const result = await updateBroker(brokerId, { intro_video_url: url })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url }
}

/**
 * Generate a broker intro video via Synthesia, save to storage and broker_generated_media.
 * Optionally set as the broker's intro_video_url.
 */
export async function generateAndSaveSynthesiaIntroVideo(params: {
  brokerId: string
  scriptText: string
  avatarId: string
  title?: string
  setAsIntro?: boolean
}): Promise<{ ok: true; url: string; id: string } | { ok: false; error: string }> {
  const broker = await getBrokerById(params.brokerId)
  if (!broker) return { ok: false, error: 'Broker not found.' }

  const script = params.scriptText.replace(/\[Broker Name\]/g, broker.display_name || 'your agent').trim()
  if (!script) return { ok: false, error: 'Please enter a script for the video.' }

  const createResult = await createSynthesiaVideo({
    avatarId: params.avatarId,
    scriptText: script,
    title: params.title || `Intro - ${broker.display_name}`,
  })

  if (!createResult.ok) return createResult

  const downloadUrl = createResult.downloadUrl
  const res = await fetch(downloadUrl, { headers: { Accept: 'video/mp4,video/*' } })
  if (!res.ok) {
    return { ok: false, error: `Failed to download video from Synthesia: ${res.status}` }
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  const supabase = await ensureBrokersBucket()
  if (!supabase) return { ok: false, error: 'Storage not configured.' }

  const storagePath = `${params.brokerId}/synthesia-intro-${createResult.videoId}.mp4`
  const { error: uploadError } = await supabase.storage
    .from(BROKERS_BUCKET)
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true })

  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` }

  const url = getBrokersPublicUrl(storagePath)
  const { data: inserted, error: insertError } = await supabase
    .from('broker_generated_media')
    .insert({
      broker_id: params.brokerId,
      type: 'video',
      url,
      title: params.title || `Intro (Synthesia)`,
      source: 'synthesia',
      external_id: createResult.videoId,
      metadata: { avatarId: params.avatarId },
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message || 'Failed to save video record.' }
  }

  if (params.setAsIntro) {
    await updateBroker(params.brokerId, { intro_video_url: url })
  }

  return { ok: true, url, id: (inserted as { id: string }).id }
}
