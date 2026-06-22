#!/usr/bin/env node
/**
 * check-legacy-redirects.mjs — LAUNCH-04 gate.
 *
 * Guards the legacy->new redirect map (data/legacy-redirects.json) so the domain
 * cutover doesn't 404 indexed legacy URLs and dump SEO equity.
 *
 * STATIC by default (network-free, safe for the ci:gates chain):
 *   1. Structural — every destination is a single-hop absolute path (not itself
 *      a redirect key, so no loops/chains).
 *   2. Fixture coverage — every committed ranking path in
 *      data/legacy-ranking-paths.json has a key in the redirect map. This
 *      replaces the old live-Yoast-sitemap coverage check: the legacy AgentFire
 *      host is gone post-cutover (its sitemaps 404), so the committed fixture is
 *      now the durable source of "URLs that must keep redirecting."
 *
 * OPT-IN live modes (network — for the cutover preflight / a deploy workflow,
 * NEVER the static ci:gates chain):
 *   --live-sitemap     also assert coverage against the live legacy Yoast
 *                      sitemap (WARN-tolerant unless --strict).
 *   --strict           with --live-sitemap, an unreachable sitemap is a hard FAIL.
 *   --live-200=URL     resolve each DESTINATION against a host (e.g. the staging
 *                      https://ryanrealty.vercel.app) and FAIL on any non-200.
 *
 * Regenerate the map when the fixtures change:
 *   node scripts/build-legacy-redirects.mjs
 */

import { readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const LEGACY_ORIGIN = 'https://ryan-realty.com'
const MAP_PATH = join(process.cwd(), 'data', 'legacy-redirects.json')
const RANKING_PATH = join(process.cwd(), 'data', 'legacy-ranking-paths.json')

export function normalize(pathname) {
  let p = String(pathname).trim()
  try { p = decodeURIComponent(p) } catch { /* keep */ }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p.toLowerCase()
}

/** Structural problems in the map (network-free): non-absolute or multi-hop destinations. */
export function structuralProblems(map) {
  const keys = new Set(Object.keys(map))
  const problems = []
  for (const [k, v] of Object.entries(map)) {
    if (typeof v !== 'string' || !v.startsWith('/')) {
      problems.push(`${k} -> ${v} (destination not an absolute path)`)
      continue
    }
    const vNorm = normalize(v)
    if (keys.has(vNorm) && map[vNorm] !== vNorm) {
      problems.push(`${k} -> ${v} (destination is itself a redirect key -> multi-hop)`)
    }
  }
  return problems
}

/** Committed ranking paths that have NO key in the redirect map (network-free). */
export function uncoveredPaths(map, rankingPaths) {
  const keys = new Set(Object.keys(map).map(normalize))
  return rankingPaths
    .map(normalize)
    .filter((p) => p && p !== '/' && !keys.has(p))
}

function fail(msg) {
  console.error(`\nLegacy redirect gate FAILED:\n${msg}\n`)
  process.exit(1)
}

async function fetchLocs(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (legacy-redirect-gate)' } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => normalize(m[1].replace(LEGACY_ORIGIN, '')))
    .filter((p) => p && p !== '/')
}

async function main() {
  const args = process.argv.slice(2)
  const STRICT = args.includes('--strict')
  const LIVE_SITEMAP = args.includes('--live-sitemap') || STRICT
  const LIVE_ARG = args.find((a) => a.startsWith('--live-200='))
  const LIVE_HOST = LIVE_ARG ? LIVE_ARG.split('=')[1].replace(/\/$/, '') : null

  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'))
  const keys = new Set(Object.keys(map))

  // 1. Structural (static).
  const structural = structuralProblems(map)
  if (structural.length) fail(`${structural.length} structural problem(s):\n  ` + structural.slice(0, 20).join('\n  '))

  // 2. Fixture coverage (static, default).
  const ranking = JSON.parse(readFileSync(RANKING_PATH, 'utf8'))
  const uncovered = uncoveredPaths(map, ranking)
  if (uncovered.length) {
    fail(`${uncovered.length} committed ranking path(s) have NO redirect (regenerate the map: node scripts/build-legacy-redirects.mjs):\n  ` + uncovered.slice(0, 30).join('\n  '))
  }
  console.log(`legacy-redirects: ✓ ${ranking.length} ranking paths all covered by ${keys.size} mappings; no loops, no multi-hop.`)

  // 3. Opt-in: live legacy Yoast sitemap coverage (cutover preflight).
  if (LIVE_SITEMAP) {
    let pages, posts
    try {
      ;[pages, posts] = await Promise.all([
        fetchLocs(`${LEGACY_ORIGIN}/page-sitemap.xml`),
        fetchLocs(`${LEGACY_ORIGIN}/post-sitemap.xml`),
      ])
    } catch (e) {
      const msg = `could not fetch legacy sitemap (${e.message}).`
      if (STRICT) fail(msg + ' --strict requires it reachable.')
      console.warn(`legacy-redirects: WARN ${msg} Skipping live coverage (static checks passed).`)
      process.exit(0)
    }
    const live = [...new Set([...pages, ...posts])]
    const missing = live.filter((u) => !keys.has(u))
    if (missing.length) {
      fail(`${missing.length} live legacy URL(s) have NO redirect:\n  ` + missing.slice(0, 30).join('\n  '))
    }
    console.log(`legacy-redirects: ✓ ${live.length} live legacy URLs all covered.`)
  }

  // 4. Opt-in: destinations resolve 200 on a staging host (pre-cutover).
  if (LIVE_HOST) {
    console.log(`\nResolving destinations against ${LIVE_HOST} ...`)
    const dests = [...new Set(Object.values(map))]
    const bad = []
    for (const d of dests) {
      try {
        const res = await fetch(`${LIVE_HOST}${d}`, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (legacy-redirect-gate)' } })
        if (res.status !== 200) bad.push(`${d} -> ${res.status}`)
      } catch (e) {
        bad.push(`${d} -> ERR ${e.message}`)
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

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main().catch((e) => { console.error(e); process.exit(1) })
