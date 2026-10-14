import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { PAGES, stripComments, stripNonCode, isDegradedIsrClassHit, findDegradedIsrClassHits } from '../check-degraded-isr.mjs'

/**
 * Break-tests for ci:degraded-isr (scripts/check-degraded-isr.mjs).
 *
 * Two layers: fast unit tests against the exported pure functions (no
 * subprocess), and CLI-level sandbox tests — copy the gate + the fixed PAGES
 * list + the mechanism file into a sandbox, mutate/add exactly one file, and
 * assert the whole gate's exit code + message, the same pattern
 * check-public-isr-ttl.test.mjs uses.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const MECHANISM = 'lib/site/degraded-isr.ts'
const SANDBOX = join(tmpdir(), `rr-degraded-isr-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-degraded-isr.mjs')
const FILES = ['scripts/check-degraded-isr.mjs', MECHANISM, ...PAGES]

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function run() {
  try {
    const stdout = execFileSync('node', [GATE], { cwd: SANDBOX, encoding: 'utf8' })
    return { code: 0, out: stdout }
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('ci:degraded-isr — stripNonCode', () => {
  it('drops comment contents (line and block) but keeps the code around them', () => {
    const src = [
      '// this file used to call noStore() before it was fixed',
      'const x = 1',
      '/* also mentions noStore() right here */',
      'const y = 2',
    ].join('\n')
    const out = stripNonCode(src)
    expect(out).not.toMatch(/noStore/)
    expect(out).toMatch(/const x = 1/)
    expect(out).toMatch(/const y = 2/)
  })

  it('drops string and template literal contents but keeps the delimiters', () => {
    const src = 'const msg = "mentions noStore() in a string"\nconst t = `and noStore() in a template`\nconst z = 3'
    const out = stripNonCode(src)
    expect(out).not.toMatch(/noStore/)
    expect(out).toMatch(/const z = 3/)
  })

  it('does not let an apostrophe inside a comment corrupt the strip', () => {
    const src = "// the page's noStore() call was the bug\nconst kept = 4"
    const out = stripNonCode(src)
    expect(out).not.toMatch(/noStore/)
    expect(out).toMatch(/const kept = 4/)
  })
})

describe('ci:degraded-isr — stripComments (unlike stripNonCode, keeps string contents)', () => {
  it('drops comments but leaves a string literal fully intact, closing quote included', () => {
    // Regression: the first version of isDegradedIsrClassHit ran BOTH its
    // checks through stripNonCode, which blanks string contents. That turned
    // `dynamic = 'force-dynamic'` into `dynamic = ''` and the exemption could
    // never match anything — every genuinely dynamic page still failed the
    // gate. stripComments exists so the exemption reads the real string.
    const src = "// noStore() used to be the pattern here\nexport const dynamic = 'force-dynamic'\nconst z = 5"
    const out = stripComments(src)
    expect(out).not.toMatch(/noStore/)
    expect(out).toContain("dynamic = 'force-dynamic'")
    expect(out).toMatch(/const z = 5/)
  })

  it('keeps a template literal intact, backtick included', () => {
    const src = 'const label = `force-dynamic`'
    expect(stripComments(src)).toBe(src)
  })
})

describe('ci:degraded-isr — isDegradedIsrClassHit (the class-wide rule)', () => {
  it('flags a bounded revalidate that calls noStore()', () => {
    expect(isDegradedIsrClassHit("export const revalidate = 900\nif (x) noStore()")).toBe(true)
  })

  it('flags a bounded revalidate that only imports unstable_noStore (never called under that name)', () => {
    const code = "export const revalidate = 60\nimport { unstable_noStore as skipCache } from 'next/cache'\nskipCache()"
    expect(isDegradedIsrClassHit(code)).toBe(true)
  })

  it('does not flag a page with a bounded revalidate and no noStore reference', () => {
    const code = "export const revalidate = 900\nawait refuseDegradedIsr('x', ['y'])"
    expect(isDegradedIsrClassHit(code)).toBe(false)
  })

  it('does not flag revalidate = false (never becomes the prerender-legacy unit)', () => {
    expect(isDegradedIsrClassHit("export const revalidate = false\nnoStore()")).toBe(false)
  })

  it('does not flag revalidate = 0 (always-dynamic, not ISR)', () => {
    expect(isDegradedIsrClassHit("export const revalidate = 0\nnoStore()")).toBe(false)
  })

  it('exempts a bounded revalidate paired with dynamic = force-dynamic (real export, not a comment)', () => {
    const code = "export const revalidate = 900\nexport const dynamic = 'force-dynamic'\nnoStore()"
    expect(isDegradedIsrClassHit(code)).toBe(false)
  })

  it('is not fooled by a decoy comment merely CLAIMING force-dynamic — still flags the real bug', () => {
    const code = "export const revalidate = 900\n// export const dynamic = 'force-dynamic'\nnoStore()"
    expect(isDegradedIsrClassHit(code)).toBe(true)
  })
})

describe('ci:degraded-isr — findDegradedIsrClassHits (the real repo)', () => {
  it('finds zero hits on the current repo — both known bugs (site-index, commercial-space-for-lease) are fixed', () => {
    expect(findDegradedIsrClassHits(REPO)).toEqual([])
  })

  it('does not false-positive on the pages whose header narrates the old noStore() bug in prose', () => {
    const hits = new Set(findDegradedIsrClassHits(REPO))
    expect(hits.has('app/subdivisions/[slug]/page.tsx')).toBe(false)
    expect(hits.has('app/price-drops/page.tsx')).toBe(false)
    expect(hits.has('app/price-drops/[city]/page.tsx')).toBe(false)
  })
})

describe('ci:degraded-isr (CLI)', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('passes on the untouched fixed-list pages + mechanism file', () => {
    reset()
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('ci:degraded-isr passed')
  })

  it('fails THE WHOLE CLASS when a new page exports a bounded revalidate and calls noStore() — the red case', () => {
    reset()
    const extra = join(SANDBOX, 'app/fake-red-case/page.tsx')
    mkdirSync(dirname(extra), { recursive: true })
    writeFileSync(
      extra,
      [
        "import { unstable_noStore as noStore } from 'next/cache'",
        'export const revalidate = 900',
        'export default async function Page() {',
        '  if (Math.random() < 0) noStore()',
        '  return null',
        '}',
        '',
      ].join('\n'),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('THE WHOLE CLASS')
    expect(r.out).toContain('app/fake-red-case/page.tsx')
    expect(r.out).toContain('refuseDegradedIsr')
  })

  it('exempts a bounded revalidate paired with dynamic = force-dynamic', () => {
    reset()
    const extra = join(SANDBOX, 'app/fake-dynamic-case/route.ts')
    mkdirSync(dirname(extra), { recursive: true })
    writeFileSync(
      extra,
      [
        "import { unstable_noStore as noStore } from 'next/cache'",
        'export const revalidate = 60',
        "export const dynamic = 'force-dynamic'",
        'export async function GET() {',
        '  noStore()',
        "  return new Response('ok')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('ci:degraded-isr passed')
  })

  it('does not false-positive on a noStore() mention inside a comment', () => {
    reset()
    const extra = join(SANDBOX, 'app/fake-comment-case/page.tsx')
    mkdirSync(dirname(extra), { recursive: true })
    writeFileSync(
      extra,
      [
        '// This page used to call noStore() before it was fixed (see lib/site/degraded-isr.ts).',
        'export const revalidate = 900',
        'export default async function Page() {',
        '  return null',
        '}',
        '',
      ].join('\n'),
    )
    const r = run()
    expect(r.code).toBe(0)
    expect(r.out).toContain('ci:degraded-isr passed')
  })
})
