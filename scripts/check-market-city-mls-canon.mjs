#!/usr/bin/env node
/**
 * check-market-city-mls-canon.mjs — ci:market-city-mls-canon (G57).
 *
 * §0 DATA ACCURACY, the registry-SPELLING half of the market-city canon.
 *
 * ci:market-city-slug-canon (G-slug) already proves the stats cron writes the
 * canonical lower("City") SPACE form ("la pine", not "la-pine"). That guards the
 * SLUG SHAPE. This gate guards the OTHER half: that the city NAME itself is a
 * real MLS `listings."City"` value.
 *
 * public.compute_and_cache_period_stats resolves a city by
 * `lower("City") = lower(p_geo_slug)` (migration 20260425090000). So a city-tier
 * registry NAME that lower()-matches NO `listings."City"` row produces a
 * permanently-empty cache stub and a permanently-empty /cities page — a latent §0
 * hole that only becomes a visibly-wrong number if that City string ever appears.
 *
 * The hole this gate was born from (verified live 2026-07-24): the registry
 * carried "Crooked River Ranch" and "Tumalo", which match ZERO `listings."City"`
 * rows. Crooked River Ranch's live inventory files under City="Terrebonne"
 * (SubdivisionName ~ 'Crr%'); Tumalo's under City="Bend" (SubdivisionName ~
 * 'Tumalo%'). Neither is a distinct MLS city. An in-file comment falsely called
 * every name "verified against the live table". This gate makes that class of
 * claim mechanically true or the build fails.
 *
 * WHAT IT ASSERTS, for every name in REPORT_CITIES / MARKET_REPORT_DEFAULT_CITIES
 * / PRIMARY_CITIES (lib/data/geo/report-cities.ts):
 *   1. A NON-exempt name must lower()-match >= 1 `listings."City"` row.
 *      (fail = "no MLS City — add live City data, or exempt it")
 *   2. An EXEMPT name (in NON_MLS_CITY_EXEMPTIONS) must lower()-match 0 rows.
 *      (fail = "stale exemption — <name> is a real MLS City now; un-exempt it")
 *   3. Each exemption's documented data home — City=<mlsCity> AND
 *      SubdivisionName ILIKE <subdivisionMatch> — must have >= 1 row, so the
 *      map's "the real listings live here" claim stays true.
 *
 * DB-dependent (like G16 ci:data-access): reads live Supabase, so it runs
 * off the secret-less static ci:gates chain — nightly in quality.yml, or
 * locally via `npm run ci:market-city-mls-canon`. No creds → SKIP (exit 0),
 * matching the ci:resend-webhook off-chain convention.
 *
 * Flags: (default) check, exit 1 on fail · --report human, always exit 0 ·
 *        --json machine-readable.
 *
 * Exit: 0 = every city-tier name is a real MLS City or a documented exemption.
 *       1 = otherwise.
 */
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const REPORT = process.argv.includes('--report')
const JSON_OUT = process.argv.includes('--json')
const MODULE = 'lib/data/geo/report-cities.ts'

// ── Supabase creds (env first for CI/nightly, then .env.local for local) ──────
function readEnvLocal() {
  const p = join(process.cwd(), '.env.local')
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
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  // Off-chain gate: no creds means we're in the secret-less static context.
  // Skip cleanly so a credless run (or the static chain) never fails spuriously.
  console.log('ci:market-city-mls-canon: SKIPPED (no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  console.log('  This gate reads live Supabase — run it nightly (quality.yml) or locally with .env.local.')
  process.exit(0)
}

// ── Load the pure, import-free registry module via esbuild (same pattern as
//    check-market-narrative-integrity.mjs) ─────────────────────────────────────
async function loadRegistry() {
  const src = join(process.cwd(), MODULE)
  if (!existsSync(src)) throw new Error(`${MODULE} not found — the city registry moved; re-point this gate.`)
  const dir = mkdtempSync(join(tmpdir(), 'rr-citycanon-'))
  const out = join(dir, 'm.mjs')
  try {
    execFileSync(
      join(process.cwd(), 'node_modules/.bin/esbuild'),
      [src, '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'],
      { stdio: 'pipe' },
    )
    return await import(pathToFileURL(out).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── PostgREST exact count via the Content-Range header (HEAD, no body) ─────────
async function countListings(filter) {
  const res = await fetch(`${URL}/rest/v1/listings?${filter}`, {
    method: 'HEAD',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  })
  if (!res.ok && res.status !== 206) throw new Error(`PostgREST ${res.status} for ${filter}`)
  const cr = res.headers.get('content-range') // "*/<total>" or "0-24/<total>"
  const total = cr ? Number(cr.split('/')[1]) : NaN
  if (!Number.isFinite(total)) throw new Error(`no count in content-range ("${cr}") for ${filter}`)
  return total
}

// City names carry no SQL-LIKE wildcards, so ilike.<name> is a case-insensitive
// EXACT match — the PostgREST equivalent of the RPC's lower("City")=lower(slug).
const cityCount = (name) => countListings(`City=ilike.${encodeURIComponent(name)}`)
// A community's real home = City=<mlsCity> AND SubdivisionName matches ANY of the
// documented patterns (a community can span two naming conventions, e.g. CRR's
// literal "Crooked River Ranch" + its "Crr%" codes). Summed across patterns; the
// only thing that matters is that the total is > 0 (the home is real).
async function homeRows(mlsCity, subMatch) {
  const patterns = Array.isArray(subMatch) ? subMatch : [subMatch]
  let total = 0
  for (const p of patterns) {
    total += await countListings(
      `City=ilike.${encodeURIComponent(mlsCity)}&SubdivisionName=ilike.${encodeURIComponent(p)}`,
    )
  }
  return total
}

async function main() {
  const mod = await loadRegistry()
  const REPORT_CITY_LABELS = mod.REPORT_CITY_LABELS ?? []
  const MARKET_REPORT_DEFAULT_CITIES = mod.MARKET_REPORT_DEFAULT_CITIES ?? []
  const PRIMARY_CITIES = mod.PRIMARY_CITIES ?? []
  const EXEMPT = mod.NON_MLS_CITY_EXEMPTIONS ?? {}

  // Every city-tier name, de-duplicated (case-insensitively) but keeping the
  // display spelling, plus which tiers each name appears in (for messages).
  const tiers = [
    ['REPORT_CITIES', REPORT_CITY_LABELS],
    ['MARKET_REPORT_DEFAULT_CITIES', MARKET_REPORT_DEFAULT_CITIES],
    ['PRIMARY_CITIES', PRIMARY_CITIES],
  ]
  const nameToTiers = new Map() // lowerName -> { display, tiers:Set }
  for (const [tier, list] of tiers) {
    for (const name of list) {
      const k = String(name).toLowerCase()
      if (!nameToTiers.has(k)) nameToTiers.set(k, { display: name, tiers: new Set() })
      nameToTiers.get(k).tiers.add(tier)
    }
  }

  // Case-insensitive exemption lookup.
  const exemptByLower = new Map(Object.entries(EXEMPT).map(([k, v]) => [k.toLowerCase(), { name: k, ...v }]))

  const problems = []
  const rows = []

  for (const [lower, { display, tiers: inTiers }] of nameToTiers) {
    const exemption = exemptByLower.get(lower)
    const n = await cityCount(display)
    const row = { name: display, tiers: [...inTiers], cityRows: n, exempt: !!exemption }
    if (exemption) {
      // (2) exempt name must be a genuine non-city (0 rows).
      if (n > 0) {
        problems.push(
          `"${display}" is exempted in NON_MLS_CITY_EXEMPTIONS but now matches ${n} listings."City" row(s). It is a real MLS city again — remove it from the exemption map so its city cache is populated.`,
        )
      }
      // (3) documented data home must actually hold rows.
      const patterns = Array.isArray(exemption.subdivisionMatch)
        ? exemption.subdivisionMatch
        : [exemption.subdivisionMatch]
      const homeN = await homeRows(exemption.mlsCity, patterns)
      row.home = { mlsCity: exemption.mlsCity, subdivisionMatch: patterns, rows: homeN }
      if (homeN === 0) {
        problems.push(
          `"${display}" exemption claims its listings file under City="${exemption.mlsCity}" with SubdivisionName ILIKE ${patterns.map((p) => `"${p}"`).join(' / ')}, but that matches 0 rows. The documented data home is wrong — fix NON_MLS_CITY_EXEMPTIONS.`,
        )
      }
    } else {
      // (1) a real city-tier name must match at least one MLS City row.
      if (n === 0) {
        problems.push(
          `"${display}" (in ${[...inTiers].join(', ')}) matches 0 listings."City" rows. compute_and_cache_period_stats keys on lower("City")=lower(slug), so this name yields a permanently-empty cache + /cities page (§0). Either it is a real MLS city under a different spelling — fix the registry — or it is a subdivision of another city — add it to NON_MLS_CITY_EXEMPTIONS with its real data home.`,
        )
      }
    }
    rows.push(row)
  }

  return { problems, rows }
}

let result
try {
  result = await main()
} catch (err) {
  console.error(`ci:market-city-mls-canon: ERROR — ${String(err.message || err).slice(0, 300)}`)
  process.exit(1)
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(REPORT ? 0 : result.problems.length ? 1 : 0)
}

console.log('Market city → MLS-City canonical name gate (ci:market-city-mls-canon)')
console.log('=====================================================================')
for (const r of result.rows) {
  const subPats = Array.isArray(r.home?.subdivisionMatch) ? r.home.subdivisionMatch.join(' / ') : r.home?.subdivisionMatch
  const tag = r.exempt ? `EXEMPT (home City="${r.home?.mlsCity}" ILIKE ${subPats} → ${r.home?.rows} rows)` : `${r.cityRows} City rows`
  const mark = r.exempt ? (r.cityRows === 0 && (r.home?.rows ?? 0) > 0 ? '✓' : '✗') : r.cityRows > 0 ? '✓' : '✗'
  console.log(`  ${mark} ${r.name.padEnd(22)} ${tag}`)
}
if (result.problems.length) {
  console.error('')
  for (const p of result.problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:market-city-mls-canon: ${result.problems.length} problem(s).\x1b[0m`)
  process.exit(REPORT ? 0 : 1)
}
console.log('\n✓ Every city-tier registry name is a real MLS City or a documented, verified exemption.')
process.exit(0)
