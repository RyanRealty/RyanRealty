import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatLedgerFinding,
  hasValidLedgerTrailer,
  isValidLedgerValue,
  ledgerTrailerFindings,
  rankingReasons,
} from '../lib/ledger-trailer.mjs'

// A hook run exports GIT_DIR / GIT_INDEX_FILE; strip them so the fixture's git
// commands cannot touch the real repository.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

describe('Ledger: trailer values (gsc-trend-3)', () => {
  it.each([
    ['4b0c7c1e-8d1f-4a47-9d1a-3c2b1a0f9e88', true],
    ['community · position · "tetherow homes for sale"', true],
    ['listing-detail | clicks | /listing/*', true],
    ['none (moves a test fixture, nothing a crawler reads)', true],
    ['position', false],
    ['none', false],
    ['community', false],
    ['', false],
  ])('%s -> %s', (value, ok) => {
    expect(isValidLedgerValue(value)).toBe(ok)
  })

  it('reads the trailer out of a full commit message', () => {
    expect(hasValidLedgerTrailer('fix: title\n\nbody\n\nLedger: city · clicks · /cities/bend\nNode: SITE-9\n')).toBe(true)
    expect(hasValidLedgerTrailer('fix: title\n\nNode: SITE-9\n')).toBe(false)
  })
})

describe('what counts as ranking-affecting', () => {
  it('flags crawler-facing paths', () => {
    expect(rankingReasons(['app/robots.ts'])).toEqual(['path app/robots.ts'])
    expect(rankingReasons(['middleware.ts'])).toEqual(['path middleware.ts'])
    expect(rankingReasons(['lib/slug.ts'])).toEqual(['path lib/slug.ts'])
  })

  it('flags changed lines that touch metadata, canonicals, index policy, ISR or redirects', () => {
    const diff = [
      '+export const revalidate = 900',
      '-  alternates: { canonical: url },',
      '+  robots: { index: false },',
      '+  permanentRedirect(`/cities/${slug}`)',
      '+export async function generateMetadata() {',
    ].join('\n')
    expect(rankingReasons(['app/cities/[slug]/page.tsx'], diff).sort()).toEqual(
      ['canonical', 'metadata', 'redirect', 'revalidate', 'robots'].sort(),
    )
  })

  it('ignores context lines, tests and docs', () => {
    expect(rankingReasons(['app/page.tsx'], ' export const revalidate = 900')).toEqual([])
    expect(rankingReasons(['app/page.test.tsx', 'docs/SEO.md'], '')).toEqual([])
  })
})

describe('ledgerTrailerFindings over a real git range', () => {
  let dir
  let base
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: cleanEnv })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  const commit = (file, body, message) => {
    mkdirSync(join(dir, file, '..'), { recursive: true })
    writeFileSync(join(dir, file), body)
    git('add', '.')
    git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-trailer-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@test.invalid')
    git('config', 'user.name', 'test')
    base = commit('README.md', 'x\n', 'base')
    commit('app/cities/page.tsx', 'export const revalidate = 900\n', 'perf: cache the city page longer')
    commit('app/about/page.tsx', 'export const revalidate = 60\n', 'perf: about\n\nLedger: about · clicks · /about')
    commit('docs/notes.md', 'canonical notes\n', 'docs: notes')
    commit('app/buy/copy.ts', 'export const heading = "Buy a home"\n', 'copy: buy heading')
  })

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('reports only the ranking-affecting commit that carries no trailer', () => {
    const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_BEFORE: base, GITHUB_SHA: git('rev-parse', 'HEAD') }
    const found = ledgerTrailerFindings({ env, cwd: dir })
    expect(found.map((f) => f.subject)).toEqual(['perf: cache the city page longer'])
    expect(found[0].reasons).toEqual(['revalidate'])
    expect(formatLedgerFinding(found[0])).toMatch(/no Ledger: trailer/)
  })

  it('returns [] instead of inventing a finding when git cannot answer', () => {
    expect(ledgerTrailerFindings({ env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_BEFORE: 'deadbeef', GITHUB_SHA: 'HEAD' }, cwd: dir })).toEqual([])
  })
})
