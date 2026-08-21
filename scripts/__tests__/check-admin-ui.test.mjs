import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolvingNodeModules } from './lib/resolve-node-modules.mjs'

/**
 * Break-tests for ci:admin-ui (scripts/check-admin-ui.mjs, G65).
 *
 * Synthetic fixture tree (the gate scans whatever cwd/app/admin holds), one
 * page per classification: a v2 page, a true redirect bridge (no JSX), an
 * auth-guard legacy page (redirect + JSX — the shape that fooled the first
 * draft of the bridge heuristic), and a plain legacy page. Baseline is seeded
 * from the untouched tree, so the first case proves the copy passes and every
 * failure below is the mutation.
 *
 * Sandbox lives OUTSIDE the repo with node_modules symlinked in (so
 * `import ts from 'typescript'` resolves) — an in-repo scratch dir dies to a
 * concurrent session's `git clean -fd`.
 *
 * The sandbox path carries pid + a random suffix because setup and teardown
 * BOTH rmSync the whole tree. On a fixed path any concurrent instance deletes
 * a live one mid-test and the run dies on ENOENT reading a fixture it just
 * wrote — and concurrency is the normal case here: vitest runs this file under
 * both the `unit` and `gates` projects, and sibling worktrees run the suite at
 * the same time. Same convention as scripts/check-entity-scope.test.ts.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-admin-ui-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-admin-ui.mjs')
const ADMIN = join(SANDBOX, 'app/admin/(protected)')

const V2_PAGE = `import { Button, QueueRow } from '@/components/admin/v2'
export default function Today() {
  return (
    <div className="max-w-5xl">
      <Button>Send it</Button>
      <Button variant="quiet">Skip</Button>
    </div>
  )
}
`
const BRIDGE_PAGE = `import { redirect } from 'next/navigation'
export default function Bridge() {
  redirect('/admin/today')
}
`
const AUTH_GUARD_LEGACY = `import { redirect } from 'next/navigation'
export default async function Legacy({ session }) {
  if (!session) redirect('/admin/login')
  return <div className="max-w-7xl"><h1>Old page</h1><button>Old action</button></div>
}
`
const PLAIN_LEGACY = `export default function Plain() {
  return <div className="max-w-3xl"><h2>Legacy section</h2><input /></div>
}
`

function writeFixtures() {
  rmSync(join(SANDBOX, 'app'), { recursive: true, force: true })
  rmSync(join(SANDBOX, 'scripts/admin-ui-baseline.json'), { force: true })
  for (const [dir, content] of [
    ['today', V2_PAGE],
    ['old-route', BRIDGE_PAGE],
    ['guarded', AUTH_GUARD_LEGACY],
    ['plain', PLAIN_LEGACY],
  ]) {
    mkdirSync(join(ADMIN, dir), { recursive: true })
    writeFileSync(join(ADMIN, dir, 'page.tsx'), content)
  }
}

function run(args = []) {
  try {
    const stdout = execFileSync('node', [GATE, ...args], { cwd: SANDBOX, encoding: 'utf8' })
    return { code: 0, out: stdout }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

function seed() {
  const r = run(['--write-baseline'])
  expect(r.code).toBe(0)
}

// ── setup ────────────────────────────────────────────────────────────────
rmSync(SANDBOX, { recursive: true, force: true })
mkdirSync(join(SANDBOX, 'scripts'), { recursive: true })
cpSync(join(REPO, 'scripts/check-admin-ui.mjs'), GATE)
if (!existsSync(join(SANDBOX, 'node_modules'))) {
  symlinkSync(resolvingNodeModules(), join(SANDBOX, 'node_modules'), 'dir')
}
if (!existsSync(join(SANDBOX, 'package.json'))) {
  writeFileSync(join(SANDBOX, 'package.json'), '{"type":"module"}\n')
}

afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

beforeEach(() => {
  writeFixtures()
  seed()
})

describe('ci:admin-ui (G65)', () => {
  it('untouched fixture tree passes against its own seed', () => {
    const r = run()
    expect(r.out).toContain('✓ admin-ui')
    expect(r.code).toBe(0)
  })

  it('baseline sees through the auth-guard disguise: guarded page is LEGACY, no-JSX bridge is not', () => {
    const baseline = JSON.parse(
      execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync('${join(SANDBOX, 'scripts/admin-ui-baseline.json')}','utf8'))`], { encoding: 'utf8' })
    )
    const legacy = baseline.legacyPages.join('\n')
    expect(legacy).toContain('guarded/page.tsx')
    expect(legacy).toContain('plain/page.tsx')
    expect(legacy).not.toContain('old-route/page.tsx') // true bridge
    expect(legacy).not.toContain('today/page.tsx') // v2
  })

  it('FAILS: raw <button> added to a migrated page', () => {
    writeFileSync(
      join(ADMIN, 'today/page.tsx'),
      V2_PAGE.replace('<Button>Send it</Button>', '<Button>Send it</Button><button>raw</button>')
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('raw <button>')
  })

  it('FAILS: a NEW legacy page appears', () => {
    mkdirSync(join(ADMIN, 'brand-new'), { recursive: true })
    writeFileSync(join(ADMIN, 'brand-new/page.tsx'), PLAIN_LEGACY)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('NEW legacy page')
  })

  it('FAILS: a second primary Button lands on a v2 page', () => {
    writeFileSync(
      join(ADMIN, 'today/page.tsx'),
      V2_PAGE.replace('<Button variant="quiet">Skip</Button>', '<Button>Also primary</Button>')
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('primary Buttons')
  })

  it('FAILS: width sprawl grows (a NEW distinct max-w token appears)', () => {
    writeFileSync(join(ADMIN, 'plain/page.tsx'), PLAIN_LEGACY.replace('<h2>', '<h2 className="max-w-[999px]">'))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('width sprawl grew')
  })

  it('safe shape: swapping one width token for another keeps the count and stays green', () => {
    writeFileSync(join(ADMIN, 'plain/page.tsx'), PLAIN_LEGACY.replace('max-w-3xl', 'max-w-[973px]'))
    const r = run()
    expect(r.code).toBe(0)
  })

  it('stays green when counts SHRINK, and reports the ratchet', () => {
    writeFileSync(join(ADMIN, 'plain/page.tsx'), `export default function Plain() {\n  return <div className="max-w-3xl" />\n}\n`)
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('re-seed')
  })

  it('safe shape: a quiet-variant Button is never a primary violation', () => {
    writeFileSync(
      join(ADMIN, 'today/page.tsx'),
      V2_PAGE.replace('<Button variant="quiet">Skip</Button>', '<Button variant="quiet">Skip</Button><Button variant="danger">Kill</Button>')
    )
    const r = run()
    expect(r.code).toBe(0)
  })
})
