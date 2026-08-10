/**
 * POST /api/ai/room-restyle
 * Grok Imagine image edit: restyle a listing photo (visualization only).
 */
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const STYLES: Record<string, string> = {
  modern:
    'Photorealistic interior redesign of this room in a modern contemporary style: clean lines, neutral palette, updated finishes. Keep architecture, windows, and camera angle identical. Do not add people or text.',
  warm:
    'Photorealistic interior redesign with warm organic materials: wood tones, soft textiles, inviting lighting. Keep architecture and camera angle identical. No people or text.',
  staged:
    'Photorealistic professional real estate staging: declutter, tasteful furniture, bright and market-ready. Keep architecture and camera angle identical. No people or text.',
  mountain:
    'Photorealistic Central Oregon mountain-home aesthetic: natural materials, mountain lodge accents, cozy and refined. Keep architecture and camera angle identical. No people or text.',
}

type Body = {
  imageUrl?: string
  style?: string
  listingKey?: string
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'Image restyle is not configured.' }, { status: 503 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const imageUrl = (body.imageUrl || '').trim()
  const style = (body.style || 'modern').trim()
  if (!imageUrl.startsWith('http')) {
    return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
  }
  // Only allow MLS/CDN-ish hosts (no arbitrary SSRF to internal)
  try {
    const u = new URL(imageUrl)
    if (!['http:', 'https:'].includes(u.protocol)) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  }

  const prompt = STYLES[style] ?? STYLES.modern

  try {
    const res = await fetch('https://api.x.ai/v1/images/edits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt,
        image: { url: imageUrl, type: 'image_url' },
        n: 1,
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error('[room-restyle]', res.status, text.slice(0, 500))
      return NextResponse.json(
        { error: 'Restyle failed. Try another photo or style.' },
        { status: 502 },
      )
    }
    const json = JSON.parse(text) as {
      data?: Array<{ url?: string; b64_json?: string }>
    }
    const out = json.data?.[0]
    const url = out?.url
    const b64 = out?.b64_json
    if (!url && !b64) {
      return NextResponse.json({ error: 'No image returned' }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      url: url ?? null,
      dataUrl: b64 ? `data:image/png;base64,${b64}` : null,
      style,
      disclaimer:
        'AI visualization only. Not the listed condition. Not an appraisal or offer of renovation.',
      listingKey: body.listingKey ?? null,
    })
  } catch (e) {
    console.error('[room-restyle]', e)
    return NextResponse.json({ error: 'Restyle unavailable' }, { status: 503 })
  }
}
