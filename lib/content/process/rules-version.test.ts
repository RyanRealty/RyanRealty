/**
 * rulesVersion covers the rules' numbers AND the code that enforces them: a change to the
 * logic of a check (not its wording, not a number) must make every old stamp stale.
 */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RULES, type Rule } from './rules'
import { enforcerSources, rulesVersion, thresholdData } from './rules-version'

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rr-rules-version-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const put = (rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), text)
}

const rule = (id: string, over: Partial<Rule> = {}): Rule =>
  ({ id, title: 't', source: 's', appliesTo: ['video'], step: 'brief', status: 'enforced', enforcer: { module: 'lib/x/check.ts', export: 'f' }, fixture: 'fixtures/x.json', fixtureMatch: 'x', ...over }) as Rule

const RULE_SET = [rule('R-001'), rule('R-002', { status: 'planned', enforcer: undefined, plannedIn: 'doors' }), rule('R-003', { enforcer: { module: 'lib/y/other.ts', export: 'g' } })]
const version = (rules: readonly Rule[] = RULE_SET) => rulesVersion(thresholdData(), rules, root)

describe('rulesVersion covers the code that enforces the rules', () => {
  beforeEach(() => {
    put('lib/x/check.ts', 'export const f = (n: number) => n > 3\n')
    put('lib/x/helper.ts', 'export const limit = 3\n')
    put('lib/y/other.ts', 'export const g = () => true\n')
  })

  it('is stable when nothing changed', () => {
    expect(version()).toMatch(/^[0-9a-f]{64}$/)
    expect(version()).toBe(version())
  })

  it('changes when an enforcer\'s logic changes, though no rule and no number did', () => {
    const before = version()
    put('lib/x/check.ts', 'export const f = (n: number) => n > 30\n')
    expect(version()).not.toBe(before)
  })

  it('changes when a helper beside the enforcer changes (the enforcer imports it)', () => {
    const before = version()
    put('lib/x/helper.ts', 'export const limit = 30\n')
    expect(version()).not.toBe(before)
  })

  it('changes when a new source file appears beside an enforcer, and when a second enforcer\'s module changes', () => {
    const before = version()
    put('lib/x/added.mjs', 'export const z = 1\n')
    const withAdded = version()
    expect(withAdded).not.toBe(before)
    put('lib/y/other.ts', 'export const g = () => false\n')
    expect(version()).not.toBe(withAdded)
  })

  it('changes when an enforcer module goes missing', () => {
    const before = version()
    rmSync(join(root, 'lib/y/other.ts'))
    expect(version()).not.toBe(before)
  })

  it('does not change for what does not decide anything: tests, test support, fixtures, data, other directories', () => {
    const before = version()
    put('lib/x/check.test.ts', 'it("x", () => {})\n')
    put('lib/x/check.int.test.ts', 'it("y", () => {})\n')
    put('lib/x/test-harness.ts', 'export const h = 1\n')
    put('lib/x/types.d.ts', 'export type T = string\n')
    put('lib/x/notes.md', 'prose\n')
    put('lib/x/data.json', '{}\n')
    put('lib/x/fixtures/case.ts', 'export const c = 1\n')
    put('lib/z/unrelated.ts', 'export const u = 1\n')
    expect(version()).toBe(before)
  })

  it('does not read the enforcer of a rule that is not enforced', () => {
    put('lib/q/planned.ts', 'export const p = 1\n')
    const withPlanned = [...RULE_SET, rule('R-004', { status: 'planned', enforcer: { module: 'lib/q/planned.ts', export: 'p' } })]
    const before = version(withPlanned)
    put('lib/q/planned.ts', 'export const p = 2\n')
    expect(version(withPlanned)).toBe(before)
    expect(Object.keys(enforcerSources(withPlanned, root))).not.toContain('lib/q/planned.ts')
  })

  it('still changes when the rules themselves change', () => {
    const before = version()
    expect(version([rule('R-001', { title: 'another title' }), ...RULE_SET.slice(1)])).not.toBe(before)
  })

  it('reads the content on every call, so an edit that keeps a file\'s size and mtime is still seen', () => {
    const when = new Date('2026-10-14T12:00:00Z')
    put('lib/x/check.ts', 'export const f = (n: number) => n > 4\n')
    utimesSync(join(root, 'lib/x/check.ts'), when, when)
    const before = version()
    put('lib/x/check.ts', 'export const f = (n: number) => n < 4\n')
    utimesSync(join(root, 'lib/x/check.ts'), when, when)
    expect(version()).not.toBe(before)
  })
})

describe('the real rules', () => {
  it('rest on the enforcer modules, their neighbours, and nothing from a test', () => {
    const files = Object.keys(enforcerSources())
    for (const rel of ['.claude/skills/ryan-studio/tools/video_gate.mjs', '.claude/skills/ryan-studio/tools/technique-approval.mjs', 'lib/studio/qa/evaluate.ts', 'lib/studio/qa/ledger.ts', 'lib/content/process/run.ts', 'lib/content/process/steps/voice.ts']) {
      expect(files, rel).toContain(rel)
    }
    expect(files.filter((f) => /\.(test|spec)\.|\/test-|\/fixtures\/|__tests__/.test(f))).toEqual([])
    const enforcers = new Set(RULES.filter((r) => r.status === 'enforced').map((r) => r.enforcer!.module))
    for (const m of enforcers) expect(files, m).toContain(m)
    for (const sha of Object.values(enforcerSources())) expect(sha).toMatch(/^[0-9a-f]{64}$/)
  })

  it('has no enforcer module missing from the checkout', () => {
    expect(Object.entries(enforcerSources()).filter(([, sha]) => sha === 'missing')).toEqual([])
  })
})
