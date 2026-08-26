/**
 * lib/grok/image.ts — Grok Imagine stills and edits.
 *
 * Two endpoints:
 *   POST /v1/images/generations  text to image
 *   POST /v1/images/edits        image plus instruction, or up to 3 sources
 *
 * Always returns bytes, never an xAI URL. Generated URLs expire, so a draft
 * row that points at one is a broken post waiting to happen. Callers store
 * the buffer in our own bucket before anything references it.
 *
 * The still is the important step. Craft canon (docs/GROK_CRAFT_CANON.md):
 * lock a hero frame at the delivery aspect first, inspect it, and only then
 * spend money on motion.
 */
import { GROK_MODELS, GrokError, ticksToUsd, xaiFetch } from './client'

/** Exactly the values the REST schema accepts. Anything else is a 400. */
export type GrokAspect =
  | '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:3' | '3:2'
  | '9:19.5' | '19.5:9' | '9:20' | '20:9' | '1:2' | '2:1' | '21:9' | '5:2' | 'auto'

export type GrokResolution = '1k' | '2k'

export type GrokImageOptions = {
  prompt: string
  aspectRatio?: GrokAspect
  /** 2k for anything that will be animated or printed. Default 2k. */
  resolution?: GrokResolution
  model?: string
  /** Candidates per request, 1 to 10. We generate several and let vision pick. */
  n?: number
}

export type GrokImageResult = {
  /** Image bytes, one per candidate. */
  images: Buffer[]
  mimeType: string
  model: string
  costUsd: number | null
}

type ImagesPayload = {
  data?: Array<{ b64_json?: string; mime_type?: string }>
  usage?: { cost_in_usd_ticks?: number }
}

function readImages(data: ImagesPayload, model: string): GrokImageResult {
  const rows = Array.isArray(data.data) ? data.data : []
  const images: Buffer[] = []
  for (const row of rows) {
    if (typeof row.b64_json !== 'string' || !row.b64_json) continue
    const buffer = Buffer.from(row.b64_json, 'base64')
    if (buffer.length > 0) images.push(buffer)
  }
  if (images.length === 0) {
    throw new GrokError('xAI image API returned no b64_json', 0, JSON.stringify(data).slice(0, 800))
  }
  return {
    images,
    mimeType: rows.find((r) => r.mime_type)?.mime_type ?? 'image/jpeg',
    model,
    costUsd: ticksToUsd(data.usage?.cost_in_usd_ticks),
  }
}

/** Text to image. Returns every candidate as bytes. */
export async function generateGrokImages(options: GrokImageOptions): Promise<GrokImageResult> {
  const prompt = options.prompt.trim()
  if (!prompt) throw new GrokError('generateGrokImages needs a prompt', 0, '')
  const model = options.model ?? GROK_MODELS.image

  const res = await xaiFetch(
    '/images/generations',
    {
      method: 'POST',
      body: JSON.stringify({
        model,
        prompt,
        response_format: 'b64_json',
        aspect_ratio: options.aspectRatio ?? '1:1',
        resolution: options.resolution ?? '2k',
        n: Math.min(10, Math.max(1, options.n ?? 1)),
      }),
    },
    { timeoutMs: 240_000 },
  )
  return readImages((await res.json()) as ImagesPayload, model)
}

/** Single-image convenience. */
export async function generateGrokImage(options: GrokImageOptions): Promise<Buffer> {
  const result = await generateGrokImages({ ...options, n: 1 })
  return result.images[0]
}

export type GrokImageEditOptions = {
  prompt: string
  /** Source images: https URLs, data URIs, or Files API ids. Up to 3. */
  sources: Array<{ url?: string; fileId?: string }>
  aspectRatio?: GrokAspect
  resolution?: GrokResolution
  model?: string
  n?: number
}

/**
 * Edit or combine existing images.
 *
 * Note for listing work: an MLS photo is the seller's and the MLS's asset.
 * Editing one changes the record of a real property, so this is for brand and
 * background plates, never for altering how a listed home looks.
 */
export async function editGrokImage(options: GrokImageEditOptions): Promise<GrokImageResult> {
  const prompt = options.prompt.trim()
  if (!prompt) throw new GrokError('editGrokImage needs a prompt', 0, '')
  const sources = options.sources.filter((s) => s.url?.trim() || s.fileId?.trim()).slice(0, 3)
  if (sources.length === 0) throw new GrokError('editGrokImage needs at least one source', 0, '')
  const model = options.model ?? GROK_MODELS.image

  const shaped = sources.map((s) =>
    s.fileId?.trim() ? { file_id: s.fileId.trim() } : { url: s.url as string },
  )
  const body: Record<string, unknown> = {
    model,
    prompt,
    response_format: 'b64_json',
    resolution: options.resolution ?? '2k',
    n: Math.min(10, Math.max(1, options.n ?? 1)),
    // The schema makes `image` and `images` mutually exclusive.
    ...(shaped.length === 1 ? { image: shaped[0] } : { images: shaped }),
    ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
  }

  const res = await xaiFetch(
    '/images/edits',
    { method: 'POST', body: JSON.stringify(body) },
    { timeoutMs: 240_000 },
  )
  return readImages((await res.json()) as ImagesPayload, model)
}
