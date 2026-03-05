/**
 * Generate a short aerial flyover video using xAI Grok Imagine Video API.
 * Async: start request, poll until done, return temporary URL (caller must download and store).
 * Set XAI_API_KEY in .env.local.
 */

const XAI_VIDEOS_URL = 'https://api.x.ai/v1/videos/generations'
const XAI_VIDEO_STATUS_URL = 'https://api.x.ai/v1/videos'
const MODEL = 'grok-imagine-video'
const DEFAULT_DURATION = 10
const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export type FlyoverVideoOptions = {
  /** e.g. "Aerial drone flyover of Bend, Oregon" or "Satellite-style flyover at 44.05°N, 121.31°W" */
  prompt: string
  duration?: number
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  resolution?: '720p' | '480p'
}

/**
 * Start video generation, poll until done, return video URL.
 * URL is temporary — download and re-upload to your storage promptly.
 */
export async function generateFlyoverVideo(options: FlyoverVideoOptions): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey?.trim()) {
    throw new Error('XAI_API_KEY is not set. Add it to .env.local for video generation.')
  }

  const res = await fetch(XAI_VIDEOS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: options.prompt,
      duration: options.duration ?? DEFAULT_DURATION,
      aspect_ratio: options.aspect_ratio ?? '16:9',
      resolution: options.resolution ?? '720p',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`xAI video API error ${res.status}: ${text}`)
  }

  const startData = (await res.json()) as { request_id?: string }
  const requestId = startData?.request_id
  if (!requestId) throw new Error('xAI video API did not return request_id')

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const statusRes = await fetch(`${XAI_VIDEO_STATUS_URL}/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!statusRes.ok) throw new Error(`xAI video status error ${statusRes.status}`)
    const statusData = (await statusRes.json()) as {
      status?: string
      video?: { url?: string }
    }
    if (statusData.status === 'done' && statusData.video?.url) {
      return statusData.video.url
    }
    if (statusData.status === 'expired') {
      throw new Error('Video generation expired')
    }
  }

  throw new Error('Video generation timed out')
}
