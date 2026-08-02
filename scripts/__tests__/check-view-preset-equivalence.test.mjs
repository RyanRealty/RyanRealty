import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:view-preset-equivalence (scripts/check-view-preset-equivalence.mjs, G63).
 *
 * This gate asserts a claim about LIVE data, so its rules are broken by
 * mutating the module the gate reads — lib/search-presets.ts — inside a sandbox
 * and checking the gate turns red against the real database. That is the honest
 * proof: the whole point of the gate is that a map which looks fine in the
 * source is wrong against the feed.
 *
 * The row snapshot is fetched ONCE (RR_VIEW_PRESET_ROW_CACHE) and replayed, so
 * a dozen cases cost one ~10 s read instead of a dozen.
 *
 * Requires Supabase credentials. Without them the gate itself SKIPs (that is
 * asserted below), and these cases skip too — CI runs the unit suite secret-less.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(tmpdir(), 'rr-view-preset-gate-sandbox')
const GATE = join(SANDBOX, 'scripts/check-view-preset-equivalence.mjs')
const ROW_CACHE = join(SANDBOX, 'rows.json')

const FILES = [
  'scripts/check-view-preset-equivalence.mjs',
  'tsconfig.json',
  'lib/search-presets.ts',
  'lib/listing-status-public.ts',
  'lib/data/types/listing.ts',
]

function repoEnvLocal() {
  const p = join(REPO, '.env.local')
  if (!existsSync(p)) return {}
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
}
const fileEnv = repoEnvLocal()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY
const HAS_CREDS = Boolean(SUPABASE_URL && SUPABASE_KEY)

function run({ creds = true, cache = true, args = [] } = {}) {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_SUPABASE_URL
  delete env.SUPABASE_SERVICE_ROLE_KEY
  delete env.RR_VIEW_PRESET_ROW_CACHE
  if (creds) {
    env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
  }
  if (cache) env.RR_VIEW_PRESET_ROW_CACHE = ROW_CACHE
  try {
    const out = execFileSync('node', [GATE, ...args], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

/** Fresh copy of the module tree the gate reads. The row cache is preserved. */
function reset() {
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
  if (!existsSync(join(SANDBOX, 'node_modules')))
    symlinkSync(join(REPO, 'node_modules'), join(SANDBOX, 'node_modules'), 'dir')
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  const before = readFileSync(p, 'utf8')
  const after = fn(before)
  expect(after, `mutation for ${rel} matched nothing — the source moved`).not.toBe(before)
  writeFileSync(p, after)
}

function expectCaught(rule, breakIt) {
  reset()
  breakIt()
  const result = run()
  expect(result.code, `gate passed despite: ${rule}\n${result.out}`).not.toBe(0)
  expect(result.out).toContain(`[${rule}]`)
}

let liveValues = []
let terms = []

beforeAll(() => {
  if (!HAS_CREDS) return
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  reset()
  // One live read; every case below replays it.
  const seed = run({ args: ['--json'] })
  expect(seed.code, seed.out).toBe(0)
  const json = JSON.parse(seed.out.slice(seed.out.indexOf('{')))
  liveValues = json.liveValues
  terms = json.terms
}, 180_000)

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

describe.skipIf(!HAS_CREDS)('ci:view-preset-equivalence (G63)', () => {
  it('passes on an untouched copy, over a real on-market row set', () => {
    reset()
    const result = run()
    expect(result.out).toContain('View-preset equivalence')
    expect(result.code, result.out).toBe(0)
    // The proof must not be vacuous: real vocabulary, real terms, real matches.
    expect(liveValues.length).toBeGreaterThan(10)
    expect(terms.length).toBeGreaterThanOrEqual(5)
    expect(terms.some((t) => (t.textMatches ?? 0) > 0)).toBe(true)
  })

  it('B0 — fails when a preset term resolves to nothing (the legacy-RPC fallback)', () => {
    expectCaught('B0 inputs', () =>
      edit('lib/search-presets.ts', (s) =>
        s.replace(
          '  return matched.size > 0 ? [...matched] : null',
          '  return matched.size > 0 && false ? [...matched] : null',
        ),
      ),
    )
  })

  it('B0 — fails when the resolver export disappears', () => {
    expectCaught('B0 inputs', () =>
      edit('lib/search-presets.ts', (s) =>
        s.replace(
          'export function resolveViewContainsValues(',
          'function resolveViewContainsValuesRenamed(',
        ),
      ),
    )
  })

  it('B1 — fails when the feed carries a view_types value the vocabulary lacks', () => {
    // Simulate the "Butte" case by dropping a value that IS live but that no
    // preset term substring-matches, so B1 fires in isolation.
    const needles = terms.map((t) => t.needle)
    const victim = liveValues.find(
      (v) => !needles.some((n) => String(v).toLowerCase().includes(n)),
    )
    expect(victim, `no live view_types value is independent of every preset term`).toBeTruthy()
    expectCaught('B1 vocabulary', () =>
      edit('lib/search-presets.ts', (s) => s.replace(`'${victim}',`, `'${victim} Renamed',`)),
    )
  })

  it('B2 — fails when the resolver under-returns (drops a covering value)', () => {
    // Truncate every resolution to one value. Any term resolving to 2+ live
    // values then loses rows that view_text still matches — a live SEO page
    // quietly serving fewer homes, which is the whole regression.
    expectCaught('B2 under-return', () =>
      edit('lib/search-presets.ts', (s) =>
        s.replace(
          '  return matched.size > 0 ? [...matched] : null',
          '  return matched.size > 0 ? [[...matched][0]] : null',
        ),
      ),
    )
  })

  it('B3 — fails on an UNDECLARED widening of a literal term', () => {
    expectCaught('B3 widening', () =>
      edit('lib/search-presets.ts', (s) =>
        s.replace(
          "  water: ['Lake', 'River', 'Pond', 'Creek/Stream', 'Ocean', 'Bay', 'Beach'],",
          "  water: ['Lake', 'River', 'Pond', 'Creek/Stream', 'Ocean', 'Bay', 'Beach'],\n  golf: ['Golf Course', 'Territorial'],",
        ),
      ),
    )
  })

  it('B3 — fails when a DECLARED intent term stops widening (stale ledger)', () => {
    expectCaught('B3 widening', () =>
      edit('lib/search-presets.ts', (s) =>
        s
          .replace("  'Orchard', 'Ocean', 'Beach', 'Bay',", "  'Orchard', 'Ocean', 'Beach', 'Bay', 'Water Feature',")
          .replace(
            "  water: ['Lake', 'River', 'Pond', 'Creek/Stream', 'Ocean', 'Bay', 'Beach'],",
            '',
          ),
      ),
    )
  })

  it('B4 — fails when side-table coverage falls below the floor', () => {
    expectCaught('B4 coverage', () =>
      edit('scripts/check-view-preset-equivalence.mjs', (s) =>
        s.replace('const MIN_FLAG_COVERAGE = 0.95', 'const MIN_FLAG_COVERAGE = 1.01'),
      ),
    )
  })

  it('B4 — fails when the on-market row set is empty (a vacuous proof)', () => {
    reset()
    const saved = readFileSync(ROW_CACHE, 'utf8')
    try {
      writeFileSync(ROW_CACHE, '[]')
      const result = run()
      expect(result.code, result.out).not.toBe(0)
      expect(result.out).toContain('[B4 coverage]')
    } finally {
      writeFileSync(ROW_CACHE, saved)
    }
  })

  it('SKIPS cleanly with no credentials instead of failing the build', () => {
    reset()
    const result = run({ creds: false, cache: false })
    expect(result.code, result.out).toBe(0)
    expect(result.out).toContain('SKIPPED')
  })

  it('--report never exits non-zero even with a broken map', () => {
    reset()
    edit('lib/search-presets.ts', (s) =>
      s.replace(
        '  return matched.size > 0 ? [...matched] : null',
        '  return matched.size > 0 ? [[...matched][0]] : null',
      ),
    )
    expect(run().code).not.toBe(0)
    expect(run({ args: ['--report'] }).code).toBe(0)
  })
})
