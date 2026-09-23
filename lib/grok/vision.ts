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

export type VisionPart =
  | { type: 'text'; text: string }
  | { type: 'image'; jpeg: Buffer; detail?: 'high' | 'low' }

export type StructuredVisionResult<T> = {
  data: T
  model: string
  inputTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  costUsd: number | null
  ms: number
}

/**
 * Several images plus text in, one JSON object out, held to a strict schema.
 * The general form of inspectFrame: the document reader (lib/tc/doc-read)
 * shows it the pages of a contract and gets back what is printed and signed.
 * Transport and schema failures throw; the caller decides what a failed read
 * means for its record.
 */
export async function readImagesStructured<T>(input: {
  system: string
  parts: readonly VisionPart[]
  schema: Record<string, unknown>
  schemaName: string
  model?: string
  maxTokens?: number
  timeoutMs?: number
}): Promise<StructuredVisionResult<T>> {
  const model = input.model ?? GROK_MODELS.vision
  const content = input.parts.map((p) =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.jpeg.toString('base64')}`, detail: p.detail ?? 'high' } },
  )
  const t0 = Date.now()
  const res = await xaiFetch(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 4000,
        temperature: 0,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content },
        ],
        response_format: { type: 'json_schema', json_schema: { name: input.schemaName, schema: input.schema, strict: true } },
      }),
    },
    { timeoutMs: input.timeoutMs ?? 240_000 },
  )
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      completion_tokens_details?: { reasoning_tokens?: number }
      cost_in_usd_ticks?: number
    }
  }
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new GrokError('structured vision returned no content', 0, JSON.stringify(data).slice(0, 600))
  }
  return {
    data: parseJsonLoose<T>(raw),
    model,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    costUsd: ticksToUsd(data.usage?.cost_in_usd_ticks),
    ms: Date.now() - t0,
  }
}
