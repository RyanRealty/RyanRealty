/**
 * Generate a banner image using xAI Grok Image API.
 * Uses b64_json so we can upload to our own storage (Grok URLs are temporary).
 * Set XAI_API_KEY in .env.local.
 */

const XAI_IMAGES_URL = 'https://api.x.ai/v1/images/generations'
const MODEL = 'grok-imagine-image'

export type GrokImageOptions = {
  /** e.g. "Professional real estate banner for Bend, Central Oregon, wide landscape, no text" */
  prompt: string
  /** Wide aspect for hero banners; default 2:1 */
  aspect_ratio?: '1:1' | '2:1' | '16:9'
}

/**
 * Returns image as Buffer (JPEG). Throws on API error or missing key.
 */
export async function generateBannerImage(options: GrokImageOptions): Promise<Buffer> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey?.trim()) {
    throw new Error('XAI_API_KEY is not set. Add it to .env.local for banner generation.')
  }

  const res = await fetch(XAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: options.prompt,
      response_format: 'b64_json',
      aspect_ratio: options.aspect_ratio ?? '2:1',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Grok image API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> }
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('Grok image API did not return b64_json')
  }

  return Buffer.from(b64, 'base64')
}
