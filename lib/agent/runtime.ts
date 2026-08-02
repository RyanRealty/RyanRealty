/**
 * lib/agent/runtime.ts — runAgentTurn, the transport-agnostic agent core
 * (R2.1-R2.4).
 *
 * lib/agent/ingress.ts (R1.1/R1.2, SMS transport) owns everything before and
 * after this call: it verifies the webhook, resolves/touches the session,
 * persists the inbound broker turn, debounces bursts, calls runAgentTurn with
 * the aggregated text, THEN persists the returned reply as the final
 * role='agent' turn (via lib/data/agent/turn-intake.ts's insertAgentTurn) and
 * sends the SMS. That means runAgentTurn must NEVER also persist a role='agent'
 * turn for its own reply — every path below returns an AgentTurnResult and
 * leaves that one write to ingress.ts, so a turn is never duplicated. It DOES
 * persist per-tool-call audit rows (role='tool') itself, since ingress.ts has
 * no visibility into what happened inside this call.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic, AGENT_MODEL, modelCostUsd } from '@/lib/ai/anthropic'
import { buildSystemPrompt, buildHelpText } from './prompt'
import { parseKeyword, type ParsedKeyword } from './keywords'
import { verifyReplyTrace } from './trace'
import { buildModelHistory } from './session'
import { getAgentTools } from './tools'
import { appendTurn, expireSession, touchSession } from '@/lib/data/agent/sessions'
import { recordAgentCost, brokerSpendTodayUsd } from '@/lib/data/agent/cost-ledger'
import { setAgentEnabled } from '@/lib/data/agent/broker-agent-flags'
import type { AgentContext, AgentTool, AgentCitation, AgentTurnResult, ToolOutcome } from '@/lib/agent/types'

const MAX_TOOL_ROUNDS = 8
const MODEL_TIMEOUT_MS = 60_000
const MAX_TOKENS = 16_000
const DAILY_CAP_USD = 3.0

const SAFE_FALLBACK_REPLY =
  "I want to double check a number before I send it. Give me a moment and I'll follow up with the confirmed figures."
const EMPTY_MODEL_REPLY = "Let me get back to you on that in a moment."

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

function toAnthropicTools(tools: AgentTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool['input_schema'],
  }))
}

interface ToolCallRecord {
  name: string
  input: Record<string, unknown>
  result: unknown
  citations: AgentCitation[]
}

interface ModelLoopResult {
  finalText: string
  messages: Anthropic.MessageParam[]
  toolCallCount: number
  citations: AgentCitation[]
  toolResultCorpus: string
  toolCallRecords: ToolCallRecord[]
  costUsd: number
}

async function runModelLoop(
  client: Anthropic,
  system: string,
  initialMessages: Anthropic.MessageParam[],
  tools: AgentTool[],
  ctx: AgentContext,
): Promise<ModelLoopResult> {
  const anthropicTools = toAnthropicTools(tools)
  const toolByName = new Map(tools.map((t) => [t.name, t]))
  const messages: Anthropic.MessageParam[] = [...initialMessages]
  let toolCallCount = 0
  let costUsd = 0
  const citations: AgentCitation[] = []
  const toolResultChunks: string[] = []
  const toolCallRecords: ToolCallRecord[] = []

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const forceFinal = round === MAX_TOOL_ROUNDS
    // tools must be present on EVERY call once history contains tool_use /
    // tool_result blocks (the API 400s otherwise) — forceFinal disables
    // further use via tool_choice instead of dropping the definitions.
    const response = await client.messages.create(
      {
        model: AGENT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        tools: anthropicTools,
        ...(forceFinal ? { tool_choice: { type: 'none' } } : {}),
      } as Anthropic.MessageCreateParamsNonStreaming,
      { timeout: MODEL_TIMEOUT_MS },
    )
    costUsd += modelCostUsd(AGENT_MODEL, response.usage.input_tokens, response.usage.output_tokens)
    messages.push({ role: 'assistant', content: response.content as Anthropic.MessageParam['content'] })

    if (response.stop_reason !== 'tool_use' || forceFinal) {
      return {
        finalText: extractText(response.content),
        messages,
        toolCallCount,
        citations,
        toolResultCorpus: toolResultChunks.join('\n'),
        toolCallRecords,
        costUsd,
      }
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUseBlocks) {
      toolCallCount++
      const input = (block.input ?? {}) as Record<string, unknown>
      const tool = toolByName.get(block.name)
      let outcome: ToolOutcome
      if (!tool) {
        outcome = { result: { error: `tool "${block.name}" is not available yet` } }
      } else {
        try {
          outcome = await tool.handler(input, ctx)
        } catch (err) {
          outcome = { result: { error: err instanceof Error ? err.message : String(err) } }
        }
      }
      if (outcome.citations?.length) citations.push(...outcome.citations)
      const resultJson = JSON.stringify(outcome.result ?? null)
      toolResultChunks.push(resultJson)
      toolCallRecords.push({ name: block.name, input, result: outcome.result ?? null, citations: outcome.citations ?? [] })
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultJson })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  // Unreachable: the forceFinal iteration always returns above.
  throw new Error('[runModelLoop] exhausted rounds without a final response')
}

function findTool(tools: AgentTool[], name: string): AgentTool | undefined {
  return tools.find((t) => t.name === name)
}

interface DirectToolCall {
  outcome: ToolOutcome
  record: ToolCallRecord
}

async function callToolDirect(
  tools: AgentTool[],
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<DirectToolCall | null> {
  const tool = findTool(tools, name)
  if (!tool) return null
  let outcome: ToolOutcome
  try {
    outcome = await tool.handler(input, ctx)
  } catch (err) {
    outcome = { result: { error: err instanceof Error ? err.message : String(err) } }
  }
  return {
    outcome,
    record: { name, input, result: outcome.result ?? null, citations: outcome.citations ?? [] },
  }
}

/** Persist one role='tool' audit row per tool call this turn — the digest
 *  (R3.5/R4.4) and per-tool audit trail. Never the final role='agent' reply;
 *  see the module doc for why that write belongs to lib/agent/ingress.ts. */
async function persistToolCallRecords(sessionId: string, records: ToolCallRecord[]): Promise<void> {
  for (const record of records) {
    await appendTurn({
      sessionId,
      role: 'tool',
      content: { name: record.name, input: record.input, result: record.result },
      toolCalls: [{ name: record.name, input: record.input }],
      citations: record.citations,
      costUsd: null,
    })
  }
}

/**
 * Run one broker SMS turn end to end: keyword pre-pass, daily cost cap, the
 * Opus 5 tool-use loop, §0 trace verification (with one corrective retry),
 * tool-call audit persistence, and the cost ledger write.
 */
export async function runAgentTurn(
  ctx: AgentContext,
  inboundText: string,
  mediaUrls?: string[],
): Promise<AgentTurnResult> {
  await touchSession(ctx.sessionId)

  const tools = getAgentTools(ctx)

  // ── (a) Deterministic keyword pre-pass — never touches the model. ────────
  const parsedKeyword = parseKeyword(inboundText)
  if (parsedKeyword) {
    const handled = await handleKeyword(parsedKeyword, ctx, tools)
    if (handled.record) await persistToolCallRecords(ctx.sessionId, [handled.record])
    return {
      reply: { text: handled.text },
      costUsd: 0,
      toolCallCount: handled.record ? 1 : 0,
      citations: handled.citations,
    }
  }

  // ── (b) Daily per-broker cost cap. ────────────────────────────────────────
  const spentToday = await brokerSpendTodayUsd(ctx.brokerSlug)
  if (spentToday >= DAILY_CAP_USD) {
    const text = "You've hit today's budget for me. I'll pick back up tomorrow. Matt can raise the cap if this one's urgent."
    return { reply: { text }, costUsd: 0, toolCallCount: 0, citations: [] }
  }

  // ── (c) The Opus 5 tool-use loop. ──────────────────────────────────────────
  const client = createAnthropic()
  const system = buildSystemPrompt(ctx)
  const history = await buildModelHistory(ctx.sessionId)
  const mediaNote = mediaUrls?.length ? `\n\n[${mediaUrls.length} attachment(s) received with this message]` : ''
  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: `${inboundText}${mediaNote}` }]

  const loop = await runModelLoop(client, system, messages, tools, ctx)

  // ── (d) §0 trace verification, one corrective retry, then a safe fallback. ─
  let finalText = loop.finalText || EMPTY_MODEL_REPLY
  let costUsd = loop.costUsd
  const check = verifyReplyTrace(finalText, loop.toolResultCorpus)

  if (!check.ok) {
    const nudge =
      `Your last reply included figures that were not fetched this turn: ${check.violations.join(', ')}. ` +
      'Rewrite the reply using ONLY numbers that appear in the tool results already returned this turn. ' +
      'If you cannot state a figure confidently, describe it qualitatively instead of inventing or rounding it.'
    const retryMessages: Anthropic.MessageParam[] = [...loop.messages, { role: 'user', content: nudge }]
    // Same rule as runModelLoop: history carries tool blocks, so tools must be
    // declared; tool_choice none keeps the retry text-only.
    const retryResponse = await client.messages.create(
      {
        model: AGENT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: retryMessages,
        tools: toAnthropicTools(tools),
        tool_choice: { type: 'none' },
      } as Anthropic.MessageCreateParamsNonStreaming,
      { timeout: MODEL_TIMEOUT_MS },
    )
    costUsd += modelCostUsd(AGENT_MODEL, retryResponse.usage.input_tokens, retryResponse.usage.output_tokens)
    const retryText = extractText(retryResponse.content)
    const retryCheck = verifyReplyTrace(retryText, loop.toolResultCorpus)
    finalText = retryCheck.ok && retryText ? retryText : SAFE_FALLBACK_REPLY
  }

  // ── (e) Persist tool-call audit rows + the cost ledger. ───────────────────
  // Audit/ledger failures are logged, never surfaced: by this point the broker
  // has a verified reply, and a bookkeeping hiccup must not eat it (found live
  // 2026-08-01 when a cost_type CHECK constraint nuked an otherwise-good turn).
  try {
    await persistToolCallRecords(ctx.sessionId, loop.toolCallRecords)
    if (costUsd > 0) {
      await recordAgentCost({
        brokerSlug: ctx.brokerSlug,
        sessionId: ctx.sessionId,
        costUsd,
        meta: { toolCallCount: loop.toolCallCount },
      })
    }
  } catch (err) {
    console.error('[runAgentTurn] audit/ledger persist failed (reply still sent):', err)
  }

  return { reply: { text: finalText }, costUsd, toolCallCount: loop.toolCallCount, citations: loop.citations }
}

// ── Keyword handlers ─────────────────────────────────────────────────────────

interface KeywordHandled {
  text: string
  citations: AgentCitation[]
  /** Set when a produce-protocol tool was actually invoked, so the caller can
   *  persist one role='tool' audit row for it. */
  record?: ToolCallRecord
}

function messageFrom(result: unknown, fallback: string): string {
  if (result && typeof result === 'object' && typeof (result as { message?: unknown }).message === 'string') {
    return (result as { message: string }).message
  }
  return fallback
}

async function handleKeyword(parsed: ParsedKeyword, ctx: AgentContext, tools: AgentTool[]): Promise<KeywordHandled> {
  switch (parsed.keyword) {
    case 'HELP':
      return { text: buildHelpText(ctx), citations: [] }

    case 'RESET': {
      await expireSession(ctx.sessionId)
      return { text: "Starting fresh. Text me whenever you're ready.", citations: [] }
    }

    case 'PAUSE': {
      const result = await setAgentEnabled(ctx.brokerSlug, false)
      if (!result.ok) {
        return { text: "I couldn't turn myself off just now. Ask Matt to disable me on this line for now.", citations: [] }
      }
      return { text: "I'm paused on this line. Ask Matt to turn me back on when you're ready.", citations: [] }
    }

    case 'STATUS': {
      const call = await callToolDirect(tools, 'job_status', {}, ctx)
      if (!call) return { text: "I don't have job tracking wired up yet — nothing to report.", citations: [] }
      return {
        text: messageFrom(call.outcome.result, 'Nothing in flight right now.'),
        citations: call.outcome.citations ?? [],
        record: call.record,
      }
    }

    case 'APPROVE':
    case 'HOLD': {
      const toolName = parsed.keyword === 'APPROVE' ? 'approve_action' : 'hold_action'
      const input = parsed.handle != null ? { handle: parsed.handle } : {}
      const call = await callToolDirect(tools, toolName, input, ctx)
      if (!call) return { text: "I don't have anything to approve or hold right now.", citations: [] }
      return {
        text: messageFrom(call.outcome.result, 'Done.'),
        citations: call.outcome.citations ?? [],
        record: call.record,
      }
    }

    default:
      return { text: buildHelpText(ctx), citations: [] }
  }
}
