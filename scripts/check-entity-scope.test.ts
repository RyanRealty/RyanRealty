import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolvingNodeModules } from './__tests__/lib/resolve-node-modules.mjs'

/**
 * Break-tests for ci:entity-scope (scripts/check-entity-scope.mjs, G66).
 *
 * A gate nobody watched fail is not a gate. Nine cases, one per rule the gate
 * claims, run against a synthetic admin tree in a sandbox — the script scans
 * whatever `cwd/app/admin` holds, so the fixtures ARE the surface under test.
 *
 * Base tree (seeded into the baseline, so every case starts green):
 *   legacy/[slug]  — dynamic, unscoped  → the pre-existing debt
 *   bridge/[id]    — dynamic, pure redirect bridge
 *   settings       — NON-dynamic, unscoped
 *
 * Sandbox lives OUTSIDE the repo with node_modules symlinked in (so
 * `import ts from 'typescript'` resolves) — an in-repo scratch dir dies to a
 * concurrent session's `git clean -fd`.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SANDBOX = join(
  tmpdir(),
  `rr-entity-scope-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`,
)
const GATE = join(SANDBOX, 'scripts/check-entity-scope.mjs')
const BASELINE = join(SANDBOX, 'scripts/entity-scope-baseline.json')
const ADMIN = join(SANDBOX, 'app/admin/(protected)')

/** Dynamic entity reader with only a CAPABILITY check — the bug class itself. */
const NO_SCOPE = `import { requireAdminPage } from '@/lib/admin/auth'
import { getPerson } from '@/lib/data'
export default async function Entity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdminPage('people.view')
  const row = await getPerson(id)
  return <div><span>{row.name}</span></div>
}
`

/** The same page, ownership-checked through the async wrapper. */
const WITH_REQUIRE_PERSON = `import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { notFound } from 'next/navigation'
export default async function Entity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await getCrmAccess()
  const guard = await requirePersonInScope(Number(id), access)
  if (!guard.ok) notFound()
  return <div><span>{id}</span></div>
}
`

/** The same page, ownership-checked through the pure per-deal decision. */
const WITH_DEAL_IN_SCOPE = `import { dealInScope } from '@/lib/crm/deal-scope'
import { notFound } from 'next/navigation'
export default async function Entity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getDeal(id)
  if (!dealInScope(access.scoped, deal.assigned_broker, null)) notFound()
  return <div><span>{deal.address}</span></div>
}
`

/**
 * Imports the guard, never calls it — and names a call in a comment, so this
 * fixture also proves the gate reads the parse tree and not the text.
 */
const IMPORTS_BUT_NEVER_CALLS = `import { requirePersonInScope } from '@/app/actions/crm'
// TODO: requirePersonInScope(Number(id), access) before we render anything.
export default async function Entity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await getPerson(id)
  return <div><span>{row.name}</span></div>
}
`

/** Pure bridge: redirects, renders nothing. Never an entity reader. */
const PURE_BRIDGE = `import { redirect } from 'next/navigation'
export default async function Bridge({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(\`/admin/people/\${id}\`)
}
`

/** Auth-guard redirect AND JSX — renders, so it is NOT a bridge. */
const AUTH_GUARD_WITH_JSX = `import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/auth'
export default async function Guarded({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await requireAdminPage('people.view')
  if (!ok) redirect('/admin/access-denied')
  const row = await getPerson(id)
  return <div><span>{row.name}</span></div>
}
`

/** No dynamic segment — no caller-supplied record id, out of scope for G66. */
const NON_DYNAMIC = `export default async function Settings() {
  const rows = await listSettings()
  return <div><span>{rows.length}</span></div>
}
`

function writePage(dir: string, content: string) {
  mkdirSync(join(ADMIN, dir), { recursive: true })
  writeFileSync(join(ADMIN, dir, 'page.tsx'), content)
}

function writeFixtures() {
  rmSync(join(SANDBOX, 'app'), { recursive: true, force: true })
  rmSync(BASELINE, { force: true })
  writePage('legacy/[slug]', NO_SCOPE)
  writePage('bridge/[id]', PURE_BRIDGE)
  writePage('settings', NON_DYNAMIC)
}

function run(args: string[] = []) {
  try {
    const stdout = execFileSync('node', [GATE, ...args], { cwd: SANDBOX, encoding: 'utf8' })
    return { code: 0, out: stdout }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

/** Seed the baseline from the untouched tree AND prove that tree is green. */
function seed() {
  expect(run(['--write-baseline']).code).toBe(0)
  const green = run()
  expect(green.out).toContain('✓ entity-scope')
  expect(green.code).toBe(0)
}

// ── setup ────────────────────────────────────────────────────────────────
rmSync(SANDBOX, { recursive: true, force: true })
mkdirSync(join(SANDBOX, 'scripts'), { recursive: true })
cpSync(join(REPO, 'scripts/check-entity-scope.mjs'), GATE)
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

// Each case spawns the checker as a subprocess (test 9 spawns three); under
// parallel-suite machine load the default 5s timeout flakes — seen twice 2026-08-11.
describe('ci:entity-scope (G66)', { timeout: 30_000 }, () => {
  it('1. FAILS: a NEW dynamic page with no scope call', () => {
    writePage('people/[id]', NO_SCOPE)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('people/[id]/page.tsx')
    expect(r.out).toContain('NO broker-scope check')
  })

  it('2. PASSES: the same page with a requirePersonInScope call', () => {
    writePage('people/[id]', WITH_REQUIRE_PERSON)
    const r = run()
    expect(r.out).toContain('✓ entity-scope')
    expect(r.code).toBe(0)
  })

  it('3. PASSES: the same page with a dealInScope call', () => {
    writePage('people/[id]', WITH_DEAL_IN_SCOPE)
    const r = run()
    expect(r.out).toContain('✓ entity-scope')
    expect(r.code).toBe(0)
  })

  it('4. FAILS: a page that IMPORTS a scope function but never calls it', () => {
    writePage('people/[id]', IMPORTS_BUT_NEVER_CALLS)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('people/[id]/page.tsx')
  })

  it('5. PASSES: a NEW pure redirect bridge (redirect + no JSX)', () => {
    writePage('old-route/[id]', PURE_BRIDGE)
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('redirect bridge')
  })

  it('6. FAILS: an auth-guard redirect WITH JSX is not a bridge', () => {
    writePage('guarded/[id]', AUTH_GUARD_WITH_JSX)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('guarded/[id]/page.tsx')
    expect(r.out).toContain('NO broker-scope check')
  })

  it('7. PASSES: a NEW non-dynamic page with no scope call (out of scope for this gate)', () => {
    writePage('reports', NON_DYNAMIC)
    const r = run()
    expect(r.out).toContain('✓ entity-scope')
    expect(r.code).toBe(0)
  })

  it('8. FAILS: deleting a baselined entry while the page is still unscoped', () => {
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
    expect(baseline.unscopedDynamicPages).toContain('app/admin/(protected)/legacy/[slug]/page.tsx')
    baseline.unscopedDynamicPages = baseline.unscopedDynamicPages.filter(
      (p: string) => !p.includes('legacy/[slug]')
    )
    baseline.count = baseline.unscopedDynamicPages.length
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('legacy/[slug]/page.tsx')
  })

  it('9. FAILS loudly: a missing or unparseable baseline', () => {
    rmSync(BASELINE, { force: true })
    const missing = run()
    expect(missing.code).toBe(1)
    expect(missing.out).toContain('missing scripts/entity-scope-baseline.json')

    writeFileSync(BASELINE, '{ this is not json\n')
    const broken = run()
    expect(broken.code).toBe(1)
    expect(broken.out).toContain('unparseable')

    writeFileSync(BASELINE, JSON.stringify({ note: 'hand-mangled', count: 0 }) + '\n')
    const malformed = run()
    expect(malformed.code).toBe(1)
    expect(malformed.out).toContain('malformed')
  })
})
