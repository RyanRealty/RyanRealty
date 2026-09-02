/**
 * POST /api/ai/room-restyle
 * Grok Imagine image edit: restyle a listing photo (visualization only).
 *
 * Rate / cost:
 *   - `checkRateLimit(..., 'strict')` → ~10 req / 60s per IP (Upstash; fail-open if unset).
 *   - Each success hits xAI images/edits (paid). Prefer interior photos client-side.
 *   - Prefer one style at a time; UI surfaces the cap copy.
 */
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Style prompts: photoreal, architecture-locked, Central Oregon honest.
 * Shared ids with RoomRestyle.client.tsx STYLES.
 */
const STYLES: Record<string, string> = {
  modern:
    'Photorealistic interior redesign of this room in a clean contemporary style suited to a Central Oregon home: soft neutrals, refined materials, uncluttered surfaces, updated but not flashy finishes. Keep walls, windows, ceiling, floor plane, openings, and camera angle identical. Do not invent extra rooms or change the home footprint. No people, text, logos, watermarks, or floating furniture that breaks perspective.',
  warm:
    'Photorealistic interior redesign with warm organic materials for a livable Central Oregon home: soft wood tones, natural textiles, layered but calm lighting, inviting seating. Keep architecture, windows, and camera angle identical. Do not overcrowd. No people, text, or logos.',
  staged:
    'Photorealistic professional real estate staging for a listing: declutter, tasteful furniture scaled to the room, bright market-ready light, neutral art, no personal clutter. Keep architecture and camera angle identical. Staging only, not a gut remodel. No people, text, or logos.',
  mountain:
    'Photorealistic Central Oregon mountain-home aesthetic: natural wood and stone accents where they fit the existing room, cozy refined textiles, quiet lodge warmth without theme-park kitsch. Keep architecture, windows, and camera angle identical. No people, text, or logos. Do not add fake mountain murals or exterior views that were not there.',
  light:
    'Photorealistic bright Scandinavian-leaning interior: airy light woods, soft white and cream palette, simple furniture, maximum natural light feel without inventing windows. Keep architecture and camera angle identical. No people, text, or logos.',
}

const VALID_STYLES = new Set(Object.keys(STYLES))

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
  const styleRaw = (body.style || 'modern').trim()
  const style = VALID_STYLES.has(styleRaw) ? styleRaw : 'modern'
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
        { error: 'Restyle failed. Try another interior photo or style.' },
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
        'AI visualization only. Not the listed condition, not an appraisal, and not a promise of renovation cost or timeline.',
      listingKey: body.listingKey ?? null,
    })
  } catch (e) {
    console.error('[room-restyle]', e)
    return NextResponse.json({ error: 'Restyle unavailable' }, { status: 503 })
  }
}
