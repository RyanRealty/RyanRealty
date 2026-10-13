#!/usr/bin/env node
/**
 * check-page-payload-budget.mjs — audit item 16 (2026-08-03), the /homes-for-sale
 * payload ratchet.
 *
 * THE CLASS: audit item 16 measured /homes-for-sale at 996 KB on 2026-08-02.
 * Re-measured against production on 2026-08-03 it had grown to 1,019,774 bytes.
 * Nothing failed a build, a type check, or a review in between — the file-size
 * ratchet (check-file-size-budget.mjs) watches source LOC, the bundle budget
 * (check-bundle-budget.mjs) watches .next/static JS chunks, and neither one
 * looks at what a browser actually downloads for the rendered page: the HTML,
 * the inline __NEXT_DATA__ / RSC flight payload, the embedded listing JSON. A
 * primary search entry point can double its payload and every other gate stays
 * green. This gate closes that blind spot with a SHRINK-ONLY ratchet on real,
 * fetched, rendered-page byte counts — same house style as
 * check-file-size-budget.mjs (baseline JSON, NEW violators fail, a page may
 * only get smaller than its own baseline, never bigger).
 *
 * WHY IT DOES NOT RUN IN THE SECRET-LESS STATIC ci:gates CHAIN: the number
 * this gate polices only exists once a real production build is running and
 * serving traffic — `next dev` inlines dev-only instrumentation and skips
 * production minification, so a dev-server measurement is not the number a
 * visitor downloads. This gate requires a BUILT, RUNNING server (`next start`,
 * any port) and is meant to run locally / nightly, the same tier as
 * check-data-access.mjs (docs/MECHANICAL_GATES.md §6: "DB-dependent gates run
 * locally/nightly — NOT in the secret-less static chain").
 *
 * Fetches each tracked page with a real browser User-Agent (the middleware bot
 * screen 403s a bare curl / fetch UA) and Accept-Encoding: identity, so the
 * measured byte count is the actual uncompressed response body — comparable
 * run to run regardless of whether a given hop happens to gzip.
 *
 * Usage (against a server you already built and started):
 *   npm run build
 *   npx next start -p 3105 &
 *   PAGE_PAYLOAD_BASE_URL=http://localhost:3105 node scripts/check-page-payload-budget.mjs
 *   PAGE_PAYLOAD_BASE_URL=http://localhost:3105 node scripts/check-page-payload-budget.mjs --report
 *   PAGE_PAYLOAD_BASE_URL=http://localhost:3105 node scripts/check-page-payload-budget.mjs --write-baseline
 *
 * Env:
 *   PAGE_PAYLOAD_BASE_URL   origin of a running BUILT server. Default http://localhost:3000.
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { CI_PROBE_USER_AGENT } from './lib/ci-probe-ua.mjs'

const __filename = fileURLToPath(import.meta.url)
const BASELINE = resolve(new URL('.', import.meta.url).pathname, 'page-payload-budget-baseline.json')
const BASE_URL = (process.env.PAGE_PAYLOAD_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
// The shared CI probe UA, not a hand-rolled browser string. middleware.ts 403s
// automation User-Agents, so every CI probe needs one the bot screen passes, and
// G60 (ci:probe-ua) checks that constant against the LIVE BAD_BOT_RE rather than
// letting each script guess. The screen only blocks or passes, it never varies
// the rendered HTML by UA, so the measured byte count is unaffected.
const UA = CI_PROBE_USER_AGENT

/**
 * The heavy public pages under the ratchet. To add a page: append it here,
 * then run --write-baseline against a built server to record its starting
 * size. Never hand-edit a number in the baseline file — only --write-baseline
 * may move one, and CI only accepts that move going down.
 *
 * HARD_CEILING_BYTES (200 KB uncompressed) is the fail line for these routes
 * after the 2026-10 HTML-payload cut. A page may also only shrink versus its
 * own baseline. Listing detail is resolved at measure time (SMOKE_LISTING_KEY
 * or pick-lhci-listing) and stored under `/listing/*`.
 */
export const HARD_CEILING_BYTES = 200 * 1024

export const PAGES = [
  { path: '/', label: 'homepage' },
  { path: '/communities/tetherow', label: 'community place page' },
  { path: '/homes-for-sale/bend', label: 'city browse' },
  { path: '/homes-for-sale', label: 'primary search entry point (audit item 16)' },
]

export function baselineKeyFor(path) {
  if (path === '/listing/*' || /^\/listing\/[^/]+$/.test(path)) return '/listing/*'
  return path
}

export const HARD_CEILING_GRID_CARDS = 24
export const HARD_CEILING_HOME_RAIL_CARDS = 36

export function countSerializedListingKeys(html) {
  const keys = new Set()
  // Served HTML quotes keys two ways: raw JSON (`"ListingKey":"…"`) and the
  // RSC flight (`\"ListingKey\":\"…\"`). Count unique values, not mentions.
  for (const match of String(html).matchAll(/\\?"(?:listingKey|ListingKey)\\?":\\?"([^"\\]+)/g)) {
    keys.add(match[1])
  }
  return keys.size
}

export function cardCapFor(path) {
  return path === '/' ? HARD_CEILING_HOME_RAIL_CARDS : HARD_CEILING_GRID_CARDS
}

/**
 * Fail when a page grew, or when it is over 200 KB *and* still serializes more
 * than one grid page of listings (the bug class: 48-card seeds, whole-community
 * homes arrays, uncapped photo flights). A 700 KB community whose map seeded
 * 22 homes is the RSC tree, not an inventory dump — the shrink ratchet holds
 * that page; SEO A owns the remaining tree.
 */
export function evaluatePayloadBudget(sizes, baseline, options = {}) {
  const ceiling = options.ceiling ?? HARD_CEILING_BYTES
  const cardCounts = options.cardCounts ?? {}
  const failures = []
  for (const [path, bytes] of Object.entries(sizes)) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
      failures.push(`${path}: not a measured byte count`)
      continue
    }
    const key = baselineKeyFor(path)
    const cards = cardCounts[key] ?? cardCounts[path]
    const cap = cardCapFor(key)
    if (bytes > ceiling && (cards == null || cards > cap)) {
      const cardNote = cards == null ? 'listing-card count not measured' : `${cards} listing cards (cap ${cap})`
      failures.push(
        `${path} is ${fmt(bytes)} with ${cardNote} — hard ceiling is ${fmt(ceiling)} when more than ${cap} listings are serialized`,
      )
    }
    const was = baseline?.pages?.[key]
    if (was === undefined) {
      failures.push(`NEW tracked page with no baseline entry: ${key} (${fmt(bytes)}) — run --write-baseline`)
    } else if (bytes > was) {
      failures.push(`${key} grew: ${fmt(bytes)} (baseline ${fmt(was)}) — +${(bytes - was).toLocaleString('en-US')} bytes`)
    }
  }
  return failures
}

function fmt(n) {
  return `${(n / 1024).toFixed(1)} KB (${n.toLocaleString('en-US')} bytes)`
}

async function fetchPageMeasure(path) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Encoding': 'identity' },
    redirect: 'manual',
  })
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `HTTP ${res.status} redirect — PAGE_PAYLOAD_BASE_URL must point at the host that serves ${path} directly (canonical rewrites, not a redirect chain)`
    )
  }
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status} — is a BUILT server (npm run build && next start) running at ${BASE_URL}?`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return { bytes: buf.length, cards: countSerializedListingKeys(buf.toString('utf8')) }
}

async function resolveListingPath() {
  const fromEnv = (process.env.SMOKE_LISTING_KEY ?? '').trim()
  if (fromEnv) return `/listing/${fromEnv}`
  try {
    const html = await fetch(`${BASE_URL}/homes-for-sale/bend`, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Encoding': 'identity' },
    }).then((res) => (res.ok ? res.text() : ''))
    const match = html.match(/\/listing\/(\d{10,})\b/)
    if (match) return `/listing/${match[1]}`
  } catch {
    /* skip — listing is optional when no key and no seed page */
  }
  return null
}

async function scan() {
  const sizes = {}
  const cardCounts = {}
  const errors = []
  const pages = [...PAGES]
  const listingPath = await resolveListingPath()
  if (listingPath) pages.push({ path: listingPath, label: 'listing detail' })
  for (const { path } of pages) {
    try {
      const key = baselineKeyFor(path)
      const measured = await fetchPageMeasure(path)
      sizes[key] = measured.bytes
      cardCounts[key] = measured.cards
    } catch (error) {
      errors.push(`${path}: ${error.message}`)
    }
  }
  return { sizes, cardCounts, errors }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const REPORT = args.includes('--report')
  const WRITE_BASELINE = args.includes('--write-baseline')

  const { sizes, cardCounts, errors } = await scan()

  if (errors.length > 0) {
    console.error(`✗ Could not measure ${errors.length} page(s) against ${BASE_URL}:`)
    for (const e of errors) console.error(`  ${e}`)
    console.error('')
    console.error('  npm run build')
    console.error('  npx next start -p 3105 &')
    console.error('  PAGE_PAYLOAD_BASE_URL=http://localhost:3105 node scripts/check-page-payload-budget.mjs')
    process.exit(REPORT ? 0 : 2)
  }

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note:
            'Rendered-HTML-size ratchet for the heavy public pages (audit item 16, 2026-08-03; ' +
            'HTML payload cut 2026-10-13). bytes = raw uncompressed response body, fetched with a ' +
            'browser User-Agent and Accept-Encoding: identity, from a BUILT `next start` server ' +
            '(never `next dev`). Every value may only SHRINK. A page over 200 KB also fails when ' +
            'it serializes more than one grid page of listings (24; 36 on /). Regenerate with ' +
            '--write-baseline only after a real fix lands — never to paper over a regression.',
          measuredAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          pages: sizes,
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✓ Baseline written: ${Object.keys(sizes).length} page(s) → ${BASELINE}`)
    for (const [p, n] of Object.entries(sizes)) console.log(`  ${fmt(n)}  ${p}`)
    process.exit(0)
  }

  if (REPORT) {
    console.log(`page-payload budget — ${PAGES.length} page(s), server ${BASE_URL}`)
    for (const [p, n] of Object.entries(sizes)) console.log(`  ${fmt(n)}  ${p}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    // The ratchet cannot fail-closed on a missing seed — that made every PR
    // red since the smoke step started calling this script (baseline was
    // never committed). Skip until someone writes the file against a built
    // server. Once the file exists, counts may only shrink.
    console.log('page-payload budget: SKIP — no baseline at ' + BASELINE)
    console.log('  Seed with: node scripts/check-page-payload-budget.mjs --write-baseline')
    process.exit(0)
  }

  const failures = evaluatePayloadBudget(sizes, baseline, { cardCounts })

  console.log('page-payload budget (rendered HTML, shrink-only ratchet)')
  console.log('==========================================================')
  if (failures.length) {
    console.error(`✗ ${failures.length} budget breach(es):`)
    for (const m of failures) console.error(`  ${m}`)
    console.error('')
    console.error(
      'Find what grew — inline JSON payload, RSC flight data, a duplicated component render, repeated markup — and cut it.'
    )
    console.error('If the growth is genuinely unavoidable, re-baseline with --write-baseline. Not as a reflex.')
    process.exit(1)
  }
  console.log(`✓ OK — ${Object.keys(sizes).length} page(s) within budget (none grew; 200 KB / ${HARD_CEILING_GRID_CARDS}-card dump line holds).`)
  for (const [path, bytes] of Object.entries(sizes)) {
    const was = baseline.pages?.[path]
    const shrank = was != null && bytes < was ? `  (shrank ${(was - bytes).toLocaleString('en-US')} bytes from baseline)` : ''
    const cards = cardCounts[path]
    const cardNote = typeof cards === 'number' ? `  ${cards} listing cards` : ''
    console.log(`  ${fmt(bytes)}  ${path}${cardNote}${shrank}`)
  }
  process.exit(0)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) {
  main().catch((error) => {
    console.error('✗ check-page-payload-budget.mjs crashed:', error)
    process.exit(2)
  })
}
