/**
 * Break-tests for scripts/check-content-rules.mjs (ci:content-rules, G84). Every
 * rule of the gate is proven to fire: the pure judgments on small fabricated
 * rule sets, the AST reader on throwaway modules, and the real gate run as a
 * subprocess against a sandbox copy of the tree (real rules, real baseline), so
 * a loosened number, a deleted fixture and a vanished ID are each shown to fail
 * the real command.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { RULES, type Rule } from '../../lib/content/process/rules'
import { compareResolved, thresholdKey, thresholdsOf } from '../../lib/content/process/threshold-path'
import { evaluate, exportedNames, nextBaseline } from '../check-content-rules.mjs'

const REPO = resolve(__dirname, '..', '..')
const FX = 'lib/content/process/fixtures'

type Input = Parameters<typeof evaluate>[0]
type Rulish = Record<string, unknown>

/** A small, valid rule set with one number, and the files it points at. */
function okInput(over: Partial<Input> = {}): Input {
  const rules: Rulish[] = [
    { id: 'R-001', title: 'one', source: 's', appliesTo: ['video'], step: 'brief', status: 'enforced', enforcer: { module: 'lib/m.ts', export: 'f' }, fixture: `${FX}/R-001.json`, fixtureMatch: 'boom' },
    { id: 'R-002', title: 'two', source: 's', appliesTo: ['video'], step: 'certify', status: 'planned', plannedIn: 'doors' },
    { id: 'R-003', title: 'three', source: 's', appliesTo: ['video'], step: 'board', status: 'enforced', enforcer: { module: 'lib/m.ts', export: 'g' }, fixture: `${FX}/R-003.json`, fixtureMatch: 'bang', threshold: { source: 'qa', path: 'a.b', tighterIs: 'lower' } },
  ]
  const fixtures: Record<string, unknown> = { [`${FX}/R-001.json`]: { rule: 'R-001', step: 'brief' }, [`${FX}/R-003.json`]: { rule: 'R-003', step: 'board' } }
  return {
    rules,
    baseline: { version: 1, ids: ['R-001', 'R-002', 'R-003'], thresholds: { 'R-003': { source: 'qa', path: 'a.b', tighterIs: 'lower', value: 5 } } },
    resolved: { 'R-003': { spec: { source: 'qa', path: 'a.b', tighterIs: 'lower' }, resolved: { value: 5 } } },
    currentTypes: ['listing', 'story_teaser'],
    unowned: [],
    files: {
      exists: (rel: string) => rel === 'lib/m.ts' || rel in fixtures,
      exportsOf: () => new Set(['f', 'g']),
      json: (rel: string) => fixtures[rel],
      strayFixtures: ['R-001.json', 'R-003.json'],
    },
    compareResolved,
    thresholdsOf,
    thresholdKey,
    ...over,
  } as Input
}

const problemsOf = (over: Partial<Input>) => (evaluate(okInput(over)) as { problems: string[]; tightened: string[] })
const withRule = (index: number, patch: Rulish): Partial<Input> => {
  const rules = okInput().rules.map((r: Rulish, i: number) => (i === index ? { ...r, ...patch } : r))
  return { rules } as Partial<Input>
}

describe('the gate passes a sound rule set', () => {
  it('has no problem and nothing tightened', () => {
    expect(problemsOf({})).toEqual({ problems: [], tightened: [] })
  })
})

describe('R1: IDs', () => {
  it('fails an ID that is missing or not of the form R-001', () => {
    expect(problemsOf(withRule(0, { id: undefined })).problems.join('\n')).toMatch(/rule #1 has no ID of the form R-001/)
    expect(problemsOf(withRule(0, { id: 'R-1' })).problems.join('\n')).toMatch(/R-1 has no ID of the form R-001/)
    expect(problemsOf(withRule(0, { id: 'r-001' })).problems.join('\n')).toMatch(/r-001 has no ID/)
  })

  it('fails an ID used twice', () => {
    expect(problemsOf(withRule(1, { id: 'R-001' })).problems.join('\n')).toMatch(/R-001 appears twice/)
  })

  it('fails when an ID in the committed baseline has disappeared', () => {
    const base = okInput().baseline as { ids: string[] }
    const out = problemsOf({ baseline: { ...base, ids: [...base.ids, 'R-009'] } as never })
    expect(out.problems.join('\n')).toMatch(/R-009 is in the committed baseline and has disappeared from rules\.ts \(IDs are never removed/)
  })

  it('keeps a retired rule: it needs no enforcer and its ID stays', () => {
    expect(problemsOf(withRule(0, { status: 'retired', enforcer: undefined, fixture: undefined, fixtureMatch: undefined })).problems.filter((p) => /R-001/.test(p) && !/stray|belongs to no/.test(p))).toEqual([])
  })

  it('fails a status that is none of enforced, planned, retired', () => {
    expect(problemsOf(withRule(0, { status: 'maybe' })).problems.join('\n')).toMatch(/R-001: status is "maybe"/)
  })

  it('fails a step or a deliverable that does not exist, and a missing title or source', () => {
    const all = problemsOf(withRule(0, { step: 'dance', appliesTo: ['podcast'], title: ' ', source: '' })).problems.join('\n')
    expect(all).toMatch(/step is "dance"/)
    expect(all).toMatch(/appliesTo must name deliverables/)
    expect(all).toMatch(/has no title/)
    expect(all).toMatch(/has no source/)
  })
})

describe('R2: an enforced rule names what enforces it and what breaks it', () => {
  it('fails an enforced rule with no enforcer', () => {
    expect(problemsOf(withRule(0, { enforcer: undefined })).problems.join('\n')).toMatch(/R-001: is enforced but names no enforcer/)
  })

  it('fails an enforcer module that does not exist, or that does not export the function', () => {
    expect(problemsOf(withRule(0, { enforcer: { module: 'lib/gone.ts', export: 'f' } })).problems.join('\n')).toMatch(/enforcer module lib\/gone\.ts does not exist/)
    expect(problemsOf(withRule(0, { enforcer: { module: 'lib/m.ts', export: 'nope' } })).problems.join('\n')).toMatch(/enforcer lib\/m\.ts does not export nope/)
  })

  it('fails an enforcer path that leaves the repository', () => {
    expect(problemsOf(withRule(0, { enforcer: { module: '../outside.ts', export: 'f' } })).problems.join('\n')).toMatch(/must be a path inside the repository/)
    expect(problemsOf(withRule(0, { enforcer: { module: '/etc/passwd', export: 'f' } })).problems.join('\n')).toMatch(/must be a path inside the repository/)
  })

  it('fails a missing fixture, a fixture outside the fixtures folder, and one that is not JSON', () => {
    expect(problemsOf(withRule(0, { fixture: undefined })).problems.join('\n')).toMatch(/R-001: is enforced but names no fixture/)
    expect(problemsOf(withRule(0, { fixture: `${FX}/R-404.json` })).problems.join('\n')).toMatch(/fixture .*R-404\.json does not exist/)
    expect(problemsOf(withRule(0, { fixture: 'elsewhere/R-001.json' })).problems.join('\n')).toMatch(/must be a .json file directly under/)
    const bad = okInput({ files: { ...okInput().files, json: () => { throw new Error('Unexpected token') } } as never })
    expect((evaluate(bad) as { problems: string[] }).problems.join('\n')).toMatch(/is not JSON \(Unexpected token\)/)
  })

  it('fails a fixture that names another rule or another step', () => {
    const files = okInput().files as { json: (r: string) => unknown }
    const other = okInput({ files: { ...okInput().files, json: (rel: string) => (rel.endsWith('R-001.json') ? { rule: 'R-777', step: 'brief' } : files.json(rel)) } as never })
    expect((evaluate(other) as { problems: string[] }).problems.join('\n')).toMatch(/names rule "R-777", not R-001/)
    const step = okInput({ files: { ...okInput().files, json: (rel: string) => (rel.endsWith('R-001.json') ? { rule: 'R-001', step: 'master' } : files.json(rel)) } as never })
    expect((evaluate(step) as { problems: string[] }).problems.join('\n')).toMatch(/names step "master", not brief/)
  })

  it('fails a missing or invalid fixtureMatch', () => {
    expect(problemsOf(withRule(0, { fixtureMatch: undefined })).problems.join('\n')).toMatch(/has no fixtureMatch/)
    expect(problemsOf(withRule(0, { fixtureMatch: '(' })).problems.join('\n')).toMatch(/fixtureMatch is not a regex/)
  })

  it('fails two rules that share a fixture, and a fixture no rule owns', () => {
    expect(problemsOf(withRule(2, { fixture: `${FX}/R-001.json` })).problems.join('\n')).toMatch(/is the fixture of R-001 and R-003: each enforced rule needs a fixture of its own/)
    const stray = okInput({ files: { ...okInput().files, strayFixtures: ['R-001.json', 'R-003.json', 'R-050.json'] } as never })
    expect((evaluate(stray) as { problems: string[] }).problems.join('\n')).toMatch(/R-050\.json belongs to no enforced rule/)
  })

  it('fails a planned rule with no build-order step, or one that is not on the list', () => {
    expect(problemsOf(withRule(1, { plannedIn: undefined })).problems.join('\n')).toMatch(/R-002: is planned but plannedIn is undefined/)
    expect(problemsOf(withRule(1, { plannedIn: 'someday' })).problems.join('\n')).toMatch(/plannedIn is "someday"/)
    for (const ok of ['process core', 'certifier', 'doors', 'judge', 'library']) expect(problemsOf(withRule(1, { plannedIn: ok })).problems).toEqual([])
  })
})

describe('R3: the ratchet', () => {
  const resolvedAt = (value: unknown, extra: Record<string, unknown> = {}) => ({ 'R-003': { spec: { source: 'qa', path: 'a.b', tighterIs: 'lower' }, resolved: { value, ...extra } } })

  it('fails a number looser than the baseline', () => {
    const out = problemsOf({ resolved: resolvedAt(6) })
    expect(out.problems.join('\n')).toMatch(/R-003 qa:a\.b: 5 -> 6 is LOOSER than the number Matt approved \(lower is tighter\).*Approved-by: matt and Rule-loosened: R-003/)
  })

  it('passes a tighter number and prints it as tightened', () => {
    const out = problemsOf({ resolved: resolvedAt(4) })
    expect(out.problems).toEqual([])
    expect(out.tightened).toEqual(['R-003 qa:a.b: 5 -> 4 (tightened)'])
  })

  it('reads "higher is tighter" the other way round', () => {
    const rules = okInput().rules.map((r: Rulish) => (r.id === 'R-003' ? { ...r, threshold: { source: 'qa', path: 'a.b', tighterIs: 'higher' } } : r))
    const up = { 'R-003': { spec: { source: 'qa', path: 'a.b', tighterIs: 'higher' }, resolved: { value: 6 } } }
    const base = { version: 1, ids: ['R-001', 'R-002', 'R-003'], thresholds: { 'R-003': { source: 'qa', path: 'a.b', tighterIs: 'higher', value: 5 } } }
    expect(problemsOf({ rules, resolved: up as never, baseline: base as never }).tightened).toHaveLength(1)
    expect(problemsOf({ rules, resolved: { 'R-003': { ...up['R-003'], resolved: { value: 4 } } } as never, baseline: base as never }).problems.join('\n')).toMatch(/LOOSER/)
  })

  it('holds a video type that sets its own number to it, and a new type to the default', () => {
    const spec = { source: 'video_types', path: 'defaults.max_s', tighterIs: 'lower' }
    const base = { version: 1, ids: ['R-001', 'R-002', 'R-003'], thresholds: { 'R-003': { ...spec, value: 30, perType: { story_teaser: 15 } } } }
    const at = (value: number, perType?: Record<string, number>) => ({ 'R-003': { spec, resolved: { value, ...(perType ? { perType } : {}) } } })
    const run = (resolved: unknown, types = ['listing', 'story_teaser']) => problemsOf({ resolved: resolved as never, baseline: base as never, currentTypes: types })
    expect(run(at(30, { story_teaser: 15 })).problems).toEqual([])
    expect(run(at(30, { story_teaser: 20 })).problems.join('\n')).toMatch(/for type story_teaser: 15 -> 20 is LOOSER/)
    expect(run(at(30, { story_teaser: 15, podcast: 120 }), ['listing', 'story_teaser', 'podcast']).problems.join('\n')).toMatch(/for type podcast: 30 -> 120 is LOOSER/)
    expect(run(at(30, { story_teaser: 15 }), ['listing', 'story_teaser', 'podcast']).problems).toEqual([])
  })

  it('treats a list as a set: an item gone is looser', () => {
    const rules = okInput().rules.map((r: Rulish) => (r.id === 'R-003' ? { ...r, threshold: { source: 'video_types', path: 'banned_phrases', tighterIs: 'higher' } } : r))
    const spec = { source: 'video_types', path: 'banned_phrases', tighterIs: 'higher' }
    const base = { version: 1, ids: ['R-001', 'R-002', 'R-003'], thresholds: { 'R-003': { ...spec, value: ['nestled', 'vibrant'] } } }
    const run = (value: string[]) => problemsOf({ rules, baseline: base as never, resolved: { 'R-003': { spec, resolved: { value } } } as never })
    expect(run(['nestled', 'vibrant', 'unlock']).tightened).toHaveLength(1)
    expect(run(['nestled']).problems.join('\n')).toMatch(/LOOSER/)
  })

  it('fails a number that is no longer held by its rule', () => {
    expect(problemsOf({ resolved: {} }).problems.join('\n')).toMatch(/R-003 \(qa:a\.b\) is no longer held by R-003: a number that disappears is loosened/)
  })

  it('fails a rule that now holds another number, or reads the other way round', () => {
    const moved = { 'R-003': { spec: { source: 'qa', path: 'a.c', tighterIs: 'lower' }, resolved: { value: 1 } } }
    expect(problemsOf({ resolved: moved as never }).problems.join('\n')).toMatch(/another number is a loosening/)
    const flipped = { 'R-003': { spec: { source: 'qa', path: 'a.b', tighterIs: 'higher' }, resolved: { value: 5 } } }
    expect(problemsOf({ resolved: flipped as never }).problems.join('\n')).toMatch(/another number is a loosening/)
  })

  it('fails a number with no baseline value yet, and a threshold that does not resolve', () => {
    expect(problemsOf({ baseline: { version: 1, ids: ['R-001', 'R-002', 'R-003'], thresholds: {} } as never }).problems.join('\n')).toMatch(/R-003 holds a number with no baseline value: record it with/)
    expect(problemsOf({ resolved: { 'R-003': { spec: { source: 'qa', path: 'a.b', tighterIs: 'lower' }, error: 'threshold qa:a.b is not a number' } } as never }).problems.join('\n')).toMatch(/R-003: threshold qa:a\.b is not a number/)
  })
})

describe('R4: every number has an owner', () => {
  it('fails a number no rule names', () => {
    expect(problemsOf({ unowned: ['qa:audio.lufsMin'] }).problems.join('\n')).toMatch(/qa:audio\.lufsMin is a number the factory holds that no rule's threshold names/)
  })
})

describe('nextBaseline', () => {
  it('records today\'s numbers and only ever adds IDs', () => {
    const input = okInput()
    const next = nextBaseline(input.rules, input.resolved, { ids: ['R-001', 'R-009'] })
    expect(next.ids).toEqual(['R-001', 'R-002', 'R-003', 'R-009'])
    expect((next.thresholds as Record<string, unknown>)['R-003']).toEqual({ source: 'qa', path: 'a.b', tighterIs: 'lower', value: 5 })
  })
})

describe('exportedNames reads the AST', () => {
  let dir = ''
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rr-exports-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('finds exported values and leaves out types, interfaces, locals and a name in a comment', () => {
    const f = join(dir, 'm.ts')
    writeFileSync(f, `
// export function inAComment() {}
const local = 1
export const a = 1, { b, c: [d] } = { b: 1, c: [2] }
export function fn() {}
export async function afn() {}
export class K {}
export enum E { X }
export type T = number
export interface I {}
export { local as renamed, type Ty }
function hidden() {}
export default hidden
`)
    expect([...exportedNames(f)].sort()).toEqual(['K', 'E', 'a', 'afn', 'b', 'd', 'default', 'fn', 'renamed'].sort())
  })

  it('reads a plain .mjs module too', () => {
    const f = join(dir, 'm.mjs')
    writeFileSync(f, 'export function gate() {}\nexport const SPOKEN = {}\nfunction nope() {}\n')
    expect([...exportedNames(f)].sort()).toEqual(['SPOKEN', 'gate'])
  })
})

// ---------------------------------------------------------------------------
// The real gate, as a subprocess, against a sandbox copy of the tree.

const COPY = ['scripts/check-content-rules.mjs', 'lib/content/process/rules.ts', 'lib/content/process/threshold-path.ts', 'lib/content/process/rules.baseline.json', 'lib/studio/qa/thresholds.ts', '.claude/skills/ryan-studio/tools/video_types.json']

describe('the real gate against a sandbox of the tree', () => {
  let sandbox = ''
  const at = (rel: string) => join(sandbox, rel)
  const gate = (...args: string[]) => {
    const r = spawnSync(process.execPath, [at('scripts/check-content-rules.mjs'), ...args], { encoding: 'utf8', cwd: sandbox })
    return { status: r.status, out: `${r.stdout}${r.stderr}` }
  }
  const edit = (rel: string, fn: (text: string) => string) => writeFileSync(at(rel), fn(readFileSync(at(rel), 'utf8')))

  /** The rule that holds a number, by its threshold path. */
  const ruleHolding = (path: string): Rule => RULES.find((r) => thresholdsOf(r).some((t) => t.path === path))!

  beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'rr-content-gate-'))
    const put = (rel: string) => {
      mkdirSync(dirname(at(rel)), { recursive: true })
      copyFileSync(join(REPO, rel), at(rel))
    }
    for (const rel of COPY) put(rel)
    for (const f of readdirSync(join(REPO, FX))) put(`${FX}/${f}`)
    // Enforcer modules are read, never changed: link them.
    for (const mod of new Set(RULES.flatMap((r) => (r.enforcer ? [r.enforcer.module] : [])))) {
      if (COPY.includes(mod)) continue
      mkdirSync(dirname(at(mod)), { recursive: true })
      symlinkSync(join(REPO, mod), at(mod))
    }
    symlinkSync(join(REPO, 'node_modules'), at('node_modules'))
  })
  afterAll(() => {
    if (sandbox) rmSync(sandbox, { recursive: true, force: true })
  })

  const fresh = () => {
    copyFileSync(join(REPO, 'lib/content/process/rules.ts'), at('lib/content/process/rules.ts'))
    copyFileSync(join(REPO, 'lib/content/process/rules.baseline.json'), at('lib/content/process/rules.baseline.json'))
    copyFileSync(join(REPO, '.claude/skills/ryan-studio/tools/video_types.json'), at('.claude/skills/ryan-studio/tools/video_types.json'))
    for (const f of readdirSync(join(REPO, FX))) copyFileSync(join(REPO, FX, f), at(`${FX}/${f}`))
  }

  it('passes on the committed tree and prints what it checked', () => {
    fresh()
    const r = gate()
    expect(r.status, r.out).toBe(0)
    expect(r.out).toMatch(/ci:content-rules OK: \d+ rules \(\d+ enforced, \d+ planned\)/)
    expect(JSON.parse(gate('--json').out).pass).toBe(true)
  })

  it('fails a loosened number, names the rule, and still exits 0 with --report', () => {
    fresh()
    const rule = ruleHolding('defaults.min_hold_s')
    edit('.claude/skills/ryan-studio/tools/video_types.json', (t) => t.replace('"min_hold_s": 2.5', '"min_hold_s": 2'))
    const r = gate()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(new RegExp(`${rule.id} video_types:defaults\\.min_hold_s: 2\\.5 -> 2 is LOOSER`))
    expect(gate('--report').status).toBe(0)
  })

  it('passes a tightened number and prints it', () => {
    fresh()
    edit('.claude/skills/ryan-studio/tools/video_types.json', (t) => t.replace('"min_hold_s": 2.5', '"min_hold_s": 3'))
    const r = gate()
    expect(r.status, r.out).toBe(0)
    expect(r.out).toMatch(/tightened: .*defaults\.min_hold_s: 2\.5 -> 3 \(tightened\)/)
  })

  it('fails a video type that loosens its own number', () => {
    fresh()
    edit('.claude/skills/ryan-studio/tools/video_types.json', (t) => t.replace('"story_teaser": {"min_s": 7, "max_s": 15, "hard_max_s": 15', '"story_teaser": {"min_s": 7, "max_s": 25, "hard_max_s": 15'))
    const r = gate()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/for type story_teaser: 15 -> 25 is LOOSER/)
  })

  it('fails a banned phrase that was removed', () => {
    fresh()
    edit('.claude/skills/ryan-studio/tools/video_types.json', (t) => t.replace('"nestled", ', ''))
    const r = gate()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/banned_phrases: \[.*nestled.*\] -> \[.*\] is LOOSER/)
  })

  it('fails a deleted fixture, and a rule ID that vanished', () => {
    fresh()
    rmSync(at(`${FX}/R-010.json`))
    expect(gate().out).toMatch(/R-010: fixture .*R-010\.json does not exist/)
    fresh()
    edit('lib/content/process/rules.ts', (t) => t.replace("id: 'R-002',", "id: 'R-1002',"))
    const r = gate()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/R-1002 has no ID of the form R-001/)
    expect(r.out).toMatch(/R-002 is in the committed baseline and has disappeared from rules\.ts/)
  })

  it('fails an enforcer whose function was renamed away', () => {
    fresh()
    const gateRule = RULES.find((r) => r.enforcer?.export === 'peopleAndPlaceHits')!
    edit('lib/content/process/rules.ts', (t) => t.replace(new RegExp(`(id: '${gateRule.id}'[\\s\\S]*?)export: 'peopleAndPlaceHits'`), '$1export: \'peopleAndPlaceHitz\''))
    expect(gate().out).toMatch(new RegExp(`${gateRule.id}: enforcer lib/studio/qa/copy-rules\\.ts does not export peopleAndPlaceHitz`))
  })

  it('fails a number no rule owns', () => {
    fresh()
    const rule = ruleHolding('defaults.hook_max_s')
    edit('lib/content/process/rules.ts', (t) => t.replace(new RegExp(`(id: '${rule.id}'[\\s\\S]*?)    threshold: \\{[^\\n]*\\},\\n`), '$1'))
    const r = gate()
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/video_types:defaults\.hook_max_s is a number the factory holds that no rule's threshold names/)
    expect(r.out).toMatch(new RegExp(`${rule.id} \\(video_types:defaults\\.hook_max_s\\) is no longer held`))
  })

  it('--write-baseline records today\'s numbers, never drops an ID, and says what is looser', () => {
    fresh()
    edit('.claude/skills/ryan-studio/tools/video_types.json', (t) => t.replace('"min_hold_s": 2.5', '"min_hold_s": 2'))
    const r = gate('--write-baseline')
    expect(r.out).toMatch(/Recorded \d+ numbers and \d+ rule IDs/)
    expect(r.out).toMatch(/LOOSER than the committed baseline/)
    expect(r.out).toMatch(/Approved-by: matt/)
    const written = JSON.parse(readFileSync(at('lib/content/process/rules.baseline.json'), 'utf8'))
    expect(written.ids.length).toBe(RULES.length)
    expect(gate().status).toBe(0)
  })
})
