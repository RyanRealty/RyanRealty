#!/usr/bin/env node
/**
 * check-canonical-integrity.mjs — CI gate: canonical URL hygiene.
 *
 * Two independent checks, both must pass:
 *
 * CHECK A — Redirect-canonical collision.
 *   A page whose canonical URL matches a redirect source pattern is
 *   self-defeating: Google follows the 301 back to the destination, then
 *   sees the canonical pointing at the now-redirected source URL and
 *   flags it as contradictory. The redirect destination wins, but the
 *   signal is wasted and the page may be de-prioritised.
 *
 * CHECK B — Missing canonical on indexable pages (ratcheted).
 *   Every public, indexable page.tsx must declare a canonical via
 *   alternates.canonical, alternates: { canonical }, or pageMetadata().
 *   Pages under app/admin, app/api, app/marketing are excluded (not
 *   consumer-facing). Pages that declare `noindex` are also excluded.
 *   Pages in scripts/canonical-integrity-baseline.json are tracked as
 *   known debt and do NOT fail CI — but the total may never grow beyond
 *   the baseline ceiling (the ratchet).
 *
 * Usage:
 *   node scripts/check-canonical-integrity.mjs            # CI
 *   node scripts/check-canonical-integrity.mjs --report   # report, exit 0
 *   node scripts/check-canonical-integrity.mjs --json     # machine-readable
 *   node scripts/check-canonical-integrity.mjs --write-baseline  # update baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const BASELINE_PATH = join(ROOT, 'scripts', 'canonical-integrity-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

// ── Redirect source extraction ──────────────────────────────────────────────

/**
 * Parse redirect entries from next.config.ts via naive string extraction.
 * Handles simple literal sources and :param patterns. Skips wildcards.
 * Returns an array of { source, destination, isRegex } objects.
 */
function parseRedirects() {
  const configPath = join(ROOT, 'next.config.ts')
  if (!existsSync(configPath)) return []
  const src = readFileSync(configPath, 'utf8')

  // Isolate ONLY the async redirects() return array — stop before rewrites() or headers().
  // We find the text between `async redirects()` and the matching `}` that ends that method.
  const startRe = /async\s+redirects\s*\(\s*\)\s*\{[\s\S]*?return\s*\[/
  const startMatch = startRe.exec(src)
  if (!startMatch) return []

  // Walk forward from the opening `[` to find the matching `]` and then `}`
  let depth = 0
  let start = startMatch.index + startMatch[0].length - 1 // position of `[`
  let end = start
  for (let i = start; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  const block = src.slice(start, end + 1)

  const pairs = []
  // Match only object literals that contain BOTH source AND destination — these
  // are redirect entries, not headers entries (which have source but no destination).
  const objectRe = /\{([^{}]*?\bsource\s*:\s*['"`]([^'"`]+)['"`][^{}]*?\bdestination\s*:\s*['"`]([^'"`]+)['"`][^{}]*?|[^{}]*?\bdestination\s*:\s*['"`][^'"`]+['"`][^{}]*?\bsource\s*:\s*['"`]([^'"`]+)['"`][^{}]*?)\}/g
  let m
  while ((m = objectRe.exec(block)) !== null) {
    // source is in group 2 or group 4 depending on field order
    const srcVal = m[2] ?? m[4]
    if (!srcVal) continue
    // Skip wildcard and grouping patterns we cannot statically resolve.
    if (srcVal.includes('*') || srcVal.includes('(')) continue
    // Convert :param to a regex segment — matches any non-slash segment.
    const pattern = '^' + srcVal.replace(/:[^/]+/g, '[^/]+') + '/?$'
    pairs.push({ source: srcVal, pattern: new RegExp(pattern) })
  }
  return pairs
}

// ── Page file walker ────────────────────────────────────────────────────────

// Segments to skip entirely — not consumer-facing.
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'admin', 'api', 'marketing',
  'account', 'dashboard', 'cma-drafts',
])

function walkPages(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      walkPages(full, acc)
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      acc.push(full)
    }
  }
  return acc
}

// ── Canonical detection ─────────────────────────────────────────────────────

/**
 * Returns true if the page source declares a canonical URL.
 * Matches:
 *   alternates: { canonical: ... }
 *   alternates: { canonical }            (shorthand)
 *   pageMetadata({...path:...})          (the helper auto-sets canonical)
 *   export { metadata } from '...'       (re-export — canonical lives in source)
 *   generateMetadata(...)                (dynamic canonical, treated as present)
 */
function hasCanonical(src) {
  if (/alternates\s*:\s*\{/.test(src) && /canonical/.test(src)) return true
  if (/pageMetadata\s*\(/.test(src)) return true
  // Re-exports: the canonical is declared in the referenced module.
  if (/export\s*\{[^}]*\bmetadata\b[^}]*\}\s*from/.test(src)) return true
  // generateMetadata function — dynamic per-page canonical.
  if (/generateMetadata\b/.test(src)) return true
  return false
}

/**
 * Returns true if the page source (or its segment layout) opts out of indexing.
 * Handles both string form ('noindex, nofollow') and object form ({ index: false }).
 */
function isNoindex(src, layoutSrc) {
  const combined = src + (layoutSrc ?? '')
  // String form: robots: 'noindex...'
  if (/robots\s*:\s*['"`]noindex/.test(combined)) return true
  // Object form: robots: { index: false, ... }
  if (/robots\s*:\s*\{[^}]*\bindex\s*:\s*false/.test(combined)) return true
  return false
}

/**
 * Try to extract the static canonical path from the source text.
 * Returns null if the canonical is dynamic (template literal with runtime var).
 *
 * Handles:
 *   alternates: { canonical: `${siteUrl}/some/path` }   -> '/some/path'
 *   alternates: { canonical: siteUrl }                  -> '/'  (homepage)
 *   alternates: { canonical: `${siteUrl}` }             -> '/'
 *   pageMetadata({ path: '/some/path' })                 -> '/some/path'
 */
function extractCanonicalPath(src) {
  // pageMetadata helper — extract path: '...'
  const pmMatch = src.match(/pageMetadata\s*\(\s*\{[^}]*?path\s*:\s*['"`]([^'"`]+)['"`]/)
  if (pmMatch) return pmMatch[1]

  // Template literal: `${siteUrl}/path` or `${SOMETHING}/path`
  const tmplMatch = src.match(/canonical\s*:\s*`\$\{[^}]+\}([^`]*)`/)
  if (tmplMatch) {
    const tail = tmplMatch[1].trim()
    return tail || '/'
  }

  // Plain string: canonical: 'https://...'  or  canonical: siteUrl (no quotes)
  const strMatch = src.match(/canonical\s*:\s*['"`](https?:\/\/[^'"`]+)['"`]/)
  if (strMatch) {
    try {
      return new URL(strMatch[1]).pathname
    } catch { return null }
  }

  // Bare identifier (e.g. canonical: siteUrl) — implies root
  if (/canonical\s*:\s*\w+\s*[,}\n]/.test(src)) return '/'

  return null
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const redirects = parseRedirects()
  const appDir = join(ROOT, 'app')
  const pages = walkPages(appDir)

  const collisionViolations = []   // Check A: canonical hits a redirect source
  const missingViolations = []     // Check B: no canonical on indexable page

  for (const pagePath of pages) {
    const rel = relative(ROOT, pagePath)
    const src = readFileSync(pagePath, 'utf8')

    // Also read the segment layout.tsx (same directory) — a 'use client' page
    // may declare robots/metadata via its layout rather than in page.tsx itself.
    const layoutPath = join(dirname(pagePath), 'layout.tsx')
    const layoutSrc = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : null

    if (isNoindex(src, layoutSrc)) continue   // opted out of indexing — skip both checks

    // Check B — missing canonical
    if (!hasCanonical(src)) {
      missingViolations.push(rel)
    }

    // Check A — redirect collision (only if canonical is statically resolvable)
    if (hasCanonical(src)) {
      const canonPath = extractCanonicalPath(src)
      if (canonPath && canonPath !== '/') {
        for (const redirect of redirects) {
          if (redirect.pattern.test(canonPath)) {
            collisionViolations.push({
              page: rel,
              canonicalPath: canonPath,
              redirectSource: redirect.source,
            })
          }
        }
      }
    }
  }

  // ── Baseline ratchet (Check B only) ──────────────────────────────────────
  function loadBaseline() {
    if (!existsSync(BASELINE_PATH)) return { set: new Set(), total: 0 }
    const data = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    const missing = data.missing ?? []
    return { set: new Set(missing), total: data.total ?? missing.length }
  }

  if (WRITE_BASELINE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        reason: 'Pages lacking alternates.canonical (excluding noindex, admin, api, marketing, account, dashboard). New missing-canonical pages fail CI AND the total may never exceed `total` (count ceiling). Both guards can only shrink.',
        total: missingViolations.length,
        missing: missingViolations.sort(),
      }, null, 2) + '\n'
    )
    console.log(`Wrote baseline: ${missingViolations.length} pages without canonical at ${relative(ROOT, BASELINE_PATH)}`)
    if (collisionViolations.length > 0) {
      console.log(`\nWARN: ${collisionViolations.length} redirect-collision violations also detected (fix these, they are not baselined):`)
      for (const v of collisionViolations) {
        console.log(`  ${v.page} — canonical '${v.canonicalPath}' matches redirect source '${v.redirectSource}'`)
      }
    }
    process.exit(0)
  }

  const { set: baselineSet, total: ceiling } = loadBaseline()
  const newMissing = missingViolations.filter((v) => !baselineSet.has(v))
  const fixedSinceBaseline = [...baselineSet].filter((v) => !missingViolations.includes(v))
  const overCeiling = Math.max(0, missingViolations.length - ceiling)

  const failed = collisionViolations.length > 0 || newMissing.length > 0 || overCeiling > 0

  if (JSON_OUT) {
    console.log(JSON.stringify({
      collisionViolations,
      missingCanonical: {
        total: missingViolations.length,
        ceiling,
        baselineSize: baselineSet.size,
        overCeiling,
        newViolations: newMissing,
        fixedSinceBaseline,
      },
    }, null, 2))
    process.exit(failed ? 1 : 0)
  }

  console.log('Canonical-integrity check')
  console.log('=========================')
  console.log()

  // Check A report
  console.log(`Redirect-canonical collisions (hard fail):   ${collisionViolations.length}`)
  if (collisionViolations.length > 0) {
    for (const v of collisionViolations) {
      console.log(`  ${v.page}`)
      console.log(`    canonical: '${v.canonicalPath}' -> matches redirect source '${v.redirectSource}'`)
    }
    console.log()
  }

  // Check B report
  console.log(`Pages without canonical (ratcheted):`)
  console.log(`  Live missing count:                        ${missingViolations.length}`)
  console.log(`  Baseline ceiling (may not exceed):         ${ceiling}`)
  console.log(`  Known debt (baselined):                    ${baselineSet.size}`)
  console.log(`  NEW missing-canonical pages (CI BLOCKER):  ${newMissing.length}`)
  console.log(`  Over the count ceiling (CI BLOCKER):       ${overCeiling}`)
  console.log(`  Fixed since baseline:                      ${fixedSinceBaseline.length}`)

  if (newMissing.length > 0) {
    console.log()
    console.log('NEW pages lacking alternates.canonical (fail CI):')
    for (const v of newMissing) console.log(`  ${v}`)
    console.log()
    console.log('Fix: add alternates: { canonical: `${siteUrl}/path` } to the metadata export,')
    console.log('or use the pageMetadata({ path: \'/path\' }) helper from @/lib/site/page-metadata.')
  }

  if (overCeiling > 0) {
    console.log()
    console.log(`Missing-canonical count rose above the baseline ceiling by ${overCeiling}. The debt can only shrink.`)
  }

  if (!failed) {
    console.log()
    console.log('Canonical integrity passed.')
  }

  if (REPORT) process.exit(0)
  process.exit(failed ? 1 : 0)
}

main()
