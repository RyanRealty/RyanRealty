/**
 * lib/agent/e2e.test.ts — R5.1 golden-transcript harness for the broker SMS agent.
 *
 * Drives runAgentTurn end to end with a scripted Anthropic client and scripted
 * tools — no network, no live DB (int tests write to production; forbidden).
 * These are the conversation shapes the plan's DONE contract names: property
 * Q&A with §0 tracing, the trace-violation fallback, keyword handling, the
 * daily cost cap, and a multi-round tool sequence (the Rebecca scenario spine).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentContext, AgentTool } from '@/lib/agent/types'

const appendTurn = vi.fn(async () => ({ id: 'turn-x' }))
const expireSession = vi.fn(async () => undefined)
const touchSession = vi.fn(async () => undefined)
const recordAgentCost = vi.fn(async () => undefined)
const brokerSpendTodayUsd = vi.fn(async () => 0)
const setAgentEnabled = vi.fn(async () => ({ ok: true }))
const buildModelHistory = vi.fn(async () => [])

vi.mock('@/lib/data/agent/sessions', () => ({
  appendTurn: (...a: unknown[]) => appendTurn(...(a as [])),
  expireSession: (...a: unknown[]) => expireSession(...(a as [])),
  touchSession: (...a: unknown[]) => touchSession(...(a as [])),
}))
vi.mock('@/lib/data/agent/cost-ledger', () => ({
  recordAgentCost: (...a: unknown[]) => recordAgentCost(...(a as [])),
  brokerSpendTodayUsd: (...a: unknown[]) => brokerSpendTodayUsd(...(a as [])),
}))
vi.mock('@/lib/data/agent/broker-agent-flags', () => ({
  setAgentEnabled: (...a: unknown[]) => setAgentEnabled(...(a as [])),
}))
vi.mock('./session', () => ({
  buildModelHistory: (...a: unknown[]) => buildModelHistory(...(a as [])),
}))

// Scripted model: each entry is one messages.create response.
type ScriptedResponse = {
  stop_reason: string
  content: Array<Record<string, unknown>>
}
let script: ScriptedResponse[] = []
let createCalls: Array<Record<string, unknown>> = []
vi.mock('@/lib/ai/anthropic', () => ({
  AGENT_MODEL: 'claude-opus-5',
  CLASSIFIER_MODEL: 'claude-haiku-4-5-20251001',
  modelCostUsd: () => 0.01,
  createAnthropic: () => ({
    messages: {
      create: async (params: Record<string, unknown>) => {
        createCalls.push(params)
        const next = script.shift()
        if (!next) throw new Error('scripted model exhausted')
        return { ...next, usage: { input_tokens: 100, output_tokens: 50 } }
      },
    },
  }),
}))

// Scripted tool registry.
let scriptedTools: AgentTool[] = []
vi.mock('./tools', () => ({
  getAgentTools: () => scriptedTools,
}))

import { runAgentTurn } from './runtime'

const ctx: AgentContext = {
  brokerSlug: 'rebecca',
  brokerEmail: 'rebeccapeterson@ryan-realty.com',
  brokerDisplayName: 'Rebecca Peterson',
  sessionId: 'sess-e2e',
  brokerCell: '+15412503380',
}

function textBlock(text: string) {
  return { type: 'text', text }
}
function toolUseBlock(id: string, name: string, input: Record<string, unknown>) {
  return { type: 'tool_use', id, name, input }
}

beforeEach(() => {
  script = []
  createCalls = []
  scriptedTools = []
  vi.clearAllMocks()
  brokerSpendTodayUsd.mockResolvedValue(0)
})

describe('golden: market Q&A with §0 tracing', () => {
  it('quotes only fetched figures and attributes citations', async () => {
    scriptedTools = [
      {
        name: 'market_stats',
        description: 'market stats',
        input_schema: { type: 'object', properties: {} },
        handler: async () => ({
          result: { city: 'Redmond', active: 214, medianList: 525000, mos: 3.2 },
          citations: [{ figure: '$525,000', source: 'market_pulse_live city/redmond' }],
        }),
      },
    ]
    script = [
      { stop_reason: 'tool_use', content: [toolUseBlock('t1', 'market_stats', { city: 'Redmond' })] },
      {
        stop_reason: 'end_turn',
        content: [textBlock('Redmond SFR: 214 active, median list $525,000, 3.2 months of supply.')],
      },
    ]
    const out = await runAgentTurn(ctx, "what's redmond looking like")
    expect(out.reply.text).toContain('$525,000')
    expect(out.toolCallCount).toBe(1)
    expect(out.citations.some((c) => c.figure === '$525,000')).toBe(true)
    // tools param present on every call (tool blocks in history require it)
    expect(createCalls.every((c) => Array.isArray(c.tools))).toBe(true)
    // audit row persisted for the tool call
    expect(appendTurn).toHaveBeenCalledWith(expect.objectContaining({ role: 'tool' }))
    expect(recordAgentCost).toHaveBeenCalled()
  })
})

describe('golden: §0 trace enforcement', () => {
  it('falls back safely when the model invents a number twice', async () => {
    scriptedTools = [
      {
        name: 'market_stats',
        description: 'market stats',
        input_schema: { type: 'object', properties: {} },
        handler: async () => ({ result: { active: 214 } }),
      },
    ]
    script = [
      { stop_reason: 'tool_use', content: [toolUseBlock('t1', 'market_stats', {})] },
      { stop_reason: 'end_turn', content: [textBlock('Median price is $999,000 right now.')] },
      // corrective retry still invents
      { stop_reason: 'end_turn', content: [textBlock('About $850,000 or so.')] },
    ]
    const out = await runAgentTurn(ctx, 'median price in redmond?')
    expect(out.reply.text).not.toContain('$999,000')
    expect(out.reply.text).not.toContain('$850,000')
    // the retry call also declared tools with tool_choice none
    const retry = createCalls[2]
    expect(Array.isArray(retry.tools)).toBe(true)
    expect((retry.tool_choice as { type?: string })?.type).toBe('none')
  })

  it('accepts the corrected reply on retry', async () => {
    scriptedTools = [
      {
        name: 'market_stats',
        description: 'm',
        input_schema: { type: 'object', properties: {} },
        handler: async () => ({ result: { medianList: 525000 } }),
      },
    ]
    script = [
      { stop_reason: 'tool_use', content: [toolUseBlock('t1', 'market_stats', {})] },
      { stop_reason: 'end_turn', content: [textBlock('Median is $999,000.')] },
      { stop_reason: 'end_turn', content: [textBlock('Median list is $525,000.')] },
    ]
    const out = await runAgentTurn(ctx, 'median?')
    expect(out.reply.text).toContain('$525,000')
  })
})

describe('golden: keywords never touch the model', () => {
  it('HELP is deterministic', async () => {
    const out = await runAgentTurn(ctx, 'help')
    expect(out.costUsd).toBe(0)
    expect(createCalls.length).toBe(0)
    expect(out.reply.text.length).toBeGreaterThan(20)
  })

  it('APPROVE 2 routes to approve_action with the handle', async () => {
    const approveHandler = vi.fn(async () => ({ result: { message: 'Approved. It posts within 30 minutes.' } }))
    scriptedTools = [
      { name: 'approve_action', description: 'a', input_schema: { type: 'object', properties: {} }, handler: approveHandler },
    ]
    const out = await runAgentTurn(ctx, 'APPROVE 2')
    expect(approveHandler).toHaveBeenCalledWith({ handle: 2 }, ctx)
    expect(out.reply.text).toContain('Approved')
    expect(createCalls.length).toBe(0)
  })

  it('PAUSE flips the per-broker flag', async () => {
    const out = await runAgentTurn(ctx, 'pause')
    expect(setAgentEnabled).toHaveBeenCalledWith('rebecca', false)
    expect(out.reply.text.toLowerCase()).toContain('paused')
  })
})

describe('golden: daily cost cap', () => {
  it('halts politely with zero model calls at the cap', async () => {
    brokerSpendTodayUsd.mockResolvedValue(3.0)
    const out = await runAgentTurn(ctx, 'make me a flyer')
    expect(createCalls.length).toBe(0)
    expect(out.reply.text.toLowerCase()).toContain('budget')
  })
})

describe('golden: Rebecca multi-round spine (email → ingest → draft)', () => {
  it('sequences three tool rounds and returns the confirm-back', async () => {
    const calls: string[] = []
    const mk = (name: string, result: unknown): AgentTool => ({
      name,
      description: name,
      input_schema: { type: 'object', properties: {} },
      handler: async () => {
        calls.push(name)
        return { result }
      },
    })
    scriptedTools = [
      mk('email_search', { candidates: [{ messageId: 'm1', from: 'rich@bendphoto.co', subject: '18705 Tumalo Reservoir — finals', attachments: 32 }] }),
      mk('fetch_assets', { ingested: 32, outliers: [], gradeCounts: { A: 9, B: 15, C: 8 } }),
      mk('create_action', { ok: true, actionId: 'a-1', message: 'Draft queued' }),
    ]
    script = [
      { stop_reason: 'tool_use', content: [toolUseBlock('t1', 'email_search', { senderHint: 'rich' })] },
      { stop_reason: 'tool_use', content: [toolUseBlock('t2', 'fetch_assets', { messageId: 'm1' })] },
      { stop_reason: 'tool_use', content: [toolUseBlock('t3', 'create_action', { action_type: 'content:list_kit' })] },
      {
        stop_reason: 'end_turn',
        content: [textBlock('Got the 32 photos from Rich for 18705 Tumalo Reservoir. Looks pre-market. Coming soon kit, or save it for launch day?')],
      },
    ]
    const out = await runAgentTurn(ctx, 'photos back from rich, make marketing materials')
    expect(calls).toEqual(['email_search', 'fetch_assets', 'create_action'])
    expect(out.toolCallCount).toBe(3)
    expect(out.reply.text).toContain('32 photos')
    expect(out.reply.text).toContain('Coming soon')
  })
})
