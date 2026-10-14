import { createServiceClient } from '@/lib/supabase/service'

export const ONE_OFF_IMAGE_BUCKET = 'campaign-media'

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function oneOffImagePublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${ONE_OFF_IMAGE_BUCKET}/${storagePath}`
}

export async function uploadOneOffImage(input: {
  sendKey: string
  filename: string
  body: Buffer
  contentType: string
}): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const sendKey = safeSegment(input.sendKey.trim())
  const filename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!sendKey || !filename) return { ok: false, error: 'sendKey and filename are required' }
  if (!input.body.length) return { ok: false, error: 'image body is empty' }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!supabaseUrl) return { ok: false, error: 'Supabase URL missing' }
  try {
    const sb = createServiceClient()
    const storagePath = `one-off/${sendKey}/${filename}`
    const { error } = await sb.storage.from(ONE_OFF_IMAGE_BUCKET).upload(storagePath, input.body, {
      contentType: input.contentType,
      upsert: true,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, url: oneOffImagePublicUrl(storagePath), path: storagePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'upload failed' }
  }
}
