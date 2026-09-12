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
import { generateGrokText, parseJsonLoose } from './text'

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
  /**
   * 0 to 100: 100 reads as a paid photograph, 0 is obvious AI slop.
   * The bar is 85 (Matt, 2026-08-26), set just above what the generator was
   * already producing unaided (84 and 86 on the first two live frames), so a
   * marginal frame regenerates instead of reaching the console.
   */
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
  /** Minimum passing score. Default 85. */
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
  const minScore = input.minScore ?? 85
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
  minScore = 85,
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

/**
 * A base64 `data:` URL for one image, the shape xAI's `image_url` content part
 * takes. Pure so the message assembly below is testable without a network call.
 */
export function imageDataUrl(bytes: Uint8Array, mime = 'image/png'): string {
  if (!bytes?.length) throw new GrokError('imageDataUrl needs image bytes', 0, '')
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

export type GrokVisionImage = {
  /** Raw bytes. Encoded here so callers never assemble a data URL by hand. */
  bytes: Uint8Array
  /** Defaults to image/png — the format take-route-shots.mjs writes. */
  mime?: string
}

export type GrokVisionTextInput = {
  prompt: string
  images: readonly GrokVisionImage[]
  model?: string
  maxTokens?: number
  timeoutMs?: number
}

/**
 * Free-form vision: a prompt plus images in, the model's text out.
 *
 * `inspectFrame` above answers one fixed question with a closed defect
 * vocabulary, which is right for the render gate and wrong for a judge whose
 * whole output is an essay-shaped JSON contract owned by another file. This is
 * the general path: the caller owns the question and the reply contract, and
 * lib/grok owns the key, the retries and the model ids (CLAUDE.md §4).
 *
 * Added 2026-09-12 for the site-queue taste instrument. It had three
 * transports and, in a session without the grok CLI, no working one: the two
 * Anthropic-surface paths were still sending EVALUATOR_MODEL after that
 * constant became a Grok id, so both 404 on every call. This is the fourth,
 * and the only one that runs off nothing but XAI_API_KEY.
 */
export async function generateGrokVisionText(
  input: GrokVisionTextInput,
): Promise<{ text: string; model: string }> {
  const prompt = input.prompt?.trim()
  if (!prompt) throw new GrokError('generateGrokVisionText needs a prompt', 0, '')
  if (!input.images?.length) throw new GrokError('generateGrokVisionText needs at least one image', 0, '')

  const model = input.model ?? GROK_MODELS.vision
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
    ...input.images.map((img) => ({
      type: 'image_url',
      image_url: { url: imageDataUrl(img.bytes, img.mime) },
    })),
  ]

  const { text } = await generateGrokText({
    messages: [{ role: 'user', content }],
    model,
    maxTokens: input.maxTokens ?? 4000,
    timeoutMs: input.timeoutMs ?? 600_000,
  })
  return { text, model }
}
