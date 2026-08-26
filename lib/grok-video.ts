/**
 * Shim. The Grok surface now lives in lib/grok/.
 * Kept for the hero-video and Today produce callers, which want a URL string.
 */
import {
  generateGrokVideo,
  type GrokVideoAspect,
  type GrokVideoResolution,
} from '@/lib/grok/video'

export type FlyoverVideoOptions = {
  prompt: string
  duration?: number
  aspect_ratio?: GrokVideoAspect
  resolution?: GrokVideoResolution
}

export type ImageToVideoOptions = {
  /** Public URL of the source image to animate. */
  image_url: string
  prompt?: string
  duration?: number
  aspect_ratio?: GrokVideoAspect
  resolution?: GrokVideoResolution
}

const IMAGE_TO_VIDEO_PROMPT =
  'Gentle cinematic motion, slow zoom, landscape comes to life. No text, no people. Subtle movement only.'

/** Text-to-video. Returns a temporary URL: download and store it promptly. */
export async function generateFlyoverVideo(options: FlyoverVideoOptions): Promise<string> {
  const result = await generateGrokVideo({
    prompt: options.prompt,
    duration: options.duration ?? 10,
    aspectRatio: options.aspect_ratio ?? '16:9',
    resolution: options.resolution ?? '720p',
  })
  return result.url
}

/** Image-to-video. Returns a temporary URL: download and store it promptly. */
export async function generateImageToVideo(options: ImageToVideoOptions): Promise<string> {
  const result = await generateGrokVideo({
    prompt: options.prompt ?? IMAGE_TO_VIDEO_PROMPT,
    image: { url: options.image_url },
    duration: options.duration ?? 5,
    aspectRatio: options.aspect_ratio ?? '16:9',
    resolution: options.resolution ?? '720p',
  })
  return result.url
}
