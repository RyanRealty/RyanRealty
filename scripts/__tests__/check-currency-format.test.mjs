import { describe, expect, it, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:currency-format (check-currency-format.mjs), extended
 * SITE-139 (Matt 2026-09-21): "map chips use $795k / $1.2M while listing
 * cards still print $650K — one house publisher."
 *
 * Before this ticket the gate only caught inline `Intl.NumberFormat(...
 * currency ...)`. Four real call sites hand-rolled a `$${n / 1000}k` compact
 * price template instead — no Intl call, so the old gate never saw them.
 * These tests exercise the two checks that close that hole:
 *   - the lowercase-suffix check (zero tolerance, never baselined)
 *   - the general compact-template ratchet (either case, baselined)
 * plus the original Intl.NumberFormat ratchet, so a regression in any of the
 * three is caught here rather than by re-discovering the bug in prod.
 *
 * The sandbox is synthetic (not a copy of the real tree) so these tests
 * never drift when real files migrate off the baseline.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), `rr-currency-format-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-currency-format.mjs')

function write(rel, contents) {
  const p = join(SANDBOX, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, contents)
}

function writeBaseline(baseline) {
  write('scripts/currency-format-baseline.json', JSON.stringify(baseline, null, 2))
}

function run(args = []) {
  try {
    return { code: 0, out: execFileSync('node', [GATE, ...args], { cwd: SANDBOX, encoding: 'utf8' }) }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

/** Fresh sandbox: just the gate + its walk.mjs dependency + an empty baseline. */
function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  write('scripts/check-currency-format.mjs', readGateSource())
  const walkSrc = readFileFromRepo('scripts/lib/walk.mjs')
  write('scripts/lib/walk.mjs', walkSrc)
  writeBaseline({ note: 'test baseline', files: [], compactTemplateFiles: [] })
  // walkFiles only descends into directories that exist.
  mkdirSync(join(SANDBOX, 'app'), { recursive: true })
  mkdirSync(join(SANDBOX, 'lib'), { recursive: true })
  mkdirSync(join(SANDBOX, 'components'), { recursive: true })
}

function readFileFromRepo(rel) {
  return execFileSync('cat', [join(REPO, rel)], { encoding: 'utf8' })
}

function readGateSource() {
  return readFileFromRepo('scripts/check-currency-format.mjs')
}

describe('ci:currency-format', () => {
  beforeEach(() => reset())

  it('passes on an empty tree', () => {
    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).toMatch(/OK —/)
  })

  it('SITE-139: fails on a hand-rolled lowercase-k compact price ("$795k"), zero tolerance', () => {
    write(
      'lib/maps/some-new-map.ts',
      "export function label(price) { return `$${Math.round(price / 1000)}k` }\n",
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/SITE-139/)
    expect(out).toMatch(/lib\/maps\/some-new-map\.ts/)
  })

  it('SITE-139: fails on a hand-rolled lowercase-m compact price ("$1.2m")', () => {
    write(
      'lib/data/crm/some-new-alert.ts',
      "export function fmt(v) { return `$${v}m` }\n",
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/SITE-139/)
    expect(out).toMatch(/some-new-alert\.ts/)
  })

  it('the lowercase check is never satisfied by a baseline entry — it is zero tolerance', () => {
    write(
      'lib/maps/some-new-map.ts',
      "export function label(price) { return `$${Math.round(price / 1000)}k` }\n",
    )
    // Baselining the file (as if it were pre-existing) must NOT silence check 2.
    writeBaseline({ files: [], compactTemplateFiles: ['lib/maps/some-new-map.ts'] })
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/SITE-139/)
  })

  it('exempts the documented recommend-once.ts matcher from the lowercase check', () => {
    write(
      'lib/cma/recommend-once.ts',
      "export function forms(k) { return [`$${k}k`, `$${k}K`] }\n",
    )
    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).not.toMatch(/recommend-once/)
  })

  it('passes an uppercase-K compact price with no arithmetic shape (not a money template match)', () => {
    // Doesn't divide by 1000 or call .toFixed() inline — outside the
    // compact-template detector's shape, same as a delegating wrapper.
    write('lib/site/some-badge.ts', 'export function badge(short) { return `$${short}K` }\n')
    const { code } = run()
    expect(code).toBe(0)
  })

  it('fails on a NEW hand-rolled compact-price template (uppercase K, ratchet check) not in the baseline', () => {
    write(
      'components/search/SomeNewFilterChip.tsx',
      'export function chip(n) { return n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}` }\n',
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/NEW hand-rolled compact-price template/)
    expect(out).toMatch(/SomeNewFilterChip\.tsx/)
  })

  it('passes a hand-rolled uppercase-K template already recorded in the baseline (ratchet, not a re-fail)', () => {
    write(
      'components/search/SomeNewFilterChip.tsx',
      'export function chip(n) { return n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}` }\n',
    )
    writeBaseline({ files: [], compactTemplateFiles: ['components/search/SomeNewFilterChip.tsx'] })
    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).not.toMatch(/NEW hand-rolled/)
  })

  it('fails on a NEW inline currency Intl.NumberFormat (original check 1, unchanged)', () => {
    write(
      'app/some-page/page.tsx',
      "const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })\n",
    )
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/NEW inline currency Intl\.NumberFormat/)
  })

  it('excludes lib/format/ from every check — it is the house publisher itself', () => {
    write(
      'lib/format/some-helper.ts',
      "export function f(n) { return `$${Math.round(n / 1000)}k` } // lowercase on purpose to prove the exclusion\n",
    )
    write(
      'lib/format/some-currency.ts',
      "const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })\n",
    )
    const { code, out } = run()
    expect(code).toBe(0)
    expect(out).not.toMatch(/lib\/format/)
  })

  it('excludes .test.ts files from the currency and compact-template checks', () => {
    write(
      'lib/maps/some-new-map.test.ts',
      "it('x', () => { expect(`$${Math.round(1000 / 1000)}K`).toBe('$1K') })\n",
    )
    const { code } = run()
    expect(code).toBe(0)
  })

  it('--write-baseline records current offenders in both arrays and then passes clean', () => {
    write(
      'lib/site/legacy-badge.ts',
      'export function badge(n) { return n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}` }\n',
    )
    write(
      'app/legacy/page.tsx',
      "const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })\n",
    )
    const written = run(['--write-baseline'])
    expect(written.code).toBe(0)
    expect(written.out).toMatch(/Wrote 1 currency offenders and 1 compact-template offenders/)

    const after = run()
    expect(after.code).toBe(0)
  })

  it('--write-baseline never records a lowercase offender — check 2 has no baseline to launder into', () => {
    write(
      'lib/maps/some-new-map.ts',
      "export function label(price) { return `$${Math.round(price / 1000)}k` }\n",
    )
    run(['--write-baseline'])
    // Re-run the normal check: the lowercase offender must still fail, proving
    // --write-baseline cannot be used to silence SITE-139.
    const { code, out } = run()
    expect(code).toBe(1)
    expect(out).toMatch(/SITE-139/)
  })
})
