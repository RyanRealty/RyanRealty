import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EVALUATORS,
  EVALUATOR_MODEL,
  RUBRIC_PATH,
  RUBRIC_VERSION,
  claudeCliFailure,
  claudeModelFromWrapper,
  competitiveBriefBlocksDone,
  demoMatchBlocksDone,
  evaluatorEnvelope,
  evaluatorResultProblems,
  CURSOR_JUDGE_MODEL,
  cursorCliFailure,
  cursorModelListed,
  grokCliFailure,
  grokFailureFallsBack,
  isAllowedEvaluator,
  judgeFamily,
  judgeOrder,
  pickFallbackAlias,
  roundJudge,
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

  it('reads the real Grok Build balance message as a 402', () => {
    const fail = grokCliFailure(1, '', 'Error: 402 Payment Required: Grok Build usage balance exhausted')
    expect(fail?.kind).toBe('402')
  })
})

describe('taste-evaluate-result — grok-4.6 through the Cursor CLI', () => {
  it('is the same judge as the grok CLI', () => {
    expect(CURSOR_JUDGE_MODEL).toBe('grok-4.6')
    expect(isAllowedEvaluator(CURSOR_JUDGE_MODEL)).toBe(true)
  })

  it('not logged in is a missing link that hands the shots on, never a verdict', () => {
    const fail = cursorCliFailure(1, "Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.", '')
    expect(fail?.kind).toBe('missing')
    expect(fail?.message).toMatch(/cursor-agent login/)
    expect(fail?.message).toMatch(/Do not invent demoMatch/)
    expect(grokFailureFallsBack(fail)).toBe(true)
  })

  it('a missing binary is missing', () => {
    expect(cursorCliFailure(null, '', '', { cliMissing: true })?.kind).toBe('missing')
    expect(cursorCliFailure(127, 'zsh: command not found: cursor-agent', '')?.kind).toBe('missing')
  })

  it('a usage cap or an unavailable model is a 402 that hands the shots on', () => {
    expect(cursorCliFailure(1, 'Error: You have hit your usage limit for this billing cycle', '')?.kind).toBe('402')
    expect(cursorCliFailure(1, 'Error: model grok-4.6 is not available for your plan', '')?.kind).toBe('402')
    // --list-models while logged out
    expect(cursorCliFailure(0, '', 'No models available for this account.')?.kind).toBe('missing')
    expect(grokFailureFallsBack(cursorCliFailure(1, '429 rate limit', ''))).toBe(true)
  })

  it('any other non-zero exit is a real error the caller must see', () => {
    const fail = cursorCliFailure(1, 'TypeError: cannot read properties of undefined', '')
    expect(fail?.kind).toBe('error')
    expect(grokFailureFallsBack(fail)).toBe(false)
  })

  it('is silent on a clean exit', () => {
    expect(cursorCliFailure(0, '', '{"demoMatch":true}')).toBeNull()
  })

  it('the judge id must be on the account model list — a lookalike or an empty list is not', () => {
    expect(cursorModelListed('Available models:\n  grok-4.6\n  claude-sonnet-5\n')).toBe(true)
    expect(cursorModelListed('- grok-4.6 (default)')).toBe(true)
    expect(cursorModelListed('grok-4.6-fast\ngrok-4.5\n')).toBe(false)
    expect(cursorModelListed('grok-4.61\n')).toBe(false)
    expect(cursorModelListed('No models available for this account.')).toBe(false)
    expect(cursorModelListed('')).toBe(false)
  })
})

describe('taste-evaluate-result — the judge chain', () => {
  it('falls back on missing or 402 only, never on a real error', () => {
    expect(grokFailureFallsBack({ kind: 'missing' })).toBe(true)
    expect(grokFailureFallsBack({ kind: '402' })).toBe(true)
    expect(grokFailureFallsBack({ kind: 'error' })).toBe(false)
    expect(grokFailureFallsBack(null)).toBe(false)
  })

  it('picks a claude model that is not the builder', () => {
    expect(pickFallbackAlias('grok-4.5')).toBe('sonnet')
    expect(pickFallbackAlias(undefined)).toBe('sonnet')
    expect(pickFallbackAlias('claude-fable-5-1')).toBe('sonnet')
    expect(pickFallbackAlias('claude-sonnet-5')).toBe('opus')
  })

  it('allows only the chain to sign a receipt', () => {
    expect(isAllowedEvaluator('grok-4.6')).toBe(true)
    expect(isAllowedEvaluator('claude-sonnet-5')).toBe(true)
    expect(isAllowedEvaluator('claude-opus-5')).toBe(true)
    expect(isAllowedEvaluator('claude-sonnet-5-20260901')).toBe(true)
    expect(isAllowedEvaluator('grok-4.5')).toBe(false)
    expect(isAllowedEvaluator('claude-fable-5-1')).toBe(false)
    expect(isAllowedEvaluator('')).toBe(false)
    expect(ALLOWED_EVALUATORS).toContain(EVALUATOR_MODEL)
  })

  it('records the model the claude CLI actually answered with', () => {
    expect(claudeModelFromWrapper({ modelUsage: { 'claude-sonnet-5': { inputTokens: 1 } } }, 'sonnet')).toBe(
      'claude-sonnet-5',
    )
    expect(claudeModelFromWrapper({}, 'opus')).toBe('claude-opus-5')
    expect(claudeModelFromWrapper(null, 'sonnet')).toBe('claude-sonnet-5')
  })

  it('classifies claude CLI failures without inventing a verdict', () => {
    expect(claudeCliFailure(127, 'zsh: command not found: claude', null, { cliMissing: true })?.kind).toBe('missing')
    expect(claudeCliFailure(1, 'You have hit your usage limit', null)?.kind).toBe('402')
    // 2026-09-13: the exact wrapper the CLI returned at the weekly cap. It was read as
    // a plain error and retried per class; it is the judge being out.
    const weekly = {
      is_error: true,
      api_error_status: 429,
      result: "You've hit your weekly limit · resets Sep 15 at 12pm (America/Los_Angeles)",
    }
    expect(claudeCliFailure(1, '', weekly)?.kind).toBe('402')
    expect(claudeCliFailure(1, '', { is_error: true, result: "You've hit your weekly limit" })?.kind).toBe('402')
    expect(claudeCliFailure(1, '', { is_error: true, api_error_status: 429, result: '' })?.kind).toBe('402')
    expect(claudeCliFailure(1, '', { is_error: true, result: 'exceeded the output token limit' })?.kind).toBe('error')
    expect(claudeCliFailure(0, '', { is_error: true, result: 'boom' })?.kind).toBe('error')
    expect(claudeCliFailure(0, '', null)?.kind).toBe('error')
    expect(claudeCliFailure(0, '', { is_error: false, result: '{}' })).toBeNull()
  })

  it('stamps the envelope with the link that answered', () => {
    const env = evaluatorEnvelope({
      parsed: { demoMatch: true },
      shots: ['a.png'],
      evaluatorModel: 'claude-sonnet-5',
      transport: 'claude-cli',
    })
    expect(env.evaluatorModel).toBe('claude-sonnet-5')
    expect(env.transport).toBe('claude-cli')
    expect(evaluatorEnvelope({ parsed: {}, shots: [] }).transport).toBe('grok-cli')
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

describe('taste-evaluate-result — the round judge (one ruler per table)', () => {
  const table = (evaluatorModel, judgeLink) => JSON.stringify({ instrument: { evaluatorModel, ...(judgeLink ? { judgeLink } : {}) }, rows: [] })

  it('reads the judge that scored the current table, and the link it answered through', () => {
    expect(roundJudge('/repo', { readFile: () => table('claude-sonnet-5') })).toEqual({ model: 'claude-sonnet-5', family: 'sonnet', link: null })
    expect(roundJudge('/repo', { readFile: () => table('grok-4.6') })).toEqual({ model: 'grok-4.6', family: 'grok', link: null })
    expect(roundJudge('/repo', { readFile: () => table('grok-4.6', 'cursor') })).toEqual({ model: 'grok-4.6', family: 'grok', link: 'cursor' })
  })

  it('no table, or a mixed table, is no round judge', () => {
    expect(roundJudge('/repo', { readFile: () => { throw new Error('ENOENT') } })).toEqual({ model: null, family: null, link: null })
    expect(roundJudge('/repo', { readFile: () => table('mixed') })).toEqual({ model: null, family: null, link: null })
  })

  it('judgeFamily buckets grok / sonnet / opus and nothing else', () => {
    expect(judgeFamily('grok-4.5')).toBe('grok')
    expect(judgeFamily('claude-sonnet-5-20260901')).toBe('sonnet')
    expect(judgeFamily('claude-opus-5')).toBe('opus')
    expect(judgeFamily('claude-fable-5-1')).toBeNull()
  })

  it('a sonnet-scored table keeps the chain on sonnet; grok waits for the next full run', () => {
    const order = judgeOrder({ round: { model: 'claude-sonnet-5', family: 'sonnet' }, builderModel: 'grok-4.5' })
    expect(order).toHaveLength(1)
    expect(order[0]).toMatchObject({ link: 'claude', alias: 'sonnet' })
    expect(order[0].reason).toMatch(/next full table run/)
  })

  it('a sonnet builder under a sonnet round judge is graded by opus and told it rebaselines', () => {
    const order = judgeOrder({ round: { model: 'claude-sonnet-5', family: 'sonnet' }, builderModel: 'claude-sonnet-5' })
    expect(order).toEqual([expect.objectContaining({ link: 'claude', alias: 'opus' })])
    expect(order[0].reason).toMatch(/rebaselines/)
  })

  it('a grok-scored table, or no table, runs the default chain: grok-4.6 through both CLIs, then claude by builder', () => {
    const grokRound = judgeOrder({ round: { model: 'grok-4.6', family: 'grok' }, builderModel: 'claude-sonnet-5' })
    expect(grokRound.map((s) => s.link)).toEqual(['grok', 'cursor', 'claude'])
    expect(grokRound[1].model).toBe(CURSOR_JUDGE_MODEL)
    expect(grokRound[2].alias).toBe('opus')
    const noRound = judgeOrder({ builderModel: 'claude-fable-5-1' })
    expect(noRound.map((s) => s.link)).toEqual(['grok', 'cursor', 'claude'])
    expect(noRound[2].alias).toBe('sonnet')
  })

  it('a table scored through the Cursor CLI keeps that link first for the round', () => {
    const order = judgeOrder({ round: { model: 'grok-4.6', family: 'grok', link: 'cursor' }, builderModel: 'grok-4.5' })
    expect(order.map((s) => s.link)).toEqual(['cursor', 'grok', 'claude'])
    expect(order[0].reason).toMatch(/Cursor CLI/)
  })

  it('an explicit --evaluator wins over the round judge', () => {
    expect(judgeOrder({ round: { model: 'claude-sonnet-5', family: 'sonnet' }, requested: 'grok' })).toEqual([expect.objectContaining({ link: 'grok' })])
    expect(judgeOrder({ round: { model: 'claude-sonnet-5', family: 'sonnet' }, requested: 'cursor' })).toEqual([
      expect.objectContaining({ link: 'cursor', model: 'grok-4.6' }),
    ])
    expect(judgeOrder({ round: { model: 'grok-4.6', family: 'grok' }, requested: 'claude', builderModel: 'grok-4.5' })).toEqual([
      expect.objectContaining({ link: 'claude', alias: 'sonnet' }),
    ])
  })
})
