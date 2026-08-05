#!/usr/bin/env node
/**
 * check-view-preset-equivalence.mjs — `npm run ci:view-preset-equivalence` (G63).
 *
 * THE CLASS: a hand-maintained term→values map silently under-returning when
 * the upstream vocabulary grows.
 *
 * Five view presets (/search/mountain-view, water-view, river-view,
 * golf-course-view, lake-view) ship `viewContains: '<term>'`. That param used
 * to mean ONE thing — `listing_feature_flags.view_text ILIKE '%term%'`, which
 * only `search_listings_advanced` can evaluate, and with no city to narrow the
 * candidate set that RPC has no servable plan. All five pages timed out and
 * rendered "No homes match this search right now": live, indexable, and
 * permanently empty. The fix (db537784) routes the term onto
 * `listing_search_mv.view_types text[]` through `resolveViewContainsValues()`
 * in lib/search-presets.ts, and the equivalence was proven against live data.
 *
 * WHY THAT PROOF ROTS: `resolveViewContainsValues` matches the term against a
 * HARD-CODED vocabulary of 22 `view_types` values. The MLS feed owns that
 * vocabulary, not us. The day it emits a value the list does not carry — a new
 * "… Mountains" spelling, a "Butte", a new body of water — the resolver returns
 * a set that no longer covers it. `view_text ILIKE '%Mountain%'` still matches
 * those rows; `view_types && <resolved>` does not. The page quietly serves
 * fewer homes than exist, with no error, no red build, and no timeout. Unit
 * tests over hard-coded values cannot see it: they assert the map against
 * itself.
 *
 * So the assertion has to run against the DATA.
 *
 * ── FIVE RULES, each able to fail on its own ────────────────────────────────
 *
 *   B0 inputs      lib/search-presets.ts loads and exports what this gate
 *                  reads; at least one preset carries `viewContains`; every
 *                  such term resolves to a non-empty value set. A term that
 *                  resolves to null falls back to the legacy RPC — the exact
 *                  no-servable-plan path that emptied the five pages.
 *
 *   B1 vocabulary  Every DISTINCT `view_types` value present on the live
 *                  on-market set exists in the resolver's vocabulary. This is
 *                  the ROOT-CAUSE rule and the early warning: a brand-new
 *                  "Butte" fails here before any page loses a listing.
 *
 *   B2 under-return
 *                  Per preset term, over the same rows: ZERO listings where
 *                  `view_text ILIKE '%term%'` is true but
 *                  `view_types && <resolved>` is false. One such row is one
 *                  home the live SEO page stopped showing. This is the
 *                  regression the fix was made to prevent, asserted directly.
 *
 *   B3 widening    The reverse direction, for terms that are NOT declared
 *                  intent maps: ZERO listings matched by the array test but
 *                  not the text test. A literal term must be EXACTLY the old
 *                  predicate, not quietly broader. Widening is legal only for
 *                  a term declared in DECLARED_INTENT_TERMS below with a
 *                  written reason — currently 'water' alone, because the MLS
 *                  View field never spells "Water" (it names the body of
 *                  water) and the map is a deliberate, measured correction.
 *                  A DECLARED term that has stopped widening is also flagged,
 *                  so the ledger cannot go stale in either direction.
 *
 *   B4 coverage    The comparison is not vacuous: the on-market set is
 *                  non-empty, ≥ 95% of it has a `listing_feature_flags` row to
 *                  compare against, and every term matched a non-zero number
 *                  of rows on at least one side. A gate that proves equality
 *                  over zero rows proves nothing.
 *
 * ── WHY IT IS NOT IN ci:gates ───────────────────────────────────────────────
 * It reads live Supabase. `ci:gates` runs secret-less and offline, so this
 * lives where the other DB-dependent gates do (G16 ci:data-access, G57
 * ci:market-city-mls-canon): nightly in .github/workflows/quality.yml, and
 * locally via `npm run ci:view-preset-equivalence`. With no credentials it
 * SKIPS (exit 0) rather than failing — a credless run must never be a red build.
 *
 * Reads only through PostgREST (paged selects). No raw SQL, no
 * information_schema. `view_types` comes from listing_search_mv and `view_text`
 * from listing_feature_flags, joined by list_number in this process, so both
 * sides of every comparison are the SAME listing.
 *
 * Usage:
 *   node scripts/check-view-preset-equivalence.mjs            # exit 1 on failure
 *   node scripts/check-view-preset-equivalence.mjs --report   # same output, exit 0
 *   node scripts/check-view-preset-equivalence.mjs --json     # machine-readable
 *
 * Env: RR_VIEW_PRESET_ROW_CACHE=<path> reuses a previously-fetched row snapshot
 * instead of re-reading ~9.6k rows (writes it on first run). It caches DATA
 * only — every rule still evaluates in full. Used by the break-tests so nine
 * gate runs cost one fetch; deliberately NOT set in quality.yml, and the run
 * prints a loud banner whenever it is active.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const PRESETS_MODULE = 'lib/search-presets.ts'
const STATUS_MODULE = 'lib/listing-status-public.ts'

const REPORT = process.argv.includes('--report')
const JSON_OUT = process.argv.includes('--json')

/**
 * Terms allowed to resolve BEYOND their literal substring match, each with the
 * reason. The map in lib/search-presets.ts is the implementation; this is the
 * reviewed ledger the gate holds it to. Adding a widening to the module without
 * adding it here fails B3 — which is the point: a silent widening is the same
 * class of defect as a silent narrowing, just in the other direction.
 */
const DECLARED_INTENT_TERMS = {
  water:
    'No active listing\'s MLS View contains the string "Water" — the feed names the body of water (Lake / River / Pond / Creek-Stream / Ocean / Bay / Beach). Measured correction 0 → 332 rows on 2026-07-31. Waterfront is deliberately NOT included: owning frontage is a different claim from a view of water.',
}

/** ≥ 95% of the on-market set must carry a side-table row, or the proof is thin. */
const MIN_FLAG_COVERAGE = 0.95

// ── credentials ─────────────────────────────────────────────────────────────

function readEnvLocal() {
  // Rooted at the repo (not process.cwd()) so a sandboxed copy of this script
  // cannot accidentally inherit the real repo's credentials.
  const p = join(ROOT, '.env.local')
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
const fileEnv = readEnvLocal()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log(
    'ci:view-preset-equivalence: SKIPPED (no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
  )
  console.log(
    '  This gate reads live Supabase — it runs nightly in quality.yml, or locally with .env.local.',
  )
  process.exit(0)
}

// ── load the pure, import-free modules via esbuild ──────────────────────────

async function loadModule(relPath) {
  const src = join(ROOT, relPath)
  if (!existsSync(src)) throw new Error(`${relPath} not found — re-point this gate.`)
  const dir = mkdtempSync(join(tmpdir(), 'rr-viewpreset-'))
  const out = join(dir, 'm.mjs')
  try {
    execFileSync(
      join(ROOT, 'node_modules/.bin/esbuild'),
      [
        src,
        '--bundle',
        '--format=esm',
        '--platform=node',
        `--tsconfig=${join(ROOT, 'tsconfig.json')}`,
        `--outfile=${out}`,
        '--log-level=error',
      ],
      { stdio: 'pipe' },
    )
    return await import(pathToFileURL(out).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── PostgREST ───────────────────────────────────────────────────────────────

const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * PostgREST occasionally answers 503 PGRST002 ("Could not query the database
 * for the schema cache. Retrying.") right after a deploy or a matview swap. A
 * nightly gate that goes red on that gets muted, so 5xx is retried with backoff
 * and only a persistent failure is reported.
 */
async function getRows(path, attempt = 0) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200)
    if (res.status >= 500 && attempt < 4) {
      await sleep(1500 * (attempt + 1))
      return getRows(path, attempt + 1)
    }
    throw new Error(`PostgREST ${res.status} for ${path}: ${body}`)
  }
  return await res.json()
}

const PAGE = 1000

/**
 * The on-market MV rows, each paired with its `view_text` from the
 * trigger-maintained side table so both halves of every comparison come from
 * the SAME listing.
 *
 * Two steps rather than a PostgREST embedded resource: a materialized view
 * carries no foreign key, so any embed depends on relationship inference that
 * can silently stop working — and it measured ~2x slower besides.
 *
 * NOT a details read (G62): `view_types` lives on the narrow matview and
 * `view_text` on listing_feature_flags. Neither touches the TOASTed jsonb.
 */
async function fetchOnMarketRows(statuses) {
  const statusFilter = `standard_status=in.(${statuses
    .map((s) => (s.includes(' ') ? `"${s}"` : s))
    .map(encodeURIComponent)
    .join(',')})`

  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await getRows(
      `listing_search_mv?select=list_number,view_types&${statusFilter}` +
        `&order=list_number.asc&offset=${offset}&limit=${PAGE}`,
    )
    rows.push(...page)
    if (page.length < PAGE) break
    if (offset > 200_000) throw new Error('runaway pagination over listing_search_mv')
  }

  // view_text for exactly those list_numbers, chunked well under the PostgREST
  // 1,000-row response cap (G48) so no chunk can be silently truncated.
  const CHUNK = 400
  const keys = rows.map((r) => r.list_number).filter(Boolean)
  const viewText = new Map()
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK)
    const flagRows = await getRows(
      `listing_feature_flags?select=list_number,view_text&list_number=in.(${chunk
        .map((k) => encodeURIComponent(`"${k}"`))
        .join(',')})&limit=${PAGE}`,
    )
    if (flagRows.length >= PAGE) throw new Error('listing_feature_flags chunk hit the row cap')
    for (const f of flagRows) viewText.set(f.list_number, f.view_text ?? null)
  }

  return rows.map((r) => ({
    list_number: r.list_number,
    view_types: r.view_types,
    hasFlagRow: viewText.has(r.list_number),
    view_text: viewText.get(r.list_number) ?? null,
  }))
}

/**
 * Row snapshot, optionally served from / written to RR_VIEW_PRESET_ROW_CACHE.
 * A DATA cache only — no rule is skipped, and the banner makes an accidental
 * cached CI run obvious in the log.
 */
const ROW_CACHE = process.env.RR_VIEW_PRESET_ROW_CACHE?.trim() || null

/**
 * Re-verify candidate mismatch rows against the SOURCE OF TRUTH before
 * failing. listing_search_mv refreshes on a cadence, so a listing that
 * changes status mid-run can leave an internally inconsistent MV row —
 * status still on-market, view columns already wiped — that reads as a
 * phantom equivalence break (live false positive 2026-08-05: 220215734
 * canceled 28 seconds before the MV refresh; the MV kept
 * standard_status='Active' with view_types NULL while
 * listing_feature_flags still carried the Mountain view_text). A row that
 * is no longer on-market in public.listings is outside the equivalence
 * claim, whatever the stale MV row says. This filters ONLY rows the source
 * of truth disowns; every genuinely on-market mismatch still fails the
 * gate.
 */
async function confirmOnMarket(listNumbers, statuses) {
  if (listNumbers.length === 0) return []
  const statusList = statuses
    .map((s) => (s.includes(' ') ? `"${s}"` : s))
    .map(encodeURIComponent)
    .join(',')
  const keep = new Set()
  for (let i = 0; i < listNumbers.length; i += 100) {
    const chunk = listNumbers.slice(i, i + 100)
    const rows = await getRows(
      `listings?select=ListNumber,StandardStatus&ListNumber=in.(${chunk
        .map(encodeURIComponent)
        .join(',')})&StandardStatus=in.(${statusList})`,
    )
    for (const r of rows) keep.add(String(r.ListNumber))
  }
  return listNumbers.filter((n) => keep.has(String(n)))
}

async function loadRows(statuses) {
  if (ROW_CACHE && existsSync(ROW_CACHE)) {
    console.log(`  ⚠ USING CACHED ROWS (RR_VIEW_PRESET_ROW_CACHE=${ROW_CACHE}) — not a live read.`)
    return JSON.parse(readFileSync(ROW_CACHE, 'utf8'))
  }
  const rows = await fetchOnMarketRows(statuses)
  if (ROW_CACHE) writeFileSync(ROW_CACHE, JSON.stringify(rows))
  return rows
}

// ── main ────────────────────────────────────────────────────────────────────

const problems = []
const fail = (rule, message) => problems.push({ rule, message })

async function main() {
  const presets = await loadModule(PRESETS_MODULE)
  const statusMod = await loadModule(STATUS_MODULE)

  const resolveViewContainsValues = presets.resolveViewContainsValues
  const SEARCH_PRESETS = presets.SEARCH_PRESETS
  const VOCABULARY = presets.__VIEW_TYPE_VOCABULARY_FOR_TESTS
  const STATUSES = statusMod.PUBLIC_ON_MARKET_STATUSES

  // ── B0 inputs ──
  if (typeof resolveViewContainsValues !== 'function')
    fail('B0 inputs', `${PRESETS_MODULE} no longer exports resolveViewContainsValues()`)
  if (!Array.isArray(SEARCH_PRESETS))
    fail('B0 inputs', `${PRESETS_MODULE} no longer exports SEARCH_PRESETS`)
  if (!Array.isArray(VOCABULARY) || VOCABULARY.length === 0)
    fail('B0 inputs', `${PRESETS_MODULE} no longer exports __VIEW_TYPE_VOCABULARY_FOR_TESTS`)
  if (!Array.isArray(STATUSES) || STATUSES.length === 0)
    fail('B0 inputs', `${STATUS_MODULE} no longer exports PUBLIC_ON_MARKET_STATUSES`)
  if (problems.length) return { problems, terms: [], liveValues: [], coverage: null }

  const terms = []
  const seen = new Set()
  for (const preset of SEARCH_PRESETS) {
    const term = preset?.params?.viewContains
    if (typeof term !== 'string' || !term.trim()) continue
    const needle = term.trim().toLowerCase()
    if (seen.has(needle)) continue
    seen.add(needle)
    const resolved = resolveViewContainsValues(term)
    if (!Array.isArray(resolved) || resolved.length === 0) {
      fail(
        'B0 inputs',
        `preset "${preset.slug}" ships viewContains: '${term}', which resolves to NOTHING. A null resolution keeps the search on the legacy search_listings_advanced RPC, which has no servable plan without a city — that is exactly how /search/${preset.slug} rendered "No homes match this search right now" while inventory existed.`,
      )
      continue
    }
    // Substring resolution against the vocabulary — the literal, pre-map meaning
    // of `viewContains`. Anything the module resolves BEYOND this is widening.
    const literal = VOCABULARY.filter((v) => String(v).toLowerCase().includes(needle))
    const widened = resolved.filter((v) => !literal.includes(v))
    terms.push({
      slug: preset.slug,
      term,
      needle,
      resolved: [...resolved],
      literal,
      widened,
      declaredIntent: Object.prototype.hasOwnProperty.call(DECLARED_INTENT_TERMS, needle),
    })
  }
  if (terms.length === 0)
    fail('B0 inputs', 'no SEARCH_PRESETS entry carries a viewContains param — this gate has no subject')
  if (problems.length) return { problems, terms, liveValues: [], coverage: null }

  // A declared intent term that no longer widens is a stale ledger entry.
  for (const needle of Object.keys(DECLARED_INTENT_TERMS)) {
    const entry = terms.find((t) => t.needle === needle)
    if (entry && entry.widened.length === 0) {
      fail(
        'B3 widening',
        `'${needle}' is declared in DECLARED_INTENT_TERMS but no longer resolves beyond its literal substring match. The intent map was removed or the vocabulary absorbed it — delete the declaration so the ledger stays honest.`,
      )
    }
  }

  // ── live data ──
  const rows = await loadRows(STATUSES)
  const withFlags = rows.filter((r) => r.hasFlagRow)
  const coverage = {
    onMarket: rows.length,
    withFlags: withFlags.length,
    ratio: rows.length ? withFlags.length / rows.length : 0,
    statuses: STATUSES,
  }

  // ── B4 coverage ──
  if (rows.length === 0)
    fail(
      'B4 coverage',
      `listing_search_mv returned ZERO rows for standard_status in (${STATUSES.join(', ')}). Either the matview is empty/stale or the status vocabulary moved — an equivalence proven over zero rows proves nothing.`,
    )
  else if (coverage.ratio < MIN_FLAG_COVERAGE)
    fail(
      'B4 coverage',
      `only ${withFlags.length}/${rows.length} (${(coverage.ratio * 100).toFixed(1)}%) on-market rows have a listing_feature_flags row to compare against, below the ${(MIN_FLAG_COVERAGE * 100).toFixed(0)}% floor. The side-table backfill has regressed; the per-term comparison below covers only the rows that have one.`,
    )

  // ── B1 vocabulary ──
  const liveValues = new Set()
  for (const row of rows) for (const v of row.view_types ?? []) if (v) liveValues.add(v)
  const vocabSet = new Set(VOCABULARY)
  const unknown = [...liveValues].filter((v) => !vocabSet.has(v)).sort()
  if (unknown.length)
    fail(
      'B1 vocabulary',
      `the live feed carries ${unknown.length} view_types value(s) the resolver's vocabulary does not know: ${unknown
        .map((v) => `"${v}"`)
        .join(', ')}. resolveViewContainsValues() matches the term against that hard-coded list, so every listing whose ONLY view is one of these is invisible to any preset the value would have matched. Add them to VIEW_TYPE_VOCABULARY in ${PRESETS_MODULE} (and to VIEW_CONTAINS_INTENT_VALUES if the term is an intent map, e.g. a new body of water under 'water').`,
    )

  // ── B2 / B3 per-term equivalence over the SAME rows ──
  for (const t of terms) {
    const resolvedSet = new Set(t.resolved)
    let textN = 0
    let arrN = 0
    const textOnly = []
    const arrOnly = []
    for (const row of withFlags) {
      const text = String(row.view_text ?? '').toLowerCase().includes(t.needle)
      const arr = (row.view_types ?? []).some((v) => resolvedSet.has(v))
      if (text) textN++
      if (arr) arrN++
      if (text && !arr) textOnly.push(row.list_number)
      else if (arr && !text) arrOnly.push(row.list_number)
    }
    // Mid-run status flips leave phantom mismatches — keep only rows the
    // source of truth still calls on-market before failing anything.
    const confirmedTextOnly = textOnly.length ? await confirmOnMarket(textOnly, STATUSES) : []
    const confirmedArrOnly = arrOnly.length ? await confirmOnMarket(arrOnly, STATUSES) : []
    t.textMatches = textN
    t.arrayMatches = arrN
    t.textOnly = confirmedTextOnly.length
    t.arrayOnly = confirmedArrOnly.length
    t.textOnlySamples = confirmedTextOnly.slice(0, 5)
    t.arrayOnlySamples = confirmedArrOnly.slice(0, 5)

    if (confirmedTextOnly.length)
      fail(
        'B2 under-return',
        `viewContains '${t.term}' (/search/${t.slug}) UNDER-RETURNS: ${confirmedTextOnly.length} on-market listing(s) match the legacy predicate view_text ILIKE '%${t.term}%' but NOT view_types && {${t.resolved.join(', ')}}. Those homes have silently dropped off a live, indexable page. Examples (list_number): ${t.textOnlySamples.join(', ')}. Fix the vocabulary/map in ${PRESETS_MODULE}, do not relax this gate.`,
      )

    if (confirmedArrOnly.length && !t.declaredIntent)
      fail(
        'B3 widening',
        `viewContains '${t.term}' (/search/${t.slug}) resolves BROADER than its literal meaning: ${confirmedArrOnly.length} on-market listing(s) match view_types && {${t.resolved.join(', ')}} but NOT view_text ILIKE '%${t.term}%'. A literal term must be exactly the old predicate. Examples (list_number): ${t.arrayOnlySamples.join(', ')}. If this widening is deliberate, declare '${t.needle}' in DECLARED_INTENT_TERMS with the measured reason.`,
      )

    if (t.widened.length && !t.declaredIntent)
      fail(
        'B3 widening',
        `viewContains '${t.term}' resolves to value(s) that are not substring matches of the term — ${t.widened
          .map((v) => `"${v}"`)
          .join(', ')} — but '${t.needle}' is not declared in DECLARED_INTENT_TERMS. Declare it with the measured reason, or remove the mapping.`,
      )

    // ── B4 coverage, per term ──
    if (textN === 0 && arrN === 0)
      fail(
        'B4 coverage',
        `viewContains '${t.term}' (/search/${t.slug}) matched ZERO on-market listings on BOTH sides. The page is live, indexable, and empty — the exact state the view-preset fix was made to end. Either the term is dead vocabulary (retire the preset) or the resolution broke.`,
      )
  }

  return { problems, terms, liveValues: [...liveValues].sort(), coverage }
}

let result
try {
  result = await main()
} catch (error) {
  console.error(`ci:view-preset-equivalence: ERROR — ${String(error.message || error).slice(0, 400)}`)
  process.exit(REPORT ? 0 : 1)
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(REPORT ? 0 : result.problems.length ? 1 : 0)
}

console.log('View-preset equivalence (ci:view-preset-equivalence, G63)')
console.log('========================================================')
if (result.coverage) {
  console.log(
    `  on-market rows ${result.coverage.onMarket} (${result.coverage.statuses.join(' / ')}) · ` +
      `side-table coverage ${result.coverage.withFlags}/${result.coverage.onMarket} ` +
      `(${(result.coverage.ratio * 100).toFixed(1)}%) · ${result.liveValues.length} distinct view_types values`,
  )
  console.log('')
  console.log('  term        text ILIKE   view_types &&   text-only   array-only   note')
  for (const t of result.terms) {
    const note = t.declaredIntent ? 'declared intent map' : 'literal'
    const mark = t.textOnly === 0 && (t.arrayOnly === 0 || t.declaredIntent) ? '✓' : '✗'
    console.log(
      `  ${mark} ${String(t.term).padEnd(10)}${String(t.textMatches ?? 0).padStart(9)}` +
        `${String(t.arrayMatches ?? 0).padStart(16)}${String(t.textOnly ?? 0).padStart(12)}` +
        `${String(t.arrayOnly ?? 0).padStart(13)}   ${note}`,
    )
  }
}

if (result.problems.length) {
  console.error('')
  for (const p of result.problems) {
    console.error(`  ✗ [${p.rule}] ${p.message}`)
    console.error('')
  }
  console.error(`\x1b[31m✗ ci:view-preset-equivalence: ${result.problems.length} problem(s).\x1b[0m`)
  process.exit(REPORT ? 0 : 1)
}

console.log(
  '\n✓ Every viewContains term is exactly its legacy view_text predicate (or a declared intent map), and the live vocabulary is fully covered.',
)
process.exit(0)
