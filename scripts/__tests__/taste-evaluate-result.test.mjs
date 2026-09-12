import { describe, expect, it } from 'vitest'
import {
  EVALUATOR_MODEL,
  RUBRIC_PATH,
  RUBRIC_VERSION,
  competitiveBriefBlocksDone,
  demoMatchBlocksDone,
  evaluatorEnvelope,
  evaluatorResultProblems,
  grokCliFailure,
} from '../lib/taste-evaluate-result.mjs'

const ABOUT_BRIEF = {
  beats: [{ id: '1', text: 'Firm story opens the page with twenty-plus characters.' }],
}

describe('taste-evaluate-result — grok CLI honest fail', () => {
  it('names the grok-4.6 / v1-2026-09-12 instrument', () => {
    expect(EVALUATOR_MODEL).toBe('grok-4.6')
    expect(RUBRIC_VERSION).toBe('v1-2026-09-12')
    expect(RUBRIC_PATH).toBe('design_system/public/taste-evaluator.v1-2026-09-12.md')
  })

  it('refuses a missing CLI without inventing demoMatch', () => {
    const fail = grokCliFailure(127, 'no grok CLI at ~/.grok/bin/grok', '', { cliMissing: true })
    expect(fail?.kind).toBe('missing')
    expect(fail?.message).toMatch(/Do not invent demoMatch/)
    expect(fail?.message).toMatch(/in_progress/)
  })

  it('refuses a 402 without inventing demoMatch', () => {
    const fail = grokCliFailure(1, 'error: 402 Payment Required — quota exceeded', '')
    expect(fail?.kind).toBe('402')
    expect(fail?.message).toMatch(/402/)
    expect(fail?.message).toMatch(/Do not invent demoMatch/)
  })

  it('is silent on a clean CLI exit', () => {
    expect(grokCliFailure(0, '', '{"demoMatch":true}')).toBeNull()
  })
})

describe('taste-evaluate-result — demoMatch schema', () => {
  it('refuses omitted demoMatch', () => {
    const p = evaluatorResultProblems({ scores: [70, 71, 69], score: 70 })
    expect(p.join('\n')).toMatch(/demoMatch must be true or false/)
  })

  it('accepts boolean false as schema-ok but not done', () => {
    expect(evaluatorResultProblems({ demoMatch: false })).toEqual([])
    expect(demoMatchBlocksDone({ demoMatch: false })).toBe(true)
  })

  it('accepts boolean true as a pass', () => {
    expect(evaluatorResultProblems({ demoMatch: true })).toEqual([])
    expect(demoMatchBlocksDone({ demoMatch: true })).toBe(false)
  })

  it('prints the envelope so a false verdict can be recorded', () => {
    const env = evaluatorEnvelope({ parsed: { demoMatch: false, score: 72 }, shots: ['a.png'] })
    expect(env.rubricVersion).toBe('v1-2026-09-12')
    expect(env.result.demoMatch).toBe(false)
    expect(env.evaluatorModel).toBe('grok-4.6')
  })
})

describe('taste-evaluate-result — competitiveBriefPass schema', () => {
  it('refuses omitted competitiveBriefPass when a brief exists', () => {
    const p = evaluatorResultProblems({ demoMatch: true }, { competitiveBrief: ABOUT_BRIEF })
    expect(p.join('\n')).toMatch(/competitiveBriefPass must be true or false/)
    expect(p.join('\n')).toMatch(/Do not invent true/)
  })

  it('accepts boolean false as schema-ok but not done', () => {
    expect(evaluatorResultProblems({ demoMatch: true, competitiveBriefPass: false }, { competitiveBrief: ABOUT_BRIEF })).toEqual(
      [],
    )
    expect(competitiveBriefBlocksDone({ demoMatch: true, competitiveBriefPass: false }, { competitiveBrief: ABOUT_BRIEF })).toBe(
      true,
    )
  })

  it('accepts boolean true as a pass', () => {
    expect(evaluatorResultProblems({ demoMatch: true, competitiveBriefPass: true }, { competitiveBrief: ABOUT_BRIEF })).toEqual(
      [],
    )
    expect(competitiveBriefBlocksDone({ demoMatch: true, competitiveBriefPass: true }, { competitiveBrief: ABOUT_BRIEF })).toBe(
      false,
    )
  })

  it('does not require the field on routes without a brief', () => {
    expect(evaluatorResultProblems({ demoMatch: true })).toEqual([])
    expect(competitiveBriefBlocksDone({ demoMatch: true })).toBe(false)
  })
})
