/**
 * lib/grok/vision.ts — Grok image understanding, used as the quality gate.
 *
 * The studio never animates a frame it has not looked at. Motion is the
 * expensive step ($0.08/sec against $0.04/still), so every video path
 * generates a hero still first, sends it back through Grok vision, and only
 * animates once the frame passes. A generator that produces warped
 * architecture or glyph-soup signage fails here, not on the feed.
 *
 * The defect vocabulary is a closed list on purpose. A free-text critique
 * cannot be counted, trended, or gated; an enum can.
 */
import { GROK_MODELS, GrokError, ticksToUsd, xaiFetch } from './client'
import { parseJsonLoose } from './text'

/**
 * Still-frame defects. Every one of these is a hard fail.
 * Temporal defects (identity drift, texture crawl, cloth snapping) cannot be
 * judged from one frame, which is exactly why we constrain motion instead of
 * trying to inspect it: one axis, quantified amplitude, six seconds.
 */
export const FRAME_DEFECTS = [
  'rendered_text',
  'logo_or_watermark',
  'warped_architecture',
  'impossible_geometry',
  'melted_or_merged_hands',
  'malformed_face',
  'person_present',
  'inconsistent_lighting',
  'detached_contact_shadow',
  'oversaturated_ai_look',
  'plastic_hdr_skin',
  'wrong_region',
  'duplicated_object',
  'nonsense_detail',
] as const

export type FrameDefect = (typeof FRAME_DEFECTS)[number]

export type VisionVerdict = {
  /** False when any defect is present or the score is under the bar. */
  pass: boolean
  /** 0 to 100: 100 reads as a paid photograph, 0 is obvious AI slop. */
  score: number
  defects: string[]
  /** One plain sentence on what the frame literally shows. */
  describes: string
  /** The single most useful prompt change if we regenerate. */
  fixHint: string
  costUsd: number | null
}

export type VisionQaInput = {
  /** JPEG or PNG bytes to inspect. */
  image: Buffer
  /** What the frame was supposed to show. */
  intent: string
  /** Extra hard-fail conditions for this format. */
  alsoReject?: string[]
  /** Minimum passing score. Default 72. */
  minScore?: number
  model?: string
}

const SYSTEM = [
  'You are a ruthless art director reviewing one AI-generated frame before it goes out on a real estate brokerage feed.',
  'You are looking for reasons to reject it. Assume the generator made a mistake and find it.',
  'Central Oregon is high desert: junipers, sage, ponderosa pine, basalt rimrock, the Cascade peaks west of town.',
  'Palms, saguaro, eastern deciduous forest, ocean, or a downtown skyline mean the frame is the wrong region.',
  'Any rendered text, signage, or brand mark is a defect: we composite our own type afterward, and generated letterforms collapse into glyph soup.',
  'Judge only what is in this frame. Do not speculate about motion.',
].join(' ')

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    defects: { type: 'array', items: { type: 'string', enum: [...FRAME_DEFECTS] } },
    describes: { type: 'string' },
    fixHint: { type: 'string' },
  },
  required: ['pass', 'score', 'defects', 'describes', 'fixHint'],
  additionalProperties: false,
}

/**
 * Inspect one frame. Returns a structured verdict.
 * A failing verdict is a normal outcome, not an error: only transport and
 * schema problems throw.
 */
export async function inspectFrame(input: VisionQaInput): Promise<VisionVerdict> {
  if (!input.image?.length) throw new GrokError('inspectFrame needs image bytes', 0, '')
  const model = input.model ?? GROK_MODELS.vision
  const minScore = input.minScore ?? 72
  const dataUrl = `data:image/jpeg;base64,${input.image.toString('base64')}`

  const question = [
    `Intent: ${input.intent}`,
    input.alsoReject?.length ? `Also reject if: ${input.alsoReject.join('; ')}.` : '',
    `Report any of these defects you can see: ${FRAME_DEFECTS.join(', ')}.`,
    'score is your honest read of whether this passes as a real photograph.',
    `pass is true only if defects is empty and score is at least ${minScore}.`,
    'describes is one sentence on what the frame literally shows.',
    'fixHint is the single most useful prompt change if we regenerate, or empty if it passes.',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await xaiFetch(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              { type: 'text', text: question },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'frame_verdict', schema: SCHEMA, strict: true },
        },
      }),
    },
    { timeoutMs: 150_000 },
  )

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { cost_in_usd_ticks?: number }
  }
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new GrokError('vision QA returned no content', 0, JSON.stringify(data).slice(0, 600))
  }
  return normalizeVerdict(parseJsonLoose<Partial<VisionVerdict>>(raw), minScore, ticksToUsd(data.usage?.cost_in_usd_ticks))
}

/**
 * Coerce a model reply into a usable verdict.
 * The failure mode actually seen in testing is a model that answers
 * pass:true while listing defects. The defects win, every time.
 */
export function normalizeVerdict(
  raw: Partial<VisionVerdict>,
  minScore = 72,
  costUsd: number | null = null,
): VisionVerdict {
  const defects = Array.isArray(raw.defects)
    ? raw.defects.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    : []
  const score =
    typeof raw.score === 'number' && Number.isFinite(raw.score)
      ? Math.max(0, Math.min(100, Math.round(raw.score)))
      : 0
  return {
    pass: raw.pass === true && defects.length === 0 && score >= minScore,
    score,
    defects,
    describes: typeof raw.describes === 'string' ? raw.describes.trim() : '',
    fixHint: typeof raw.fixHint === 'string' ? raw.fixHint.trim() : '',
    costUsd,
  }
}
