import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:search-perf-budget (scripts/check-search-perf-budget.mjs).
 *
 * A static gate is only worth its runtime if every rule can FAIL. Each case
 * below copies the files the gate inspects into a sandbox, breaks exactly one
 * rule, and asserts the gate exits non-zero naming that rule. The first test
 * proves the untouched sandbox PASSES, so a failure below is the mutation and
 * not the copy.
 *
 * The sandbox lives inside the repo so `import ts from 'typescript'` resolves
 * through node_modules, and is removed in afterAll.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = join(REPO, '.perf-budget-gate-sandbox')

const FILES = [
  'scripts/check-search-perf-budget.mjs',
  'scripts/search-perf-baseline.json',
  'scripts/perf-search-measure.mts',
  'app/search/page.tsx',
  'app/search/[...slug]/page.tsx',
  'app/search/[...slug]/fetch-guards.ts',
  'app/actions/search.ts',
  'lib/data/listings/searchListingsAll.ts',
  'lib/data/listings/searchShapes.ts',
  'lib/data/listings/searchFacets.ts',
]

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function runGate() {
  try {
    const out = execFileSync('node', [join(SANDBOX, 'scripts/check-search-perf-budget.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}

function editJson(rel, fn) {
  const p = join(SANDBOX, rel)
  const json = JSON.parse(readFileSync(p, 'utf8'))
  fn(json)
  writeFileSync(p, JSON.stringify(json, null, 2))
}

/** Break one rule, run the gate, expect a non-zero exit tagged with that rule. */
function expectCaught(rule, breakIt) {
  reset()
  breakIt()
  const result = runGate()
  expect(result.code, `gate passed despite: ${rule}\n${result.out}`).not.toBe(0)
  expect(result.out).toContain(`[${rule}]`)
}

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

// timeout: the fixture reset() copies repo files per test (~0.6-1.3s idle); under
// disk load (hook runs after builds) it can exceed the 5s default by 4-8x.
describe('ci:search-perf-budget', { timeout: 30_000 }, () => {
  it('passes on an untouched copy of the tree', () => {
    reset()
    const result = runGate()
    expect(result.out).toContain('Search perf budget')
    expect(result.code, result.out).toBe(0)
  })

  it('R0 — fails when a budget names a path the measurement script never runs', () => {
    expectCaught('R0 inputs', () =>
      editJson('scripts/search-perf-baseline.json', (b) => {
        b.budgets[0].path = 'searchListingsSomethingElse'
      }),
    )
  })

  it('R0 — fails when the baseline names a file that does not exist', () => {
    expectCaught('R0 inputs', () =>
      editJson('scripts/search-perf-baseline.json', (b) => {
        b.static.cachedReads[0].file = 'lib/data/listings/deleted.ts'
      }),
    )
  })

  it('R1 — fails when a budget is pinned at its own measured cold time', () => {
    expectCaught('R1 headroom', () =>
      editJson('scripts/search-perf-baseline.json', (b) => {
        b.budgets[1].budgetMs = b.budgets[1].measuredColdMs
      }),
    )
  })

  it('R2 — fails when a search page raises ISR revalidate', () => {
    expectCaught('R2 revalidate', () =>
      edit('app/search/page.tsx', (s) =>
        s.replace('export const revalidate = 60', 'export const revalidate = 3600'),
      ),
    )
  })

  it('R2 — fails when a search page drops its revalidate export', () => {
    expectCaught('R2 revalidate', () =>
      edit('app/search/page.tsx', (s) => s.replace('export const revalidate = 60', '')),
    )
  })

  it('R3 — fails when the primary listings fetch timeout is raised', () => {
    expectCaught('R3 timeouts', () =>
      edit('app/search/[...slug]/fetch-guards.ts', (s) =>
        s.replace('LISTINGS_FETCH_TIMEOUT_MS = 12000', 'LISTINGS_FETCH_TIMEOUT_MS = 30000'),
      ),
    )
  })

  it('R3 — fails when a withTimeout guard loses its default ceiling', () => {
    expectCaught('R3 timeouts', () =>
      edit('app/search/page.tsx', (s) => s.replace('timeoutMs = 4000', 'timeoutMs: number')),
    )
  })

  it('R4 — fails when a search read loses its cache wrapper', () => {
    expectCaught('R4 cached reads', () =>
      edit('lib/data/listings/searchFacets.ts', (s) =>
        s.replace(
          'return makeResilientCached(\n    () => fetchSearchFacetCounts(cls),',
          'return uncachedPassthrough(\n    () => fetchSearchFacetCounts(cls),',
        ),
      ),
    )
  })

  it('R4 — fails when a cached read drops its revalidate option', () => {
    expectCaught('R4 cached reads', () =>
      edit('lib/data/listings/searchListingsAll.ts', (s) =>
        s.replace(
          '    {\n      revalidate: CACHE_WINDOWS.listingTile,\n      tags: [cacheTag.listings],\n    },',
          '    {\n      tags: [cacheTag.listings],\n    },',
        ),
      ),
    )
  })

  it('R5 — fails when a row-cap constant is raised', () => {
    expectCaught('R5 row caps', () =>
      edit('lib/data/listings/searchShapes.ts', (s) =>
        s.replace('const MAX_SHAPE_KEYS = 3000', 'const MAX_SHAPE_KEYS = 50000'),
      ),
    )
  })

  it('R5 — fails when the filter schema raises its page-size ceiling', () => {
    expectCaught('R5 row caps', () =>
      edit('lib/data/listings/searchListingsAll.ts', (s) =>
        s.replace(
          'limit: z.number().int().min(1).max(1000).default(60).catch(60),',
          'limit: z.number().int().min(1).max(9999).default(60).catch(60),',
        ),
      ),
    )
  })

  it('R6 — fails when an unbounded read is added to a search DAL file', () => {
    expectCaught('R6 bounded reads', () =>
      edit(
        'lib/data/listings/searchFacets.ts',
        (s) =>
          `${s}\n\nexport async function everyFacetRowUnbounded() {\n  const supabase = supabaseAnon()\n  if (!supabase) return []\n  const { data } = await supabase.from('search_facet_counts').select('*')\n  return data ?? []\n}\n`,
      ),
    )
  })

  it('R6 — fails on a literal .limit() above the PostgREST cap', () => {
    expectCaught('R6 bounded reads', () =>
      edit('lib/data/listings/searchShapes.ts', (s) =>
        s.replace('.range(offset, offset + SHAPE_KEY_PAGE - 1)', '.limit(5000)'),
      ),
    )
  })
})
