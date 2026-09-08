import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:site-node (scripts/check-site-node.mjs, G72).
 *
 * The gate refuses a commit that touches app/** or components/site/** without
 * a `Node: <id>` / `Node: none (<reason>)` trailer naming the site-queue node
 * it serves. Each case builds a real, disposable git repo outside the
 * checked-out tree, stages files, writes a commit-message file, and invokes
 * the real gate script against that fixture.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-site-node.mjs')

// When this suite runs inside a git hook (pre-commit runs `npm test`), git
// exports GIT_INDEX_FILE / GIT_DIR-family vars that would redirect the
// fixture's git commands at the REAL repo. Strip every GIT_* before spawning.
// (reference_git_fixture_env_leak.md — a fixture `git add`/`git config` that
// leaks into the real repo has poisoned the working index before.)
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

const SANDBOX = join(tmpdir(), `rr-site-node-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)

function git(args) {
  const r = spawnSync('git', args, { cwd: SANDBOX, encoding: 'utf8', env: cleanEnv })
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  git(['init', '-q'])
  git(['config', 'user.email', 'test@test.invalid'])
  git(['config', 'user.name', 'test'])
}

function stageFile(relPath, contents = 'x\n') {
  const dest = join(SANDBOX, relPath)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
  git(['add', relPath])
}

function writeMsg(text) {
  const file = join(SANDBOX, 'MSG')
  writeFileSync(file, text)
  return file
}

function run(msgFile, envExtra = {}) {
  const r = spawnSync('node', [GATE, msgFile], {
    cwd: SANDBOX,
    encoding: 'utf8',
    env: { ...cleanEnv, ...envExtra },
  })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('check-site-node', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('fails when app/** is staged without a Node: trailer, naming the rule and the path', () => {
    reset()
    stageFile('app/foo/page.tsx', 'export default function Page() { return null }\n')
    const msgFile = writeMsg('fix: something\n')
    const r = run(msgFile)
    expect(r.code).toBe(1)
    expect(r.out).toContain('G72')
    expect(r.out).toContain('site commits name their node')
    expect(r.out).toContain('app/foo/page.tsx')
  })

  it('fails when components/site/** is staged without a Node: trailer', () => {
    reset()
    stageFile('components/site/v3/Thing.tsx', 'export default function Thing() { return null }\n')
    const msgFile = writeMsg('fix: something\n')
    const r = run(msgFile)
    expect(r.code).toBe(1)
    expect(r.out).toContain('components/site/v3/Thing.tsx')
  })

  it('passes with a `Node: <uuid>` trailer', () => {
    reset()
    stageFile('app/foo/page.tsx')
    const msgFile = writeMsg('fix: something\n\nNode: 4618d781-e5c7-4cd5-a036-05aff5de3249\n')
    const r = run(msgFile)
    expect(r.code).toBe(0)
  })

  it('passes with a `Node: none (<reason>)` trailer', () => {
    reset()
    stageFile('app/foo/page.tsx')
    const msgFile = writeMsg('fix: something\n\nNode: none (typo fix)\n')
    const r = run(msgFile)
    expect(r.code).toBe(0)
  })

  it('passes when only non-site paths are staged, no trailer required', () => {
    reset()
    stageFile('lib/foo.ts')
    const msgFile = writeMsg('fix: something\n')
    const r = run(msgFile)
    expect(r.code).toBe(0)
  })

  it('passes with SITE_NODE_OK=1 even without a trailer', () => {
    reset()
    stageFile('app/foo/page.tsx')
    const msgFile = writeMsg('fix: something\n')
    const r = run(msgFile, { SITE_NODE_OK: '1' })
    expect(r.code).toBe(0)
  })

  it('--report mode always exits 0 and prints the rule', () => {
    reset()
    stageFile('app/foo/page.tsx')
    const r = spawnSync('node', [GATE, '--report'], { cwd: SANDBOX, encoding: 'utf8', env: cleanEnv })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('G72')
  })
})
