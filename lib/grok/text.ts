/**
 * lib/grok/text.ts — Grok reasoning text, structured JSON, and Live Search.
 *
 * Two transports, on purpose:
 *   generateGrokText  -> /chat/completions, no tools, cheapest path.
 *   searchGrok        -> /v1/responses with the web_search and x_search
 *                        server-side tools. This is the Agent Tools API that
 *                        replaced Live Search; the old search_parameters
 *                        field now returns HTTP 410.
 *
 * Search reads X and the open web at request time and returns citations. We
 * use it to find what Central Oregon is actually talking about this week,
 * never to source a NUMBER. Every figure in a deliverable still comes from
 * Supabase or a primary agency source (CLAUDE.md §0). Search citations are
 * context, not a data source.
 */
import { GROK_MODELS, GrokError, ticksToUsd, xaiFetch } from './client'

export type GrokMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

export type GrokSearchTool = 'web_search' | 'x_search'

export type GrokTextOptions = {
  prompt?: string
  messages?: GrokMessage[]
  system?: string
  model?: string
  maxTokens?: number
  temperature?: number
  /**
   * Reasoning budget. grok-4.6 defaults to high, which burns thousands of
   * reasoning tokens on a one-line caption. Set 'low' for mechanical work.
   */
  reasoningEffort?: 'low' | 'medium' | 'high'
  timeoutMs?: number
}

export type GrokTextResult = {
  text: string
  /** URLs the search tools actually read. Empty for a no-tools call. */
  citations: string[]
  model: string
  /** Reported spend for this call, when xAI returns it. */
  costUsd: number | null
}

function buildMessages(options: GrokTextOptions): GrokMessage[] {
  if (options.messages?.length) {
    return options.system
      ? [{ role: 'system', content: options.system }, ...options.messages]
      : options.messages
  }
  const user = options.prompt?.trim()
  if (!user) throw new GrokError('generateGrokText needs a prompt or messages', 0, '')
  return options.system
    ? [
        { role: 'system', content: options.system },
        { role: 'user', content: user },
      ]
    : [{ role: 'user', content: user }]
}

/** Grok chat completion. Returns text plus any Live Search citations. */
export async function generateGrokText(options: GrokTextOptions): Promise<GrokTextResult> {
  const model = options.model ?? GROK_MODELS.text
  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(options),
    max_tokens: options.maxTokens ?? 900,
  }
  if (options.temperature != null) body.temperature = options.temperature
  if (options.reasoningEffort) body.reasoning_effort = options.reasoningEffort

  const res = await xaiFetch(
    '/chat/completions',
    { method: 'POST', body: JSON.stringify(body) },
    { timeoutMs: options.timeoutMs ?? 180_000 },
  )
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new GrokError('xAI chat returned no content', 0, JSON.stringify(data).slice(0, 800))
  }
  return { text: text.trim(), citations: [], model, costUsd: null }
}

/**
 * Strip a fenced code block if the model wrapped its JSON in one, then parse.
 * Kept separate so it is unit-testable without a network call.
 */
export function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1].trim()
  const firstBrace = text.search(/[[{]/)
  if (firstBrace > 0) text = text.slice(firstBrace)
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (lastBrace >= 0 && lastBrace < text.length - 1) text = text.slice(0, lastBrace + 1)
  return JSON.parse(text) as T
}

/**
 * Ask Grok for JSON that conforms to a JSON Schema, enforced server side.
 *
 * This is `response_format: {type: "json_schema", strict: true}`. The model
 * cannot return prose, a code fence, or a missing field, which is why every
 * structured call in the studio uses this and not prompt-and-pray parsing.
 * Note the API requires `additionalProperties: false` and every property
 * listed in `required` when strict is on.
 */
export async function generateGrokStructured<T>(
  options: GrokTextOptions & { schema: Record<string, unknown>; schemaName: string },
): Promise<{ value: T; raw: string; costUsd: number | null }> {
  const model = options.model ?? GROK_MODELS.text
  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(options),
    max_tokens: options.maxTokens ?? 2000,
    response_format: {
      type: 'json_schema',
      json_schema: { name: options.schemaName, schema: options.schema, strict: true },
    },
  }
  if (options.temperature != null) body.temperature = options.temperature
  if (options.reasoningEffort) body.reasoning_effort = options.reasoningEffort

  const res = await xaiFetch(
    '/chat/completions',
    { method: 'POST', body: JSON.stringify(body) },
    { timeoutMs: options.timeoutMs ?? 180_000 },
  )
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { cost_in_usd_ticks?: number }
  }
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new GrokError('structured call returned no content', 0, JSON.stringify(data).slice(0, 800))
  }
  return {
    value: parseJsonLoose<T>(raw),
    raw,
    costUsd: ticksToUsd(data.usage?.cost_in_usd_ticks),
  }
}

// ── Agent Tools API: web_search + x_search ────────────────────────────────

export type GrokSearchOptions = {
  prompt: string
  system?: string
  model?: string
  /** Which server-side tools Grok may call. Default: both. */
  tools?: GrokSearchTool[]
  /**
   * Cap Grok's server-side tool calls. Each one costs real money: an
   * open-ended 16-call research question measured at $2.60 in testing, so
   * the studio keeps this tight and never puts search in a render loop.
   */
  maxToolCalls?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  timeoutMs?: number
}

type ResponsesPayload = {
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      annotations?: Array<{ type?: string; url?: string; title?: string }>
    }>
  }>
  usage?: { cost_in_usd_ticks?: number; num_sources_used?: number }
}

/**
 * Ask Grok something it must answer from live sources (X and the web).
 *
 * This is the Agent Tools API at POST /v1/responses. It replaced Live
 * Search: the old `search_parameters` field now returns HTTP 410.
 *
 * Returns the answer plus every URL it actually read, so a trend-reactive
 * draft carries its sources into the audit trail. Never a source for a
 * NUMBER (CLAUDE.md §0) — figures come from Supabase or a primary agency.
 */
export async function searchGrok(options: GrokSearchOptions): Promise<GrokTextResult> {
  const prompt = options.prompt.trim()
  if (!prompt) throw new GrokError('searchGrok needs a prompt', 0, '')
  const model = options.model ?? GROK_MODELS.text
  const tools = (options.tools ?? ['web_search', 'x_search']).map((type) => ({ type }))

  const body: Record<string, unknown> = {
    model,
    stream: false,
    input: [{ role: 'user', content: prompt }],
    tools,
    max_tool_calls: options.maxToolCalls ?? 8,
  }
  if (options.system) body.instructions = options.system
  if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort }

  const res = await xaiFetch(
    '/responses',
    { method: 'POST', body: JSON.stringify(body) },
    { timeoutMs: options.timeoutMs ?? 300_000 },
  )
  const data = (await res.json()) as ResponsesPayload

  const message = (data.output ?? []).find((item) => item.type === 'message')
  const parts = message?.content ?? []
  const text = parts
    .filter((p) => p.type === 'output_text' && typeof p.text === 'string')
    .map((p) => (p.text as string).trim())
    .join('\n')
    .trim()

  if (!text) {
    throw new GrokError('xAI responses API returned no output_text', 0, JSON.stringify(data).slice(0, 800))
  }

  const citations = Array.from(
    new Set(
      parts
        .flatMap((p) => p.annotations ?? [])
        .filter((a) => a?.type === 'url_citation' && typeof a.url === 'string')
        .map((a) => a.url as string),
    ),
  )

  return { text, citations, model, costUsd: ticksToUsd(data.usage?.cost_in_usd_ticks) }
}
