import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:toast-discipline (scripts/check-toast-read-discipline.mjs, G62).
 *
 * A static gate is only worth its runtime if every rule can FAIL, and only
 * survives if the safe shapes DON'T. Each case below copies the real files the
 * gate inspects into a sandbox, seeds the ratchet from that copy, then either
 * introduces exactly one violation (and asserts a non-zero exit naming the
 * rule) or introduces a deliberately-safe shape (and asserts the gate stays
 * green). The first test proves the untouched sandbox PASSES, so any failure
 * below is the mutation and not the copy.
 *
 * The sandbox lives OUTSIDE the repo, with node_modules symlinked in so
 * `import ts from 'typescript'` still resolves. In-repo would be simpler, but a
 * concurrent sibling session running `git clean -fd` deletes an untracked
 * in-repo scratch dir mid-run and the failure looks like a gate bug (observed
 * while writing these tests: two cases died on ENOENT for a directory reset()
 * had just created). It is removed in afterAll.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
// Per-run path. A fixed name races when two vitest workers (or a leftover
// hook run) reset the same /tmp dir — the next run() then sees a missing
// baseline or a deleted gate script (2026-08-15 pre-commit: 8 false fails).
// pid alone is not enough: this file runs under BOTH the `unit` and `gates`
// projects, which can share a worker process, so the random suffix is what
// actually separates them.
const SANDBOX = join(tmpdir(), `rr-toast-gate-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)
const GATE = join(SANDBOX, 'scripts/check-toast-read-discipline.mjs')

/**
 * Real files, chosen so every rule has a real subject:
 *   syncWrites.ts        both helper shapes — un-narrowed (selectListingsAdmin,
 *                        selectHistorySyncCandidates) and pk-narrowed
 *                        (getListingFieldsByListingKey), plus the one live A1 site
 *   index.ts             the `export { … } from` barrel every consumer goes through
 *   sync-spark.ts        real `const { x } = await import('@/lib/data')` call sites
 *   getListingPhotos.ts  the safe shape: .select('… details …').eq('ListingKey', k)
 *   3 migrations         one flagged definition, one definition that reads no
 *                        details, one ALTER FUNCTION reference
 */
const FILES = [
  'scripts/check-toast-read-discipline.mjs',
  'tsconfig.json',
  'lib/data/sync/syncWrites.ts',
  'lib/data/index.ts',
  'lib/data/listings/getListingPhotos.ts',
  'app/actions/sync-spark.ts',
  'supabase/migrations/20260603140000_fix_golf_course_filter_populated_signals.sql',
  'supabase/migrations/20260801030000_search_advanced_view_text.sql',
  'supabase/migrations/20260603190000_search_rpc_statement_timeout.sql',
]

function run(...extra) {
  try {
    const out = execFileSync('node', [GATE, ...extra], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

/** Fresh copy of the inspected tree, with the ratchet seeded from that copy. */
function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
  symlinkSync(join(REPO, 'node_modules'), join(SANDBOX, 'node_modules'), 'dir')
  const seeded = run('--write-baseline')
  expect(seeded.code, seeded.out).toBe(0)
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}

function write(rel, contents) {
  const p = join(SANDBOX, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, contents)
}

/** Break one rule, run the gate, expect a non-zero exit tagged with that rule. */
function expectCaught(rule, breakIt) {
  reset()
  breakIt()
  const result = run()
  expect(result.code, `gate passed despite: ${rule}\n${result.out}`).not.toBe(0)
  expect(result.out).toContain(`[${rule}]`)
}

/** Introduce a SAFE shape, run the gate, expect it to stay green. */
function expectClean(what, mutate) {
  reset()
  mutate()
  const result = run()
  expect(result.code, `gate FALSE-POSITIVED on: ${what}\n${result.out}`).toBe(0)
}

/** Append a new DAL module under lib/, so the scan picks it up. */
const dalModule = (body) =>
  `import { supabaseAnon } from '@/lib/supabase/anon'\n` +
  `export async function probe(key: string) {\n` +
  `  const sb = supabaseAnon()\n` +
  `  if (!sb) return []\n` +
  `${body}\n` +
  `}\n`

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true })
})

// timeout: the fixture reset() copies repo files per test (~0.6-1.3s idle); under
// disk load (hook runs after builds) it can exceed the 5s default by 4-8x.
describe('ci:toast-discipline (G62)', { timeout: 30_000 }, () => {
  it('passes on an untouched copy of the tree', () => {
    reset()
    const result = run()
    expect(result.out).toContain('TOAST read discipline')
    expect(result.code, result.out).toBe(0)

    // Migrations are append-only, so the flagged definition in the fixture set
    // is a permanent subject: if this stops finding an A4 site the SQL scanner
    // silently stopped working.
    const json = JSON.parse(run('--json').out)
    expect(json.sites.some((s) => s.rule === 'A4 sql definition')).toBe(true)
  })

  // ── A1 broad select ───────────────────────────────────────────────────────

  it('A1 — fails on .select(\'*\') against listings with no pk narrowing', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(`  const { data } = await sb.from('listings').select('*').limit(60)\n  return data ?? []`),
      ),
    )
  })

  it('A1 — fails when the select list names details among typed columns', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey, ListPrice, details').eq('City', 'Bend')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A1 — fails on an aliased details extraction in the select list', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey, StreetSuffix:details->>StreetSuffix')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A1 — fails on a bare .select() (PostgREST defaults it to *)', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(`  const { data } = await sb.from('listings').select().limit(10)\n  return data ?? []`),
      ),
    )
  })

  it('A1 — fails when the select list is a file-local const naming details', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        `const COLS = 'ListingKey, ListNumber, details'\n` +
          dalModule(`  const { data } = await sb.from('listings').select(COLS)\n  return data ?? []`),
      ),
    )
  })

  it('A1 — fails when a select is assembled across statements (builder shape)', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  let q = sb.from('listings')\n` +
            `  const q2 = q.select('ListingKey, details')\n` +
            `  const { data } = await q2.eq('City', 'Bend')\n  return data ?? []`,
        ),
      ),
    )
  })

  // ── A1 false positives ────────────────────────────────────────────────────

  it('A1 — a single-row lookup by ListingKey is FINE and does not trip', () => {
    expectClean('.select(details).eq(ListingKey).maybeSingle()', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey, details, PhotoURL').eq('ListingKey', key).maybeSingle()\n  return data ? [data] : []`,
        ),
      ),
    )
  })

  it('A1 — a bounded .in() over ListNumber is FINE and does not trip', () => {
    expectClean('.select(*).in(ListNumber, small)', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('*').in('ListNumber', [key, key])\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A1 — .match({ ListingKey }) narrows just like .eq()', () => {
    expectClean('.select(details).match({ ListingKey })', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('details').match({ ListingKey: key })\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A1 — a head:true count read materializes no rows and does not trip', () => {
    expectClean(".select('*', { count: 'exact', head: true })", () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { count } = await sb.from('listings').select('*', { count: 'exact', head: true }).eq('City', 'Bend')\n  return [count]`,
        ),
      ),
    )
  })

  it('A1 — a details column on a DIFFERENT table is out of scope', () => {
    expectClean("admin_audit.details", () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('admin_audit').select('id, action_type, details, created_at').limit(100)\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A1 — the narrow matviews carry no details and are out of scope', () => {
    expectClean('listing_search_mv', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listing_search_mv').select('*').limit(1000)\n  return data ?? []`,
        ),
      ),
    )
  })

  // ── A2 details predicate ──────────────────────────────────────────────────

  it('A2 — fails on .filter() over a details->> expression', () => {
    expectCaught('A2 details predicate', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').filter('details->>StreetSuffix', 'eq', 'Ave')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — fails on .order() over a details->> expression', () => {
    expectCaught('A2 details predicate', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').order('details->>OriginalListPrice', { ascending: false })\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — fails on .ilike() over a details->> expression (the 335s shape)', () => {
    expectCaught('A2 details predicate', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').eq('City', 'Bend').ilike('details->>View', '%Mountain%')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — fails on an .or() clause naming details', () => {
    expectCaught('A2 details predicate', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').or('details->>View.ilike.%Lake%,details->>View.ilike.%River%')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — fails on .contains(\'details\', …)', () => {
    expectCaught('A2 details predicate', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').contains('details', { Pool: true })\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — a details predicate narrowed to one row does not trip', () => {
    expectClean('.eq(ListingKey).filter(details->>X)', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listings').select('ListingKey').eq('ListingKey', key).filter('details->>StreetSuffix', 'eq', 'Ave')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('A2 — a predicate on the typed side-table column is the FIX and does not trip', () => {
    expectClean('listing_feature_flags.view_text', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  const { data } = await sb.from('listing_feature_flags').select('list_number').ilike('view_text', '%Mountain%')\n  return data ?? []`,
        ),
      ),
    )
  })

  // ── A3 helper columns (module resolution) ─────────────────────────────────

  it('A3 — fails when a call site hands details to an un-narrowed columns helper', () => {
    expectCaught('A3 helper columns', () =>
      write(
        'lib/data/listings/probe.ts',
        `import { selectListingsAdmin } from '@/lib/data'\n` +
          `export async function probe() {\n` +
          `  return selectListingsAdmin({ columns: 'ListingKey, details', limit: 500 })\n` +
          `}\n`,
      ),
    )
  })

  it('A3 — fails when the same call site passes * instead', () => {
    expectCaught('A3 helper columns', () =>
      write(
        'lib/data/listings/probe.ts',
        `import { selectListingsAdmin } from '@/lib/data'\n` +
          `export async function probe() {\n` +
          `  return selectListingsAdmin({ columns: '*', limit: 500 })\n` +
          `}\n`,
      ),
    )
  })

  it('A3 — a RELATIVE specifier straight at the declaring file cannot dodge it', () => {
    expectCaught('A3 helper columns', () =>
      write(
        'lib/data/listings/probe.ts',
        `import { selectListingsAdmin } from '../sync/syncWrites'\n` +
          `export async function probe() {\n` +
          `  return selectListingsAdmin({ columns: 'ListingKey, details' })\n` +
          `}\n`,
      ),
    )
  })

  it('A3 — a dynamic import + namespace call cannot dodge it', () => {
    expectCaught('A3 helper columns', () =>
      write(
        'lib/data/listings/probe.ts',
        `export async function probe() {\n` +
          `  const mod = await import('@/lib/data')\n` +
          `  return mod.selectListingsAdmin({ columns: 'ListingKey, details' })\n` +
          `}\n`,
      ),
    )
  })

  it('A3 — fails when an EXISTING call site widens its columns to include details', () => {
    expectCaught('A3 helper columns', () =>
      edit('app/actions/sync-spark.ts', (s) =>
        s.replace(
          "columns: REMAINING_COLS,",
          "columns: 'ListingKey, ListNumber, details',",
        ),
      ),
    )
  })

  it('A3 — passing details to a PK-NARROWED helper is FINE and does not trip', () => {
    expectClean('getListingFieldsByListingKey(key, "details")', () =>
      write(
        'lib/data/listings/probe.ts',
        `import { getListingFieldsByListingKey } from '@/lib/data'\n` +
          `export async function probe(key: string) {\n` +
          `  return getListingFieldsByListingKey<{ details: unknown }>(key, 'ListingKey, details')\n` +
          `}\n`,
      ),
    )
  })

  it('A3 — typed columns through an un-narrowed helper are FINE', () => {
    expectClean('selectListingsAdmin typed columns', () =>
      write(
        'lib/data/listings/probe.ts',
        `import { selectListingsAdmin } from '@/lib/data'\n` +
          `export async function probe() {\n` +
          `  return selectListingsAdmin({ columns: 'ListingKey, ListNumber, ListPrice', limit: 500 })\n` +
          `}\n`,
      ),
    )
  })

  // ── A4 sql definitions ────────────────────────────────────────────────────

  it('A4 — fails on a NEW matview definition reading details', () => {
    expectCaught('A4 sql definition', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `CREATE MATERIALIZED VIEW public.listing_probe_mv AS\n` +
          `SELECT l."ListingKey", l.details->>'StreetSuffix' AS street_suffix\n` +
          `FROM public.listings l;\n`,
      ),
    )
  })

  it('A4 — fails on a NEW function whose body reads details', () => {
    expectCaught('A4 sql definition', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `CREATE OR REPLACE FUNCTION public.probe_suffix(p_key text)\n` +
          `RETURNS text LANGUAGE sql STABLE AS $$\n` +
          `  SELECT l.details->>'StreetSuffix' FROM public.listings l WHERE l."City" = p_key LIMIT 1;\n` +
          `$$;\n`,
      ),
    )
  })

  it('A4 — fails on a jsonb_ helper applied to details inside a definition', () => {
    expectCaught('A4 sql definition', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `CREATE OR REPLACE FUNCTION public.probe_photos()\n` +
          `RETURNS bigint LANGUAGE sql STABLE AS $$\n` +
          `  SELECT sum(jsonb_array_length(l.details -> 'Photos')) FROM public.listings l;\n` +
          `$$;\n`,
      ),
    )
  })

  it('A4 — a migration that only REFERENCES existing objects does not trip', () => {
    expectClean('REFRESH / GRANT / ALTER / SELECT against an existing object', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `-- Refresh the narrow matview. It reads no details-> by design.\n` +
          `REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_search_mv;\n` +
          `GRANT SELECT ON public.listing_search_mv TO anon;\n` +
          `ALTER FUNCTION public.search_listings_advanced(text) SET statement_timeout = '20s';\n` +
          `COMMENT ON MATERIALIZED VIEW public.listing_search_mv IS 'no details->> here';\n` +
          `SELECT count(*) FROM public.listing_search_mv;\n`,
      ),
    )
  })

  it('A4 — a definition whose only details mention is in a comment does not trip', () => {
    expectClean('details-> named only in SQL comments', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `-- The old body used l.details->>'View'; it now reads the side table.\n` +
          `/* details->>'PublicRemarks' was here too */\n` +
          `CREATE OR REPLACE FUNCTION public.probe_view()\n` +
          `RETURNS setof text LANGUAGE sql STABLE AS $$\n` +
          `  SELECT f.view_text FROM public.listing_feature_flags f;\n` +
          `$$;\n`,
      ),
    )
  })

  // ── pragma ────────────────────────────────────────────────────────────────

  it('pragma — `// toast-ok: <reason>` suppresses a TS site', () => {
    expectClean('// toast-ok: with a reason', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  // toast-ok: bounded to the <=25 rows the caller already resolved by key\n` +
            `  const { data } = await sb.from('listings').select('ListingKey, details')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('pragma — a bare `// toast-ok` with NO reason does NOT suppress', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  // toast-ok:\n` +
            `  const { data } = await sb.from('listings').select('ListingKey, details')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('pragma — a pragma two lines above does NOT suppress', () => {
    expectCaught('A1 broad select', () =>
      write(
        'lib/data/listings/probe.ts',
        dalModule(
          `  // toast-ok: reason lives too far away\n` +
            `  const noop = key\n` +
            `  void noop\n` +
            `  const { data } = await sb.from('listings').select('ListingKey, details')\n  return data ?? []`,
        ),
      ),
    )
  })

  it('pragma — `-- toast-ok: <reason>` suppresses a SQL definition site', () => {
    expectClean('-- toast-ok: with a reason', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `-- toast-ok: one-shot migration-time definition, dropped in the same file\n` +
          `CREATE OR REPLACE FUNCTION public.probe_suffix()\n` +
          `RETURNS text LANGUAGE sql STABLE AS $$\n` +
          `  SELECT l.details->>'StreetSuffix' FROM public.listings l LIMIT 1;\n` +
          `$$;\n`,
      ),
    )
  })

  it('pragma — a bare `-- toast-ok` with NO reason does NOT suppress', () => {
    expectCaught('A4 sql definition', () =>
      write(
        'supabase/migrations/29990101000000_probe.sql',
        `-- toast-ok\n` +
          `CREATE OR REPLACE FUNCTION public.probe_suffix()\n` +
          `RETURNS text LANGUAGE sql STABLE AS $$\n` +
          `  SELECT l.details->>'StreetSuffix' FROM public.listings l LIMIT 1;\n` +
          `$$;\n`,
      ),
    )
  })

  // ── ratchet ───────────────────────────────────────────────────────────────

  it('ratchet — deleting a baselined entry while the site remains fails', () => {
    reset()
    write(
      'lib/data/listings/probe.ts',
      dalModule(`  const { data } = await sb.from('listings').select('*')\n  return data ?? []`),
    )
    expect(run('--write-baseline').code).toBe(0)
    expect(run().code, 'baselined site should pass').toBe(0)

    const p = join(SANDBOX, 'scripts/toast-read-baseline.json')
    const json = JSON.parse(readFileSync(p, 'utf8'))
    delete json.sites['A1 broad select']['lib/data/listings/probe.ts']
    writeFileSync(p, JSON.stringify(json, null, 2))

    const result = run()
    expect(result.code, result.out).not.toBe(0)
    expect(result.out).toContain('[A1 broad select]')
  })

  it('ratchet — counts are per (rule, file, expression): a SECOND copy fails', () => {
    reset()
    write(
      'lib/data/listings/probe.ts',
      dalModule(`  const { data } = await sb.from('listings').select('*')\n  return data ?? []`),
    )
    expect(run('--write-baseline').code).toBe(0)
    expect(run().code, 'one baselined site should pass').toBe(0)

    edit('lib/data/listings/probe.ts', (s) =>
      `${s}\nexport async function probe2() {\n  const sb = supabaseAnon()\n  if (!sb) return []\n  const { data } = await sb.from('listings').select('*')\n  return data ?? []\n}\n`,
    )
    const result = run()
    expect(result.code, result.out).not.toBe(0)
    expect(result.out).toContain('[A1 broad select]')
  })

  it('ratchet — swapping one violation for a DIFFERENT one in the same file fails', () => {
    reset()
    write(
      'lib/data/listings/probe.ts',
      dalModule(`  const { data } = await sb.from('listings').select('*')\n  return data ?? []`),
    )
    expect(run('--write-baseline').code).toBe(0)

    // Same file, same rule, same count — a pure count baseline would miss this.
    write(
      'lib/data/listings/probe.ts',
      dalModule(
        `  const { data } = await sb.from('listings').select('ListingKey, details')\n  return data ?? []`,
      ),
    )
    const result = run()
    expect(result.code, result.out).not.toBe(0)
    expect(result.out).toContain('[A1 broad select]')
  })

  it('ratchet — a removed site passes and is reported as ratchetable', () => {
    reset()
    write(
      'lib/data/listings/probe.ts',
      dalModule(`  const { data } = await sb.from('listings').select('*')\n  return data ?? []`),
    )
    expect(run('--write-baseline').code).toBe(0)
    rmSync(join(SANDBOX, 'lib/data/listings/probe.ts'), { force: true })

    const result = run()
    expect(result.code, result.out).toBe(0)
    expect(result.out).toContain('are GONE')
  })

  it('ratchet — a missing baseline file fails loudly', () => {
    reset()
    rmSync(join(SANDBOX, 'scripts/toast-read-baseline.json'))
    const result = run()
    expect(result.code, result.out).not.toBe(0)
    expect(result.out).toContain('[A0 baseline]')
  })

  it('ratchet — an unparseable baseline file fails loudly', () => {
    reset()
    writeFileSync(join(SANDBOX, 'scripts/toast-read-baseline.json'), '{ not json')
    const result = run()
    expect(result.code, result.out).not.toBe(0)
    expect(result.out).toContain('[A0 baseline]')
  })

  it('--report never exits non-zero even with a new violation', () => {
    reset()
    write(
      'lib/data/listings/probe.ts',
      dalModule(`  const { data } = await sb.from('listings').select('*')\n  return data ?? []`),
    )
    expect(run().code).not.toBe(0)
    expect(run('--report').code).toBe(0)
  })
})
