/**
 * lib/grok/video.ts — Grok Imagine motion.
 *
 * Three shapes, one endpoint (POST /v1/videos/generations):
 *   text to video       prompt only
 *   image to video      `image`, first frame locked to that still
 *   reference to video  `reference_images` and/or `reference_audios`, which
 *                       carry a subject or a voice WITHOUT locking frame one
 *
 * Two defaults here are deliberate and both are the opposite of the API's:
 *
 *   generate_audio defaults to TRUE at xAI. We default it to FALSE. Native
 *   generated audio is the single loudest tell that a clip is AI, and on a
 *   brokerage feed a hallucinated voice is a compliance problem, not just a
 *   taste problem. Turn it on only for a diegetic bed you have listened to.
 *
 *   duration defaults to 6. Identity and background geometry degrade at the
 *   tails, so two locked 6s beats cut together beat one 12s take.
 *
 * The returned URL is temporary. Download and store before any row references it.
 */
import { GROK_MODELS, GrokError, ticksToUsd, xaiFetch } from './client'

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

export type GrokVideoAspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'
export type GrokVideoResolution = '480p' | '720p' | '1080p'

export type GrokVideoSource = { url?: string; fileId?: string }

export type GrokVideoOptions = {
  prompt: string
  /** Source still to animate. Locks frame one. Omit for text-to-video. */
  image?: GrokVideoSource
  /**
   * Up to 3 subject references, tagged <IMAGE_1>..<IMAGE_3> in the prompt.
   * Carries a subject across shots without locking the opening frame.
   */
  referenceImages?: GrokVideoSource[]
  /**
   * Up to 3 preset voices, tagged <AUDIO_0>..<AUDIO_2> in the prompt.
   * Implies audio, so passing these turns generate_audio on.
   */
  referenceVoiceIds?: string[]
  /** Seconds, 1 to 15. Craft canon says 6. */
  duration?: number
  aspectRatio?: GrokVideoAspect
  resolution?: GrokVideoResolution
  /** Native generated audio. Off unless you have a reason. */
  generateAudio?: boolean
  model?: string
}

export type GrokVideoResult = {
  /** Temporary xAI URL. Download promptly. */
  url: string
  requestId: string
  model: string
  durationSeconds: number
  hasAudio: boolean
  costUsd: number | null
}

const TEMP_HOST = /(?:^|\.)x\.ai(?:\/|$)|fal\.ai|replicate\.com|kling|hailuo|synthesia/i

/** True when a URL is a generator's expiring URL and must not be stored on a row. */
export function isTempGrokUrl(url: string): boolean {
  return TEMP_HOST.test(url)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function shapeSource(source: GrokVideoSource): Record<string, string> {
  if (source.fileId?.trim()) return { file_id: source.fileId.trim() }
  if (source.url?.trim()) return { url: source.url.trim() }
  throw new GrokError('video source needs a url or fileId', 0, '')
}

/**
 * Start a generation and poll to completion.
 * Throws GrokError on failure, expiry, or timeout.
 */
export async function generateGrokVideo(options: GrokVideoOptions): Promise<GrokVideoResult> {
  const prompt = options.prompt.trim()
  if (!prompt) throw new GrokError('generateGrokVideo needs a prompt', 0, '')
  const model = options.model ?? GROK_MODELS.video
  const duration = Math.min(15, Math.max(1, Math.round(options.duration ?? 6)))
  const voices = (options.referenceVoiceIds ?? []).slice(0, 3)
  const generateAudio = options.generateAudio ?? voices.length > 0

  const body: Record<string, unknown> = {
    model,
    prompt,
    duration,
    aspect_ratio: options.aspectRatio ?? '9:16',
    resolution: options.resolution ?? '1080p',
    generate_audio: generateAudio,
  }
  if (options.image) body.image = shapeSource(options.image)
  if (options.referenceImages?.length) {
    body.reference_images = options.referenceImages.slice(0, 3).map(shapeSource)
  }
  if (voices.length) body.reference_audios = voices.map((voice_id) => ({ voice_id }))

  const startRes = await xaiFetch(
    '/videos/generations',
    { method: 'POST', body: JSON.stringify(body) },
    { timeoutMs: 120_000 },
  )
  const start = (await startRes.json()) as {
    request_id?: string
    status?: string
    video?: { url?: string }
    usage?: { cost_in_usd_ticks?: number }
  }

  // A short generation can come back complete on the first call.
  if (start.status === 'done' && start.video?.url) {
    return {
      url: start.video.url,
      requestId: start.request_id ?? '',
      model,
      durationSeconds: duration,
      hasAudio: generateAudio,
      costUsd: ticksToUsd(start.usage?.cost_in_usd_ticks),
    }
  }

  const requestId = start?.request_id
  if (!requestId) {
    throw new GrokError('xAI video API returned no request_id', 0, JSON.stringify(start).slice(0, 800))
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const statusRes = await xaiFetch(`/videos/${requestId}`, { method: 'GET' }, { timeoutMs: 60_000 })
    const status = (await statusRes.json()) as {
      status?: string
      video?: { url?: string; duration?: number }
      usage?: { cost_in_usd_ticks?: number }
    }
    if (status.status === 'done' && status.video?.url) {
      return {
        url: status.video.url,
        requestId,
        model,
        durationSeconds: status.video.duration ?? duration,
        hasAudio: generateAudio,
        costUsd: ticksToUsd(status.usage?.cost_in_usd_ticks),
      }
    }
    if (status.status === 'expired' || status.status === 'failed') {
      throw new GrokError(
        `xAI video generation ${status.status} (request ${requestId})`,
        0,
        JSON.stringify(status).slice(0, 800),
      )
    }
  }

  throw new GrokError(
    `xAI video generation timed out after ${POLL_TIMEOUT_MS / 1000}s (request ${requestId})`,
    0,
    '',
  )
}
