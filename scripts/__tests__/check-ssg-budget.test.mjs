import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { resolvingNodeModules } from '../lib/resolve-node-modules.mjs'

/**
 * Break-tests for ci:ssg-budget (scripts/check-ssg-budget.mjs, G70).
 *
 * The gate pins DB-heavy routes to a zero build-time SSG fan-out
 * (generateStaticParams must be exactly `return []`) and, since 2026-09-23
 * (P3, Matt's "nothing is permanent" directive), holds /subdivisions/[slug]
 * to a CAPPED list: `return platPrerenderParams()` over
 * data/plat-prerender.json, at most 25 plats. Each case copies the
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
  'lib/site/plat-prerender.ts',
  'data/plat-prerender.json',
  'app/oregon/[city]/page.tsx',
  // SITE-29: the blog post and the index's category/page views joined the
  // zero-fan-out list (on-demand ISR).
  'app/blog/[slug]/page.tsx',
  'app/blog/category/[category]/page.tsx',
  'app/blog/page/[n]/page.tsx',
  'app/blog/category/[category]/page/[n]/page.tsx',
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

// The zero-budget example. The plat page is the capped example (SUB_PAGE).
const ZERO_PAGE = 'app/oregon/[city]/page.tsx'
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
    const file = join(SANDBOX, ZERO_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(file, src.replace('return []', "return [{ city: 'eugene' }]"))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain(ZERO_PAGE)
  })

  it('fails when a budgeted route regrows a computed fan-out', () => {
    reset()
    const file = join(SANDBOX, ZERO_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(
      file,
      src.replace('return []', 'const slugs = await loadSlugs()\n  return slugs'),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain(ZERO_PAGE)
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
    const file = join(SANDBOX, ZERO_PAGE)
    const src = readFileSync(file, 'utf8')
    writeFileSync(file, src.replace('return []', '// still budgeted to zero\n  return []'))
    const r = run()
    expect(r.code).toBe(0)
  })

  it('fails when the capped plat route computes its own fan-out', () => {
    reset()
    const file = join(SANDBOX, SUB_PAGE)
    const src = readFileSync(file, 'utf8')
    const grown = src.replace(
      'return platPrerenderParams()',
      'return (await getIndexableSubdivisions()).map((p) => ({ slug: p.slug }))',
    )
    expect(grown).not.toBe(src)
    writeFileSync(file, grown)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('generateStaticParams must be exactly `return platPrerenderParams()`')
  })

  it('fails when the plat list outgrows the cap', () => {
    reset()
    const file = join(SANDBOX, 'data/plat-prerender.json')
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    doc.plats = Array.from({ length: 26 }, (_, i) => ({ slug: `plat-${i}`, impressions: 1, clicks: 0 }))
    writeFileSync(file, JSON.stringify(doc))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('26 entries exceeds the cap of 25')
  })

  it('fails when the helper raises its own cap past the gate', () => {
    reset()
    const file = join(SANDBOX, 'lib/site/plat-prerender.ts')
    const src = readFileSync(file, 'utf8')
    const raised = src.replace('export const PLAT_PRERENDER_CAP = 25', 'export const PLAT_PRERENDER_CAP = 400')
    expect(raised).not.toBe(src)
    writeFileSync(file, raised)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('PLAT_PRERENDER_CAP must be declared and at most 25')
  })
})
