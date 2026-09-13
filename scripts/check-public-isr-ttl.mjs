#!/usr/bin/env node
/**
 * check-public-isr-ttl.mjs — `npm run ci:public-isr-ttl`.
 *
 * THE CLASS: high-traffic public pages shipped `revalidate = 60`, so Vercel
 * ISR rebuilt those routes every minute. That is write spend, not freshness
 * the buyer can see. Matt 2026-09-13: raise the window; use TTLs already
 * used elsewhere in this repo (do not invent new ones).
 *
 *   300  — search / listing-index / city / community / subdivision / zip /
 *          compare / open houses / root layout
 *   1800 — team broker pages
 *
 * Admin / CRM / CMA / auth / API mutation routes stay `0` / `force-dynamic`
 * and are not listed here.
 *
 * Two rules:
 *   1. Each listed file still exports the pinned TTL (exact).
 *   2. No other app page.tsx or layout.tsx may export `revalidate = 60`.
 *
 * Usage:
 *   node scripts/check-public-isr-ttl.mjs           # CI mode
 *   node scripts/check-public-isr-ttl.mjs --report  # same output, always exit 0
 */
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const REPORT = process.argv.slice(2).includes('--report')

export const PUBLIC_ISR_TTLS = [
  ['app/layout.tsx', 300],
  ['app/search/page.tsx', 300],
  ['app/search/[...slug]/page.tsx', 300],
  ['app/cities/[slug]/page.tsx', 300],
  ['app/cities/[slug]/[neighborhoodSlug]/page.tsx', 300],
  ['app/cities/[slug]/types/[type]/page.tsx', 300],
  ['app/communities/[slug]/page.tsx', 300],
  ['app/communities/[slug]/types/[type]/page.tsx', 300],
  ['app/subdivisions/[slug]/page.tsx', 300],
  ['app/zip/[zip]/page.tsx', 300],
  ['app/open-houses/page.tsx', 300],
  ['app/open-houses/[city]/page.tsx', 300],
  ['app/compare/page.tsx', 300],
  ['app/team/[slug]/page.tsx', 1800],
]

const REVALIDATE_EXPORT = /export\s+const\s+revalidate\s*=\s*(-?\d+)/

function readExport(relPath) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) return { missing: true, value: null, source: '' }
  const source = readFileSync(abs, 'utf8')
  const match = source.match(REVALIDATE_EXPORT)
  return { missing: false, value: match ? Number(match[1]) : null, source }
}

function walkAppTsx(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const abs = join(dir, ent.name)
    if (ent.isDirectory()) {
      walkAppTsx(abs, out)
      continue
    }
    if (ent.name === 'page.tsx' || ent.name === 'layout.tsx') out.push(abs)
  }
  return out
}

function main() {
  const problems = []

  for (const [relPath, expected] of PUBLIC_ISR_TTLS) {
    const { missing, value } = readExport(relPath)
    if (missing) {
      problems.push(`${relPath}: file missing — public ISR TTL list drifted`)
      continue
    }
    if (value == null) {
      problems.push(`${relPath}: no \`export const revalidate\` — page lost ISR`)
      continue
    }
    if (value !== expected) {
      problems.push(
        `${relPath}: revalidate = ${value}s, expected ${expected}s (60s burns ISR Writes; do not invent a new TTL)`,
      )
    }
  }

  const listed = new Set(PUBLIC_ISR_TTLS.map(([rel]) => rel))
  for (const abs of walkAppTsx(join(ROOT, 'app'))) {
    const rel = relative(ROOT, abs).replaceAll('\\', '/')
    if (listed.has(rel)) continue
    const { value } = readExport(rel)
    if (value === 60) {
      problems.push(
        `${rel}: leftover \`revalidate = 60\` — raise to an existing public TTL (300 / 1800 / 3600 / 86400)`,
      )
    }
  }

  if (problems.length === 0) {
    console.log(`ci:public-isr-ttl OK — ${PUBLIC_ISR_TTLS.length} public pages pinned; no leftover revalidate = 60`)
    process.exit(0)
  }

  console.error('ci:public-isr-ttl FAIL')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(REPORT ? 0 : 1)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
