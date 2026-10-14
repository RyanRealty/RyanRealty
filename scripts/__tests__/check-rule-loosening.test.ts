/**
 * Break-tests for scripts/check-rule-loosening.mjs (the commit-msg gate): only
 * Matt loosens a content rule. The pure judgments are tested directly; the
 * commit-time behaviour runs the real script against a throwaway repository
 * built with GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE set and every inherited
 * GIT_* variable removed (lib/content/process/test-git.ts), so no test here can
 * touch the checkout it runs in.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compareResolved } from '../../lib/content/process/threshold-path'
import { makeTempRepo, type TempRepo } from '../../lib/content/process/test-git'
import { BASELINE, canonical, looseningProblems, messageProblems } from '../check-rule-loosening.mjs'

const SCRIPT = resolve(__dirname, '..', 'check-rule-loosening.mjs')

const base = () => ({
  version: 1,
  ids: ['R-001', 'R-002', 'R-003'],
  thresholds: {
    'R-001': { source: 'video_types', path: 'defaults.max_s', tighterIs: 'lower', value: 30, perType: { story_teaser: 15, brand_film: 90 } },
    'R-002': { source: 'qa', path: 'audio.lufsMin', tighterIs: 'higher', value: -15 },
    'R-003': { source: 'qa', path: 'safeArea.maxX', tighterIs: 'lower', value: 960 },
    'R-003#2': { source: 'qa', path: 'safeArea.maxY', tighterIs: 'lower', value: 1640 },
  },
})
type Baseline = ReturnType<typeof base>
const clone = (b: Baseline): Baseline => JSON.parse(JSON.stringify(b))
const judge = (head: Baseline | null, staged: Baseline, others: Array<Baseline | null> = []) => looseningProblems(head, staged, compareResolved, others) as { removedIds: string[]; loosened: Map<string, string[]> }

describe('looseningProblems', () => {
  it('finds nothing when nothing changed, or a number got tighter, or a rule was added', () => {
    expect(judge(base(), base()).loosened.size).toBe(0)
    const tighter = clone(base())
    tighter.thresholds['R-002'].value = -14
    tighter.thresholds['R-001'].value = 25
    tighter.ids.push('R-004')
    tighter.thresholds['R-004' as keyof typeof tighter.thresholds] = { source: 'qa', path: 'caps.boards', tighterIs: 'lower', value: 3 } as never
    const out = judge(base(), tighter)
    expect(out.loosened.size).toBe(0)
    expect(out.removedIds).toEqual([])
  })

  it('names a number that loosened, with the rule ID', () => {
    const looser = clone(base())
    looser.thresholds['R-002'].value = -18
    const out = judge(base(), looser)
    expect([...out.loosened.keys()]).toEqual(['R-002'])
    expect(out.loosened.get('R-002')![0]).toMatch(/audio\.lufsMin: -15 -> -18/)
  })

  it('names the second number of a rule by the rule\'s ID', () => {
    const looser = clone(base())
    looser.thresholds['R-003#2'].value = 1700
    expect([...judge(base(), looser).loosened.keys()]).toEqual(['R-003'])
  })

  it('names a video type that set its own number looser, and a looser default', () => {
    const looser = clone(base())
    looser.thresholds['R-001'].perType!.story_teaser = 20
    looser.thresholds['R-001'].value = 35
    const lines = judge(base(), looser).loosened.get('R-001')!
    expect(lines.some((l) => /for type story_teaser: 15 -> 20/.test(l))).toBe(true)
    expect(lines.some((l) => /defaults\.max_s: 30 -> 35/.test(l))).toBe(true)
  })

  it('treats a number that is no longer held, or that now means another number, as a loosening', () => {
    const dropped = clone(base())
    delete (dropped.thresholds as Record<string, unknown>)['R-002']
    expect(judge(base(), dropped).loosened.get('R-002')![0]).toMatch(/no longer held/)
    const moved = clone(base())
    moved.thresholds['R-002'].path = 'audio.lufsMax'
    expect(judge(base(), moved).loosened.get('R-002')![0]).toMatch(/now holds qa:audio\.lufsMax/)
    const flipped = clone(base())
    flipped.thresholds['R-003'].tighterIs = 'higher'
    expect(judge(base(), flipped).loosened.has('R-003')).toBe(true)
  })

  it('refuses a removed ID, with no way to approve it', () => {
    const removed = clone(base())
    removed.ids = ['R-001', 'R-003']
    expect(judge(base(), removed).removedIds).toEqual(['R-002'])
  })

  it('is not asked anything when HEAD has no baseline yet', () => {
    expect(judge(null, base()).loosened.size).toBe(0)
  })

  it('lets a merge bring in a looser number that the merged branch already carried', () => {
    const theirs = clone(base())
    theirs.thresholds['R-002'].value = -18
    expect(judge(base(), theirs, [theirs]).loosened.size).toBe(0)
    const another = clone(base())
    another.thresholds['R-002'].value = -20
    expect(judge(base(), another, [theirs]).loosened.has('R-002')).toBe(true)
  })

  it('compares keys in any order', () => {
    expect(canonical({ b: 1, a: { d: 1, c: 2 } })).toBe(canonical({ a: { c: 2, d: 1 }, b: 1 }))
  })
})

describe('messageProblems', () => {
  it('asks for nothing when no rule loosened', () => {
    expect(messageProblems('a plain message', [])).toEqual([])
  })

  it('wants Approved-by: matt and a Rule-loosened line for every loosened rule', () => {
    expect(messageProblems('loosen it', ['R-002'])).toEqual(['no `Approved-by: matt` line', 'no `Rule-loosened: R-002` line'])
    expect(messageProblems('x\n\nApproved-by: matt\nRule-loosened: R-002', ['R-002'])).toEqual([])
    expect(messageProblems('x\nApproved-by: matt\nRule-loosened: R-002, R-003', ['R-002', 'R-003'])).toEqual([])
    expect(messageProblems('x\nApproved-by: matt\nRule-loosened: R-002', ['R-002', 'R-003'])).toEqual(['no `Rule-loosened: R-003` line'])
  })

  it('does not take an agent\'s own name, or a commented line, for approval', () => {
    expect(messageProblems('Approved-by: claude\nRule-loosened: R-002', ['R-002'])).toEqual(['no `Approved-by: matt` line'])
    expect(messageProblems('# Approved-by: matt\n# Rule-loosened: R-002', ['R-002']).length).toBe(2)
  })
})

describe('the commit-msg hook against a throwaway repository', () => {
  let dir = ''
  let repo: TempRepo
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rr-loosen-'))
    repo = makeTempRepo(dir, 'level')
    stage(base())
    repo.git('commit', '-q', '-m', 'baseline')
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const file = () => join(repo.work, BASELINE)
  function stage(b: unknown) {
    mkdirSync(dirname(file()), { recursive: true })
    writeFileSync(file(), `${JSON.stringify(b, null, 2)}\n`)
    repo.git('add', BASELINE)
  }
  function hook(message: string) {
    const msg = join(dir, 'COMMIT_EDITMSG')
    writeFileSync(msg, message)
    const r = spawnSync(process.execPath, [SCRIPT, msg], { encoding: 'utf8', env: repo.env, cwd: repo.work })
    return { status: r.status, out: `${r.stdout}${r.stderr}` }
  }

  it('lets a commit that does not touch the baseline through', () => {
    writeFileSync(join(repo.work, 'other.txt'), 'x')
    repo.git('add', 'other.txt')
    expect(hook('anything').status).toBe(0)
  })

  it('lets a tighter number through with no trailer', () => {
    const b = clone(base())
    b.thresholds['R-002'].value = -14
    stage(b)
    expect(hook('tighten loudness').status).toBe(0)
  })

  it('refuses a looser number with no trailer, and names the rule', () => {
    const b = clone(base())
    b.thresholds['R-002'].value = -18
    stage(b)
    const r = hook('loosen loudness')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/LOOSENS 1 content rule number/)
    expect(r.out).toMatch(/R-002: .*audio\.lufsMin: -15 -> -18/)
    expect(r.out).toMatch(/Approved-by: matt/)
    expect(r.out).toMatch(/Rule-loosened: R-002/)
  })

  it('lets a looser number through with Approved-by: matt and the rule named', () => {
    const b = clone(base())
    b.thresholds['R-002'].value = -18
    stage(b)
    expect(hook('loosen loudness\n\nApproved-by: matt\nRule-loosened: R-002\n').status).toBe(0)
  })

  it('refuses when the trailer names another rule than the one loosened', () => {
    const b = clone(base())
    b.thresholds['R-002'].value = -18
    stage(b)
    const r = hook('loosen\n\nApproved-by: matt\nRule-loosened: R-003\n')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/no `Rule-loosened: R-002` line/)
  })

  it('refuses a removed ID even with the trailers: IDs are never removed', () => {
    const b = clone(base())
    b.ids = ['R-001', 'R-003']
    stage(b)
    const r = hook('drop a rule\n\nApproved-by: matt\nRule-loosened: R-002\n')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/removes rule ID\(s\).*R-002/)
    expect(r.out).toMatch(/IDs are never removed or reused/)
  })

  it('refuses deleting the baseline', () => {
    repo.git('rm', '-q', '-f', BASELINE)
    const r = hook('delete the baseline')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/may not be deleted/)
  })

  it('refuses a staged baseline that is not JSON', () => {
    writeFileSync(file(), 'not json')
    repo.git('add', BASELINE)
    const r = hook('break it')
    expect(r.status).toBe(1)
    expect(r.out).toMatch(/not valid JSON/)
  })

  it('has no override environment variable', () => {
    const b = clone(base())
    b.thresholds['R-002'].value = -18
    stage(b)
    const msg = join(dir, 'COMMIT_EDITMSG')
    writeFileSync(msg, 'loosen')
    const r = spawnSync(process.execPath, [SCRIPT, msg], { encoding: 'utf8', env: { ...repo.env, RULE_LOOSENING_OK: '1', DRAFT_FIRST_OK: '1', SKIP_LOCAL_GATES: '1' }, cwd: repo.work })
    expect(r.status).toBe(1)
  })
})
