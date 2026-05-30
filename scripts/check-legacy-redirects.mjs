#!/usr/bin/env node
/**
 * check-legacy-redirects.mjs — LAUNCH-04 gate.
 *
 * Asserts the legacy→new redirect map (data/legacy-redirects.json) covers EVERY
 * URL in the live legacy Yoast sitemap, with no redirect loops and only valid
 * destinations. This is what stops the domain cutover from 404'ing indexed
 * legacy URLs and dumping SEO equity.
 *
 * Modes:
 *   (default)      set-membership: every live legacy URL has a mapping; every
 *                  destination is a single-hop absolute path (not itself a
 *                  redirect key). Network-tolerant: if the legacy sitemap is
 *                  unreachable it WARNS and exits 0 (so CI never flakes on an
 *                  external host) — run --strict in the cutover preflight.
 *   --strict       same, but a fetch failure is a hard FAIL (cutover preflight).
 *   --live-200=URL resolve each DESTINATION against a host (e.g. the staging
 *                  https://ryanrealty.vercel.app) and FAIL on any non-200 — and
 *                  print blog slugs to downgrade to /blog. Run before cutover.
 *
 * Regenerate the map first when the legacy sitemap changes:
 *   node scripts/build-legacy-redirects.mjs
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LEGACY_ORIGIN = 'https://ryan-realty.com'
const MAP_PATH = join(process.cwd(), 'data', 'legacy-redirects.json')

const args = process.argv.slice(2)
const STRICT = args.includes('--strict')
const LIVE_ARG = args.find((a) => a.startsWith('--live-200='))
const LIVE_HOST = LIVE_ARG ? LIVE_ARG.split('=')[1].replace(/\/$/, '') : null

function normalize(pathname) {
  let p = pathname.trim()
  try { p = decodeURIComponent(p) } catch { /* keep */ }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p.toLowerCase()
}

async function fetchLocs(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (legacy-redirect-gate)' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => normalize(m[1].replace(LEGACY_ORIGIN, '')))
    .filter((p) => p && p !== '/')
}

function fail(msg) {
  console.error(`\nLegacy redirect gate FAILED:\n${msg}\n`)
  process.exit(1)
}

async function main() {
  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'))
  const keys = new Set(Object.keys(map))

  // 1. Structural checks on the map itself (no network needed).
  const structural = []
  for (const [k, v] of Object.entries(map)) {
    if (typeof v !== 'string' || !v.startsWith('/')) structural.push(`${k} → ${v} (destination not an absolute path)`)
    const vNorm = normalize(v)
    if (keys.has(vNorm) && map[vNorm] !== vNorm) structural.push(`${k} → ${v} (destination is itself a redirect key → multi-hop)`) // loop / chain
  }
  if (structural.length) fail(`${structural.length} structural problem(s):\n  ` + structural.slice(0, 20).join('\n  '))

  // 2. Coverage against the live legacy sitemap.
  let pages, posts
  try {
    ;[pages, posts] = await Promise.all([
      fetchLocs(`${LEGACY_ORIGIN}/page-sitemap.xml`),
      fetchLocs(`${LEGACY_ORIGIN}/post-sitemap.xml`),
    ])
  } catch (e) {
    const msg = `could not fetch legacy sitemap (${e.message}).`
    if (STRICT) fail(msg + ' --strict requires it reachable.')
    console.warn(`legacy-redirects: WARN ${msg} Skipping coverage check (structural checks passed). Run --strict in cutover preflight.`)
    process.exit(0)
  }

  const live = [...new Set([...pages, ...posts])]
  const missing = live.filter((u) => !keys.has(u))
  if (missing.length) {
    fail(`${missing.length} live legacy URL(s) have NO redirect (regenerate the map: node scripts/build-legacy-redirects.mjs):\n  ` + missing.slice(0, 30).join('\n  '))
  }
  console.log(`legacy-redirects: ✓ ${live.length} live legacy URLs all covered by ${keys.size} mappings; no loops.`)

  // 3. Optional: destinations resolve 200 on the staging host (pre-cutover).
  if (LIVE_HOST) {
    console.log(`\nResolving destinations against ${LIVE_HOST} ...`)
    const dests = [...new Set(Object.values(map))]
    const bad = []
    for (const d of dests) {
      try {
        const res = await fetch(`${LIVE_HOST}${d}`, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (legacy-redirect-gate)' } })
        if (res.status !== 200) bad.push(`${d} → ${res.status}`)
      } catch (e) {
        bad.push(`${d} → ERR ${e.message}`)
      }
    }
    if (bad.length) {
      const blogMisses = bad.filter((b) => b.startsWith('/blog/'))
      fail(`${bad.length} destination(s) do not resolve 200 on ${LIVE_HOST}:\n  ` + bad.slice(0, 40).join('\n  ') +
        (blogMisses.length ? `\n\n  ${blogMisses.length} are /blog/* — remap those legacy slugs to /blog in build-legacy-redirects.mjs.` : ''))
    }
    console.log(`legacy-redirects: ✓ all ${dests.length} destinations resolve 200 on ${LIVE_HOST}.`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
