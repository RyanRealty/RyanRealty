/**
 * lib/grok/classify.ts — Grok vision as a shot-list builder.
 *
 * The MLS gives us 41 photographs and no captions. Practitioners do not
 * animate whatever is first in the folder; they choose a frame per beat and
 * they choose it for a reason. This is that judgement, applied to our own
 * photography: what room is it, is it a frame worth moving, and would it
 * survive an image-to-video push.
 *
 * That last question is the one that matters and it is not the same as "is
 * this a nice photo". A wide, sharp, front-lit exterior animates cleanly. A
 * dim close-up of a faucet, a photo that is already a collage, or one with a
 * realtor's own text burned into it will smear the moment the camera moves.
 */
import { GROK_MODELS, GrokError, ticksToUsd, xaiFetch } from './client'
import { parseJsonLoose } from './text'

/** What the frame shows. Drives the shot order. */
export const SHOT_SUBJECTS = [
  'exterior_front',
  'exterior_rear',
  'aerial',
  'view',
  'living',
  'kitchen',
  'dining',
  'primary_bedroom',
  'bedroom',
  'bathroom',
  'office',
  'garage',
  'outbuilding',
  'land',
  'detail',
  'floor_plan',
  'other',
] as const

export type ShotSubject = (typeof SHOT_SUBJECTS)[number]

export type PhotoGrade = {
  subject: ShotSubject
  /** 0 to 100: would this frame hold up as the opening of a paid spot. */
  quality: number
  /** False when a camera move would visibly break it. */
  animatable: boolean
  /**
   * A MARKETING overlay: a price banner, a "just listed" stamp, another
   * brokerage's logo, or a collage. The small MLS/ODS corner watermark does
   * NOT count: it is on every photo in the feed, it is required attribution
   * (ODS rules, G54), and treating it as a defect rejected all 41 frames of
   * the first listing we tried.
   */
  hasOverlay: boolean
  /** One sentence, used as alt text and as the caption's media description. */
  describes: string
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: [...SHOT_SUBJECTS] },
    quality: { type: 'integer', minimum: 0, maximum: 100 },
    animatable: { type: 'boolean' },
    hasOverlay: { type: 'boolean' },
    describes: { type: 'string' },
  },
  required: ['subject', 'quality', 'animatable', 'hasOverlay', 'describes'],
  additionalProperties: false,
}

const SYSTEM = [
  'You are a director choosing frames from a real estate photo set for a short film.',
  'Judge each photograph on whether it can carry one slow camera move for six seconds.',
  'animatable is false for: a collage or multi-panel image, a floor plan, a dim or motion-blurred frame,',
  'a tight detail with no depth, a photo shot through glass with heavy reflection, or anything already containing motion blur.',
  'hasOverlay is true ONLY for a MARKETING overlay: a price banner, a "just listed" or "coming soon" stamp,',
  "another brokerage's logo, or a multi-panel collage.",
  'IGNORE the small MLS or ODS watermark in a corner. It is on every photo in this feed, it is required',
  'attribution, and it is not a defect. Do not report it.',
  'quality is your honest read as a working director, not politeness.',
].join(' ')

/**
 * Grade one photograph. The URL is passed straight to the model, so this
 * costs one vision call and no download.
 */
export async function gradePhoto(input: {
  imageUrl: string
  model?: string
}): Promise<PhotoGrade & { costUsd: number | null }> {
  const url = input.imageUrl.trim()
  if (!url) throw new GrokError('gradePhoto needs an image URL', 0, '')

  const res = await xaiFetch(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        model: input.model ?? GROK_MODELS.vision,
        max_tokens: 500,
        // "What room is this and can it hold a move" is a classification, not
        // a puzzle. grok-4.6 defaults to high effort and burned thousands of
        // reasoning tokens per frame, which is where the cost was: measured
        // $0.05 to $0.10 a grade at BOTH 800px and 2048px, so the plate size
        // was never the driver.
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url, detail: 'low' } },
              { type: 'text', text: 'Grade this frame.' },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'photo_grade', schema: SCHEMA, strict: true },
        },
      }),
    },
    { timeoutMs: 90_000 },
  )

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { cost_in_usd_ticks?: number }
  }
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new GrokError('photo grade returned no content', 0, JSON.stringify(data).slice(0, 600))
  }
  return {
    ...normalizeGrade(parseJsonLoose<Partial<PhotoGrade>>(raw)),
    costUsd: ticksToUsd(data.usage?.cost_in_usd_ticks),
  }
}

/** Coerce a model reply into a usable grade. A malformed reply is unusable, not perfect. */
export function normalizeGrade(raw: Partial<PhotoGrade>): PhotoGrade {
  const subject = (SHOT_SUBJECTS as readonly string[]).includes(raw.subject as string)
    ? (raw.subject as ShotSubject)
    : 'other'
  const quality =
    typeof raw.quality === 'number' && Number.isFinite(raw.quality)
      ? Math.max(0, Math.min(100, Math.round(raw.quality)))
      : 0
  const hasOverlay = raw.hasOverlay === true
  return {
    subject,
    quality,
    // An overlay is burned into the pixels, so it survives the move and reads
    // as someone else's branding on our post. Treat it as not animatable.
    animatable: raw.animatable === true && !hasOverlay,
    hasOverlay,
    describes: typeof raw.describes === 'string' ? raw.describes.trim() : '',
  }
}
