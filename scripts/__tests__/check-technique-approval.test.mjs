import { describe, expect, it, afterEach } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { REGISTRY, approvedRowChanges, canonical, messageProblems } from '../check-technique-approval.mjs'

const SCRIPT = resolve('scripts/check-technique-approval.mjs')

/**
 * The environment for git in a throwaway repository: every GIT_* variable removed.
 * Inside a git hook (the pre-commit run of this suite) GIT_DIR and GIT_INDEX_FILE
 * point at the real repository, and a `git init` or `git commit` run with them set
 * lands THERE, not in the temp dir: on 2026-10-14 that re-initialised the main
 * checkout as bare and committed a stray "init" on the working branch.
 */
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))
const ready = { category: 'scene', kind: 'code', status: 'ready', tier: 'signature' }
const approved = { ...ready, status: 'approved', approved_by: 'matt', approved_on: '2026-10-20', reel: 'https://reels.example.com/a.mp4' }

describe('approvedRowChanges', () => {
  it('names an approved row that is new or changed, and nothing else', () => {
    expect(approvedRowChanges({ a: ready }, { a: approved })).toEqual(['a'])
    expect(approvedRowChanges({}, { a: approved })).toEqual(['a'])
    expect(approvedRowChanges(null, { a: approved })).toEqual(['a'])
    expect(approvedRowChanges({ a: approved }, { a: { ...approved, reel: 'https://reels.example.com/b.mp4' } })).toEqual(['a'])
    expect(approvedRowChanges({ a: approved }, { a: approved })).toEqual([])
    // Key order is not a change; lowering or removing an approval needs nothing.
    expect(approvedRowChanges({ a: approved }, { a: Object.fromEntries(Object.entries(approved).reverse()) })).toEqual([])
    expect(approvedRowChanges({ a: approved }, { a: ready })).toEqual([])
    expect(approvedRowChanges({ a: approved }, {})).toEqual([])
  })

  it('lets a merge bring in a row its own branch already approved', () => {
    expect(approvedRowChanges({ a: ready }, { a: approved }, [{ a: approved }])).toEqual([])
    expect(approvedRowChanges({ a: ready }, { a: { ...approved, approved_on: '2026-10-21' } }, [{ a: approved }])).toEqual(['a'])
  })

  it('compares canonically', () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}')
  })
})

describe('messageProblems', () => {
  it('needs Approved-by: matt and every name', () => {
    expect(messageProblems('anything', [])).toEqual([])
    expect(messageProblems('feat: approve a\n\nApproved-by: matt\n', ['a'])).toEqual([])
    expect(messageProblems('feat: approve line_draw_riding_dot\n\nApproved-by: Matt', ['line_draw_riding_dot'])).toEqual([])
    expect(messageProblems('feat: approve it', ['line_draw_riding_dot'])).toEqual(['no `Approved-by: matt` line', 'the message does not name "line_draw_riding_dot"'])
    expect(messageProblems('Approved-by: claude\nline_draw_riding_dot', ['line_draw_riding_dot'])).toEqual(['no `Approved-by: matt` line'])
    expect(messageProblems('Approved-by: matt\nline_draw_riding_dot_v2', ['line_draw_riding_dot'])).toEqual(['the message does not name "line_draw_riding_dot"'])
    expect(messageProblems('Approved-by: matt\n# line_draw_riding_dot (a comment git strips)', ['line_draw_riding_dot'])).toEqual(['the message does not name "line_draw_riding_dot"'])
    expect(messageProblems('approve a and b\nApproved-by: matt', ['a', 'b', 'c'])).toEqual(['the message does not name "c"'])
  })
})

describe('the commit-msg hook in a real repository', () => {
  const dirs = []
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
  })
  const repo = () => {
    const d = mkdtempSync(join(tmpdir(), 'rr-approval-'))
    dirs.push(d)
    const g = (...args) =>
      execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
        cwd: d,
        encoding: 'utf8',
        env: { ...CLEAN_ENV, GIT_CEILING_DIRECTORIES: tmpdir() },
      })
    g('init', '-q')
    // Refuse to go on unless git is really working in the temp dir.
    expect(g('rev-parse', '--show-toplevel').trim()).toBe(realpathSync(d))
    const write = (techniques) => {
      mkdirSync(dirname(join(d, REGISTRY)), { recursive: true })
      writeFileSync(join(d, REGISTRY), JSON.stringify({ techniques }, null, 2))
    }
    write({ a: ready, other: { ...ready, tier: 'base' } })
    g('add', '-A')
    g('commit', '-q', '-m', 'init')
    const hook = (message) => {
      writeFileSync(join(d, 'MSG'), message)
      return spawnSync(process.execPath, [SCRIPT, join(d, 'MSG')], { cwd: d, encoding: 'utf8', env: { ...CLEAN_ENV, GIT_CEILING_DIRECTORIES: tmpdir() } })
    }
    return { d, g, write, hook }
  }

  it('refuses a staged approval without the trailer and the name, and passes with both', () => {
    const r = repo()
    r.write({ a: approved, other: { ...ready, tier: 'base' } })
    r.g('add', '-A')
    const bad = r.hook('feat: approve the riding dot\n')
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('Technique approval gate FAILED')
    expect(bad.stderr).toContain('no `Approved-by: matt` line')
    expect(bad.stderr).toContain('the message does not name "a"')
    expect(r.hook('feat: approve a\n\nApproved-by: matt\n').status).toBe(0)
  })

  it('passes a commit that leaves the registry alone, or only touches unapproved rows', () => {
    const r = repo()
    writeFileSync(join(r.d, 'other.txt'), 'x')
    r.g('add', '-A')
    expect(r.hook('chore: other').status).toBe(0)
    r.write({ a: { ...ready, home: 'lib/x' }, other: { ...ready, tier: 'base' } })
    r.g('add', '-A')
    expect(r.hook('chore: edit a ready row').status).toBe(0)
  })

  it('refuses a staged registry that is not JSON', () => {
    const r = repo()
    writeFileSync(join(r.d, REGISTRY), '{ broken')
    r.g('add', '-A')
    const out = r.hook('chore: x')
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('is not valid JSON')
  })
})
