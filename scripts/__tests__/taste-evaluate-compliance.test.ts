import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { classForRoute, loadTasteCatalog, optionListComplianceLine, optionListIds } from '../lib/taste-catalog.mjs'
import {
  buildEvaluatorPrompt,
  describeJudgeStep,
  isOffListOnlyRejection,
  resolveWithOffListRetry,
  validateJudgeAnswer,
} from '../taste-evaluate'

/**
 * Break-tests for the operator note on 2026-09-15 (three real
 * scripts/taste-evaluate.ts runs, two rejected for an invented replaceWith
 * like "beeswarm" / "horizontal bar" that is not on the class's option
 * list). scripts/taste-evaluate.ts §1 appends an unconditional compliance
 * block naming the option ids verbatim; §2 re-asks the SAME judge link once
 * when a rejection is off-list-only, never for any other verdict. This file
 * proves both without spawning grok/cursor-agent/claude — `ask` is stubbed.
 */

const raw = JSON.parse(readFileSync('design_system/public/taste-catalog.json', 'utf8'))
const loaded = loadTasteCatalog(raw)
if (loaded.problems.length) throw new Error(`fixture catalog invalid: ${loaded.problems.join('; ')}`)

const CLASS_KEY = classForRoute(loaded, 'price-drops') ?? 'price-drops'
const IDS = Array.from(optionListIds(loaded, CLASS_KEY))

const STEP = { link: 'grok' as const, reason: 'fixture' }

function judgeAnswer(obj: Record<string, unknown>) {
  return { content: JSON.stringify(obj), evaluatorModel: 'grok-4.6', transport: 'grok-cli' as const }
}

describe('optionListComplianceLine — real catalog class has a real option list', () => {
  it('price-drops has at least one option id to test against', () => {
    expect(IDS.length).toBeGreaterThan(0)
  })
})

describe('(a) buildEvaluatorPrompt — the unconditional transport compliance block', () => {
  it('names every option id for the class verbatim and states the copy-verbatim-or-null constraint', () => {
    const line = optionListComplianceLine(loaded, CLASS_KEY)
    for (const id of IDS) expect(line).toContain(id)
    expect(line).toMatch(/MUST be copied verbatim from the option list/i)
    expect(line).toMatch(/or be exactly null/i)
    expect(line).toMatch(/do not invent a descriptive phrase/i)
    expect(line).toMatch(/beeswarm/i)
    expect(line).toMatch(/horizontal bar/i)
    expect(line).toMatch(/a form you would like is not an option id/i)
  })

  it('is present in the fully assembled prompt regardless of a competitiveBrief branch', () => {
    const images = [{ name: 'price-drops-desktop.png', path: '/tmp/shots/price-drops-desktop.png' }]
    const complianceLine = optionListComplianceLine(loaded, CLASS_KEY)
    const base = {
      images,
      args: {},
      catalogNote: '',
      briefNote: '',
      refNote: '',
      bar: 'There is NO previous recorded mark for this page class.',
      complianceLine,
    }
    const withoutBrief = buildEvaluatorPrompt({ ...base, competitiveBrief: null })
    const withBrief = buildEvaluatorPrompt({
      ...base,
      competitiveBrief: { beats: [{ id: '1', text: 'x'.repeat(25) }] },
    })
    for (const prompt of [withoutBrief, withBrief]) {
      expect(prompt).toContain(complianceLine)
      for (const id of IDS) expect(prompt).toContain(id)
    }
  })
})

describe('(b) resolveWithOffListRetry — one re-ask on an off-list-only rejection', () => {
  it('re-asks the SAME judge link exactly once, and accepts a compliant second answer', () => {
    const first = judgeAnswer({
      demoMatch: true,
      defects: [{ section: '.field', severity: 'taste', finding: 'wrong display form here', replaceWith: 'beeswarm' }],
    })
    const second = judgeAnswer({
      demoMatch: true,
      defects: [{ section: '.field', severity: 'taste', finding: 'wrong display form here', replaceWith: IDS[0] }],
    })
    const ask = vi.fn().mockReturnValue({ answer: second })
    const logs: string[] = []
    const result = resolveWithOffListRetry({
      step: STEP,
      promptText: 'THE BASE PROMPT',
      loaded,
      classKey: CLASS_KEY,
      competitiveBrief: null,
      answer: first,
      ask,
      log: (m) => logs.push(m),
    })

    expect(ask).toHaveBeenCalledTimes(1)
    const [askedStep, askedPrompt] = ask.mock.calls[0]!
    expect(askedStep).toBe(STEP)
    expect(askedPrompt).toContain('THE BASE PROMPT')
    expect(askedPrompt).toContain('beeswarm')
    for (const id of IDS) expect(askedPrompt).toContain(id)

    expect(result.retried).toBe(true)
    expect(result.answer).toBe(second)
    expect(result.validation.optionProblems).toEqual([])
    expect(result.validation.missingReplace).toBe(0)
    expect(logs.join('\n')).toMatch(/taste-evaluate: replaceWith off-list \(beeswarm\), re-asking grok CLI once\./)
  })

  it('(c) a second off-list answer fails with the original message shape — no second retry', () => {
    const first = judgeAnswer({
      demoMatch: true,
      defects: [{ section: '.a', severity: 'taste', finding: 'still the wrong form', replaceWith: 'beeswarm' }],
    })
    const second = judgeAnswer({
      demoMatch: true,
      defects: [{ section: '.a', severity: 'taste', finding: 'still the wrong form', replaceWith: 'horizontal bar' }],
    })
    const ask = vi.fn().mockReturnValue({ answer: second })
    const result = resolveWithOffListRetry({
      step: STEP,
      promptText: 'p',
      loaded,
      classKey: CLASS_KEY,
      competitiveBrief: null,
      answer: first,
      ask,
      log: () => {},
    })

    // Exactly the one re-ask — a second off-list answer is not chased with a third ask.
    expect(ask).toHaveBeenCalledTimes(1)
    expect(result.retried).toBe(true)
    expect(result.validation.optionProblems.length).toBeGreaterThan(0)
    // Same message shape main() prints on a first-try rejection (replaceWithOptionProblems' own wording).
    expect(result.validation.optionProblems.join('\n')).toMatch(/replaceWith "horizontal bar" is not on the option list for/)
  })

  it('a CLI failure on the re-ask falls back to the original (still off-list) validation, not a crash', () => {
    const first = judgeAnswer({
      demoMatch: true,
      defects: [{ section: '.a', severity: 'taste', finding: 'still the wrong form', replaceWith: 'beeswarm' }],
    })
    const ask = vi.fn().mockReturnValue({ fail: { kind: 'error', message: 'boom' } })
    const result = resolveWithOffListRetry({
      step: STEP,
      promptText: 'p',
      loaded,
      classKey: CLASS_KEY,
      competitiveBrief: null,
      answer: first,
      ask,
      log: () => {},
    })
    expect(ask).toHaveBeenCalledTimes(1)
    expect(result.retried).toBe(true)
    expect(result.answer).toBe(first)
    expect(result.validation.optionProblems.length).toBeGreaterThan(0)
  })

  it('(d) a demoMatch:false answer is NOT retried — that is a verdict, not a slip', () => {
    const answer = judgeAnswer({
      demoMatch: false,
      defects: [{ section: '.a', severity: 'craft', finding: 'a craft-only finding', replaceWith: null }],
    })
    const ask = vi.fn()
    const result = resolveWithOffListRetry({
      step: STEP,
      promptText: 'p',
      loaded,
      classKey: CLASS_KEY,
      competitiveBrief: null,
      answer,
      ask,
      log: () => {},
    })
    expect(ask).not.toHaveBeenCalled()
    expect(result.retried).toBe(false)
    expect(result.answer).toBe(answer)
    expect(isOffListOnlyRejection(validateJudgeAnswer(answer.content, { loaded, classKey: CLASS_KEY, competitiveBrief: null }))).toBe(
      false,
    )
  })

  it('does not retry a JSON-schema rejection (demoMatch omitted) even when replaceWith is also off-list', () => {
    const answer = judgeAnswer({
      // demoMatch omitted entirely -> schemaProblems non-empty
      defects: [{ section: '.a', severity: 'taste', finding: 'no demoMatch on this one', replaceWith: 'beeswarm' }],
    })
    const ask = vi.fn()
    const result = resolveWithOffListRetry({
      step: STEP,
      promptText: 'p',
      loaded,
      classKey: CLASS_KEY,
      competitiveBrief: null,
      answer,
      ask,
      log: () => {},
    })
    expect(ask).not.toHaveBeenCalled()
    expect(result.retried).toBe(false)
    expect(result.validation.schemaProblems.length).toBeGreaterThan(0)
    expect(result.validation.optionProblems.length).toBeGreaterThan(0)
  })

  it('describeJudgeStep names each link', () => {
    expect(describeJudgeStep({ link: 'grok', reason: 'x' })).toBe('grok CLI')
    expect(describeJudgeStep({ link: 'cursor', model: 'cursor-grok-4.6-high', reason: 'x' })).toBe(
      'cursor-agent (cursor-grok-4.6-high)',
    )
    expect(describeJudgeStep({ link: 'claude', alias: 'opus', reason: 'x' })).toBe('claude CLI (opus)')
  })
})
