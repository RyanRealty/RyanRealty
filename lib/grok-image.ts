/**
 * Shim. The Grok surface now lives in lib/grok/.
 * Kept for the banner generator, which wants a single JPEG Buffer.
 */
import { generateGrokImage, type GrokAspect } from '@/lib/grok/image'

export type GrokImageOptions = {
  prompt: string
  aspect_ratio?: GrokAspect
}

/** Returns image as Buffer (JPEG). Throws on API error or missing key. */
export async function generateBannerImage(options: GrokImageOptions): Promise<Buffer> {
  return generateGrokImage({
    prompt: options.prompt,
    aspectRatio: options.aspect_ratio ?? '2:1',
    resolution: '2k',
  })
}
