import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolvingNodeModules } from '../lib/resolve-node-modules.mjs'

/**
 * Break-tests for ci:ssg-budget (scripts/check-ssg-budget.mjs, G70).
 *
 * The gate pins two DB-heavy geo routes to a zero build-time SSG fan-out
 * (generateStaticParams must be exactly `return []`). Each case copies the
 * real inspected files into a sandbox outside the repo (node_modules
 * symlinked so `import ts from 'typescript'` resolves; an in-repo scratch
 * dir dies to a concurrent session's `git clean -fd`), then mutates exactly
 * one thing and asserts the gate's verdict.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-ssg-budget-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-ssg-budget.mjs')

const FILES = [
  'scripts/check-ssg-budget.mjs',
  'app/subdivisions/[slug]/page.tsx',
  'app/oregon/[city]/page.tsx',
]

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
  symlinkSync(resolvingNodeModules(), join(SANDBOX, 'node_modules'), 'dir')
}

function run() {
  try {
    const stdout = execFileSync('node', [GATE], { cwd: SANDBOX, encoding: 'utf8' })
    return { code: 0, out: stdout }
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

const SUB_PAGE = 'app/subdivisions/[slug]/page.tsx'

describe('check-ssg-budget', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('passes on the untouched real files', () => {
    reset()
    const r = run()
    expect(r.out).toContain('OK')
    expect(r.code).toBe(0)
  })

  it('fails when a budgeted route regrows a fan-out', () => {
    reset()
    const file = join(SANDBOX, SUB_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(file, src.replace('return []', "return [{ slug: 'awbrey-glen' }]"))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain(SUB_PAGE)
  })

  it('fails when a budgeted route regrows a computed fan-out', () => {
    reset()
    const file = join(SANDBOX, SUB_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(
      file,
      src.replace('return []', 'const slugs = await loadSlugs()\n  return slugs'),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain(SUB_PAGE)
  })

  it('fails when generateStaticParams disappears from a budgeted route', () => {
    reset()
    const file = join(SANDBOX, SUB_PAGE)
    const src = readFileSync(file, 'utf8')
    // Target the EXPORT, not the first mention. A route's header paragraph
    // names generateStaticParams in prose (the plat page's does, describing the
    // contract it carries across), and a bare first-occurrence replace renamed
    // that sentence while leaving the real export in place — so the gate
    // correctly passed and this test read the pass as a miss.
    const retired = src.replace(
      /export async function generateStaticParams/,
      'export async function generateStaticParamsRetired',
    )
    expect(retired).not.toBe(src)
    writeFileSync(file, retired)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('no generateStaticParams')
  })

  it('fails when a listed route file is missing (stale ZERO_PRERENDER list)', () => {
    reset()
    rmSync(join(SANDBOX, 'app/oregon'), { recursive: true, force: true })
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('file missing')
  })

  it('stays green when only comments change around the empty return', () => {
    reset()
    const file = join(SANDBOX, SUB_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(file, src.replace('return []', '// still budgeted to zero\n  return []'))
    const r = run()
    expect(r.code).toBe(0)
  })
})
