/**
 * lib/agent/tools/law.test.ts — unit tests for the `law_lookup` tool.
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md R4.2/R4.3.
 *
 * Mocked only (no live Supabase, no live Anthropic call): '@/lib/ai/anthropic'
 * and '@/lib/data/agent/legal' are both stubbed so these tests never touch a
 * network or the production database.
 *
 * Covers the three contract requirements:
 *  1. classifier fail-open — an Anthropic error (or unparseable output) must
 *     resolve to `false` (general), never throw and never silently drop the
 *     question.
 *  2. zero-hit path flags Matt — a general question with no corpus hits
 *     inserts a crm_broker_alerts row via flagLawQuestionToMatt(reason:
 *     'not-in-corpus') instead of returning an empty answer.
 *  3. citation propagation — every corpus hit returned by searchLegalCorpus
 *     becomes one AgentCitation on the ToolOutcome, in the shape the §0
 *     tracer (lib/agent/trace.ts) expects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentContext } from '@/lib/agent/types'

const messagesCreateMock = vi.fn()
vi.mock('@/lib/ai/anthropic', () => ({
  createAnthropic: () => ({ messages: { create: messagesCreateMock } }),
  CLASSIFIER_MODEL: 'claude-haiku-4-5-20251001',
}))

const searchLegalCorpusMock = vi.fn()
const flagLawQuestionToMattMock = vi.fn()
vi.mock('@/lib/data/agent/legal', () => ({
  searchLegalCorpus: (...args: unknown[]) => searchLegalCorpusMock(...args),
  flagLawQuestionToMatt: (...args: unknown[]) => flagLawQuestionToMattMock(...args),
}))

import { lawTools, classifyDealSpecific } from './law'

const ctx: AgentContext = {
  brokerSlug: 'rebecca',
  brokerEmail: 'rebeccapeterson@ryan-realty.com',
  brokerDisplayName: 'Rebecca',
  sessionId: 'session-1',
  brokerCell: '+15555550123',
}

function textMessage(text: string) {
  return { content: [{ type: 'text', text }] }
}

beforeEach(() => {
  messagesCreateMock.mockReset()
  searchLegalCorpusMock.mockReset()
  flagLawQuestionToMattMock.mockReset()
})

describe('classifyDealSpecific — R4.3 fail-open contract', () => {
  it('fails open to general (false) when the Anthropic call throws', async () => {
    messagesCreateMock.mockRejectedValue(new Error('network down'))
    await expect(classifyDealSpecific('do I need a lead paint disclosure on a 1972 build')).resolves.toBe(false)
  })

  it('fails open to general (false) when the model returns unparseable output', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('not json at all'))
    await expect(classifyDealSpecific('anything')).resolves.toBe(false)
  })

  it('returns true when the model classifies the question as deal-specific', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('{"dealSpecific": true}'))
    await expect(classifyDealSpecific('can my client back out of the Henderson deal')).resolves.toBe(true)
  })

  it('returns false when the model classifies the question as general', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('{"dealSpecific": false}'))
    await expect(classifyDealSpecific('do I need a well test disclosure')).resolves.toBe(false)
  })
})

describe('law_lookup tool — deal-specific routing', () => {
  it('flags Matt and never answers in-thread when the question is deal-specific', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('{"dealSpecific": true}'))
    flagLawQuestionToMattMock.mockResolvedValue(true)

    const [tool] = lawTools(ctx)
    const outcome = await tool.handler({ question: 'can my client back out of the Henderson deal' }, ctx)

    expect(flagLawQuestionToMattMock).toHaveBeenCalledWith({
      brokerSlug: 'rebecca',
      question: 'can my client back out of the Henderson deal',
      reason: 'deal-specific',
    })
    expect(searchLegalCorpusMock).not.toHaveBeenCalled()
    expect(outcome.result).toMatchObject({ ok: true, dealSpecific: true, flaggedToMatt: true })
    expect((outcome.result as { instruction: string }).instruction).toMatch(/flagged it to Matt/i)
    expect(outcome.citations).toBeUndefined()
  })
})

describe('law_lookup tool — zero-hit path (R4.1/R4.2)', () => {
  it('flags Matt with reason "not-in-corpus" when the search returns nothing', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('{"dealSpecific": false}'))
    searchLegalCorpusMock.mockResolvedValue([])
    flagLawQuestionToMattMock.mockResolvedValue(true)

    const [tool] = lawTools(ctx)
    const question = 'is there a rule about drone photography disclosures'
    const outcome = await tool.handler({ question }, ctx)

    expect(searchLegalCorpusMock).toHaveBeenCalledWith(question, 5)
    expect(flagLawQuestionToMattMock).toHaveBeenCalledWith({
      brokerSlug: 'rebecca',
      question,
      reason: 'not-in-corpus',
    })
    expect(outcome.result).toMatchObject({ ok: true, dealSpecific: false, hits: [], flaggedToMatt: true })
    expect((outcome.result as { instruction: string }).instruction).toMatch(/not covered by the ingested law corpus/i)
    expect(outcome.citations).toBeUndefined()
  })
})

describe('law_lookup tool — citation propagation (§0 tracer contract)', () => {
  it('carries every corpus hit into ToolOutcome.citations in the AgentCitation shape', async () => {
    messagesCreateMock.mockResolvedValue(textMessage('{"dealSpecific": false}'))
    searchLegalCorpusMock.mockResolvedValue([
      {
        citation: 'ORS 696.820',
        heading: 'Agency disclosure pamphlet',
        snippet: 'The Real Estate Commissioner shall prescribe by rule the format and content...',
        url: 'https://oregon.public.law/statutes/ors_696.820',
        corpusVersion: '2026-08-01',
        effectiveDate: null,
      },
      {
        citation: 'OAR 863-015-0215',
        heading: 'Initial Agency Disclosure Pamphlet',
        snippet: 'For purposes of this rule, "at first contact" means...',
        url: 'https://oregon.public.law/rules/oar_863-015-0215',
        corpusVersion: '2026-08-01',
        effectiveDate: null,
      },
    ])

    const [tool] = lawTools(ctx)
    const outcome = await tool.handler({ question: 'when do I need to give the agency disclosure pamphlet' }, ctx)

    expect(flagLawQuestionToMattMock).not.toHaveBeenCalled()
    expect(outcome.citations).toEqual([
      {
        figure: 'ORS 696.820',
        source: 'legal_corpus 2026-08-01 https://oregon.public.law/statutes/ors_696.820',
        detail: 'Agency disclosure pamphlet',
      },
      {
        figure: 'OAR 863-015-0215',
        source: 'legal_corpus 2026-08-01 https://oregon.public.law/rules/oar_863-015-0215',
        detail: 'Initial Agency Disclosure Pamphlet',
      },
    ])
    expect((outcome.result as { hits: unknown[] }).hits).toHaveLength(2)
    expect((outcome.result as { instruction: string }).instruction).toMatch(/quote at least one citation/i)
  })

  it('rejects an empty question without calling the classifier or the corpus', async () => {
    const [tool] = lawTools(ctx)
    const outcome = await tool.handler({ question: '   ' }, ctx)
    expect(messagesCreateMock).not.toHaveBeenCalled()
    expect(searchLegalCorpusMock).not.toHaveBeenCalled()
    expect(flagLawQuestionToMattMock).not.toHaveBeenCalled()
    expect(outcome.result).toMatchObject({ ok: false })
  })
})
