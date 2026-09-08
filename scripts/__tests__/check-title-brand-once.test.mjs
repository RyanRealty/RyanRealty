import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Break-tests for ci:title-brand-once (scripts/check-title-brand-once.mjs).
 *
 * The gate refuses a document-level `title:` that bakes in "Ryan Realty" while
 * app/layout.tsx's title.template appends it too — the shape that shipped
 * "La Pine: Last Year's Sales | Ryan Realty | Ryan Realty — Central Oregon" and
 * "Bend home sales archive | Ryan Realty | Ryan Realty — Central Oregon" live
 * (SITE-26). Each case materializes a disposable fixture tree and runs the REAL
 * gate against it via --root, so every red path is proven to fire and every
 * allowed shape proven green.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-title-brand-once.mjs')

// This suite can run inside a git hook, and git exports GIT_INDEX_FILE /
// GIT_DIR-family vars that redirect child tooling at the REAL repo. Strip every
// GIT_* before spawning (reference_git_fixture_env_leak.md).
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

const SANDBOX = join(
  tmpdir(),
  `rr-title-brand-once-${process.pid}-${Math.random().toString(16).slice(2)}`,
)

function write(relPath, contents) {
  const dest = join(SANDBOX, relPath)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
}

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  // The real root layout shape: the template is what makes a baked brand a
  // double brand, and its own title.default / title.template must stay green.
  write(
    'app/layout.tsx',
    [
      'export const metadata = {',
      '  title: {',
      '    default: "Ryan Realty — Central Oregon Real Estate",',
      '    template: "%s | Ryan Realty — Central Oregon",',
      '  },',
      '}',
      'export default function RootLayout({ children }) { return children }',
      '',
    ].join('\n'),
  )
}

function run() {
  const res = spawnSync('node', [GATE, '--root', SANDBOX, '--json'], {
    encoding: 'utf8',
    env: cleanEnv,
  })
  return { status: res.status, report: JSON.parse(res.stdout) }
}

beforeEach(reset)
afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('ci:title-brand-once', () => {
  it('passes on the root layout alone (title.default and title.template are the mechanism)', () => {
    const { status, report } = run()
    expect(report.violations).toEqual([])
    expect(status).toBe(0)
  })

  it('FAILS on a hand-built Metadata object whose title bakes in the brand', () => {
    write(
      'app/reports/page.tsx',
      [
        'export const metadata = { title: "Bend home sales archive | Ryan Realty" }',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(status).toBe(1)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0].file).toBe('app/reports/page.tsx')
    expect(report.violations[0].title).toContain('Ryan Realty')
  })

  it('FAILS on a template literal title, the live /reports/sales shape', () => {
    write(
      'app/sales/page.tsx',
      [
        'export async function generateMetadata() {',
        '  const city = "La Pine"',
        '  return { title: `${city}: Last Year\\u2019s Sales | Ryan Realty` }',
        '}',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(status).toBe(1)
    expect(report.violations[0].shape).toBe('title: <branded literal>')
  })

  it('FAILS on a shorthand `title` whose local const holds the branded string', () => {
    write(
      'app/shorthand/page.tsx',
      [
        'export async function generateMetadata() {',
        '  const title = `Bend home sales archive | Ryan Realty`',
        '  const description = "x"',
        '  return { title, description }',
        '}',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(status).toBe(1)
    expect(report.violations[0].shape).toBe('title, (shorthand for a branded local)')
  })

  it('FAILS on string concatenation that assembles the brand', () => {
    write(
      'app/concat/page.tsx',
      [
        'export const metadata = { title: "Compare homes" + " | Ryan Realty" }',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    expect(run().status).toBe(1)
  })

  it('passes a title routed through pageMetadata (cleanTitle strips the baked brand)', () => {
    write(
      'app/buy/page.tsx',
      [
        'import { pageMetadata } from "@/lib/site/page-metadata"',
        'export const metadata = pageMetadata({',
        '  title: "Buy a home in Central Oregon · Ryan Realty",',
        '  description: "x",',
        '  path: "/buy",',
        '})',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(report.violations).toEqual([])
    expect(status).toBe(0)
  })

  it('passes `title: { absolute }` — the explicit opt-out of the layout template', () => {
    write(
      'app/absolute/page.tsx',
      [
        'export const metadata = { title: { absolute: "Ryan Realty — Central Oregon" } }',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(report.violations).toEqual([])
    expect(status).toBe(0)
  })

  it('passes openGraph.title and twitter.title — social cards get no template', () => {
    write(
      'app/social/page.tsx',
      [
        'export const metadata = {',
        '  title: "Bend home sales archive",',
        '  openGraph: { title: "Bend home sales archive | Ryan Realty" },',
        '  twitter: { title: "Bend home sales archive | Ryan Realty" },',
        '}',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(report.violations).toEqual([])
    expect(status).toBe(0)
  })

  it('honours the frozen ledger: a baselined file passes, an unlisted one still fails', () => {
    write(
      'app/legacy/page.tsx',
      [
        'export const metadata = { title: "Sign documents · Ryan Realty" }',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    write(
      'scripts/title-brand-once-baseline.json',
      JSON.stringify({ note: 'frozen ledger', files: ['app/legacy/page.tsx'] }, null, 2),
    )
    expect(run().status).toBe(0)

    write(
      'app/fresh/page.tsx',
      [
        'export const metadata = { title: "Fresh page · Ryan Realty" }',
        'export default function Page() { return null }',
        '',
      ].join('\n'),
    )
    const { status, report } = run()
    expect(status).toBe(1)
    expect(report.violations.map((v) => v.file)).toEqual(['app/fresh/page.tsx'])
  })
})
