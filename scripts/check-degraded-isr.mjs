#!/usr/bin/env node
/**
 * check-degraded-isr.mjs (ci:degraded-isr) — SITE-118
 *
 * ISR pages that race published-section reads through withTimeoutFallback
 * must wrap the render in `runPublishedPageRender`. A timeout used to persist
 * the thin fallback for the full revalidate window (PR #252 /cities, /zip
 * under load). The wrapper notes those reads and calls `unstable_noStore()`
 * so the thin copy is not written.
 *
 * Do not loosen `ci:route-content-floor`. This gate only holds the mechanism.
 *
 * Usage: node scripts/check-degraded-isr.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const PAGES = [
  'app/cities/page.tsx',
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/cities/[slug]/types/[type]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/communities/[slug]/types/[type]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
  'app/zip/[zip]/page.tsx',
  'app/about/page.tsx',
  'app/cities/[slug]/types/[type]/_v3/PlaceTypeAtlasSection.tsx',
]

const missing = []
for (const rel of PAGES) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    missing.push(`${rel} — file not found (route moved? update this gate)`)
    continue
  }
  const src = readFileSync(abs, 'utf8')
  if (!src.includes('runPublishedPageRender')) {
    missing.push(`${rel} — missing runPublishedPageRender (degraded ISR persist)`)
  }
  if (!src.includes('withTimeoutFallback')) {
    missing.push(`${rel} — missing withTimeoutFallback (published reads must still be timeout-guarded)`)
  }
}

if (missing.length) {
  console.error('ci:degraded-isr FAILED — place/ISR pages missing the SITE-118 persist refuse:')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('\nWrap the page body in runPublishedPageRender from @/lib/site/degraded-isr.')
  process.exit(1)
}
console.log(`ci:degraded-isr passed (${PAGES.length} ISR pages refuse a degraded persist).`)
