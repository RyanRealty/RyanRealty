/**
 * lib/grok/cursor-cli.ts — Grok structured text via the Cursor subscription.
 *
 * Same mechanism as Tip Ready taste receipts (scripts/taste-evaluate.ts
 * askCursor / scripts/taste-table.mjs scoreWithCursor):
 *   cursor-agent -p --trust --mode ask --output-format text --model <id> <prompt>
 *
 * Auth is `cursor-agent login` or CURSOR_API_KEY (both draw on the Cursor plan,
 * not api.x.ai). XAI_API_KEY is deleted from the spawn env so the CLI cannot
 * fall back to console.x.ai pay-per-token.
 *
 * Used when resolveGrokTransport() === 'cursor' (expired Auto-CMA, or
 * GROK_TRANSPORT=cursor). Never calls https://api.x.ai.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { GrokError, GROK_MODELS } from './client'
import { CURSOR_CLI, cursorCliPresent } from './transport'

/** CLI model id — same pin as taste-evaluate-result.mjs CURSOR_JUDGE_MODEL. */
export const CURSOR_GROK_MODEL = process.env.CURSOR_GROK_MODEL?.trim() || 'cursor-grok-4.6-high'


export type CursorGrokMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

export type CursorStructuredOptions = {
  prompt?: string
  messages?: CursorGrokMessage[]
  system?: string
  model?: string
  maxTokens?: number
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  timeoutMs?: number
  schema: Record<string, unknown>
  schemaName: string
}


function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) text = fence[1]!.trim()
  const firstBrace = text.search(/[[{]/)
  if (firstBrace > 0) text = text.slice(firstBrace)
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (lastBrace >= 0 && lastBrace < text.length - 1) text = text.slice(0, lastBrace + 1)
  return JSON.parse(text) as T
}

function buildPrompt(options: CursorStructuredOptions): string {
  const parts: string[] = []
  if (options.system?.trim()) {
    parts.push(`SYSTEM:\n${options.system.trim()}`)
  }
  const messages: CursorGrokMessage[] = options.messages?.length
    ? options.messages
    : options.prompt?.trim()
      ? [{ role: 'user', content: options.prompt.trim() }]
      : []
  for (const m of messages) {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    parts.push(`${m.role.toUpperCase()}:\n${content}`)
  }
  parts.push(
    `Respond with a single JSON object that conforms to this JSON Schema (name=${options.schemaName}). ` +
      `No preamble, no markdown fence, no commentary — JSON only.\n` +
      JSON.stringify(options.schema),
  )
  return parts.join('\n\n')
}

function classifyCursorFailure(res: SpawnSyncReturns<string>): GrokError {
  const blob = `${res.stderr ?? ''}\n${res.stdout ?? ''}`.trim()
  const missing = Boolean(res.error && 'code' in res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT')
  if (missing || res.status === 127) {
    return new GrokError(`cursor-agent CLI missing (${CURSOR_CLI})`, 0, blob.slice(0, 800))
  }
  if (/not logged in|authentication|unauthorized|login/i.test(blob)) {
    return new GrokError('cursor-agent is not logged in (run cursor-agent login, or set CURSOR_API_KEY)', 0, blob.slice(0, 800))
  }
  if (/\b402\b|payment required|usage (limit|cap)|rate limit|quota/i.test(blob)) {
    return new GrokError(`cursor-agent usage limit: ${blob.slice(0, 300)}`, 402, blob.slice(0, 800))
  }
  return new GrokError(`cursor-agent exited ${res.status ?? 'null'}`, res.status ?? 0, blob.slice(0, 800))
}

/**
 * Spawn cursor-agent for a structured JSON answer. Strips XAI_API_KEY.
 * Throws GrokError on failure — callers (judge/audit) fail open.
 */
export function generateGrokStructuredViaCursorCli<T>(
  options: CursorStructuredOptions,
): { value: T; raw: string; costUsd: null; model: string; transport: 'cursor-cli' } {
  if (!cursorCliPresent()) {
    throw new GrokError(`cursor-agent CLI missing (${CURSOR_CLI})`, 0, '')
  }
  const prompt = buildPrompt(options)
  const env = { ...process.env }
  delete env.XAI_API_KEY
  // Keep CURSOR_API_KEY — it is the Cursor plan, not xAI billing.
  const timeoutMs = options.timeoutMs ?? 300_000
  const res = spawnSync(
    CURSOR_CLI,
    ['-p', '--trust', '--mode', 'ask', '--output-format', 'text', '--model', CURSOR_GROK_MODEL, prompt],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs,
      env,
    },
  )
  if (res.error || res.status !== 0) {
    throw classifyCursorFailure(res)
  }
  const raw = String(res.stdout ?? '').trim()
  if (!raw) {
    throw new GrokError('cursor-agent returned empty content', 0, String(res.stderr ?? '').slice(0, 800))
  }
  try {
    return {
      value: parseJsonLoose<T>(raw),
      raw,
      costUsd: null,
      model: options.model ?? GROK_MODELS.text,
      transport: 'cursor-cli',
    }
  } catch (e) {
    throw new GrokError(
      'cursor-agent returned non-JSON structured content',
      0,
      (e instanceof Error ? e.message : String(e)).slice(0, 400) + '\n' + raw.slice(0, 600),
    )
  }
}
