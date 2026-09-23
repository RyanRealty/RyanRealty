#!/usr/bin/env node
/**
 * check-degraded-isr.mjs (ci:degraded-isr) — SITE-118
 *
 * ISR pages that race published-section reads through withTimeoutFallback
 * must wrap the render in `runPublishedPageRender`. A timeout used to persist
 * the thin fallback for the full revalidate window (PR #252 /cities, /zip
 * under load). The wrapper notes those reads and shortens that render's ISR
 * lifetime to DEGRADED_ISR_REVALIDATE_S through unstable_cache.
 *
 * AND IT MUST NEVER CALL unstable_noStore() (P3 — DATA-6, DATA-1, SEO-2,
 * EXP-7, 2026-09-23). It did from 2026-09-16, and inside a runtime ISR render
 * Next 16 answers noStore() by throwing "Dynamic server usage: Route
 * /subdivisions/[slug] couldn't be rendered statically because it used
 * unstable_noStore()" (E550, digest DYNAMIC_SERVER_USAGE), which is HTTP 500:
 * every degraded cold render of /subdivisions/* was a 500
 * (/subdivisions/elkai-woods on every fetch), and every degraded regeneration
 * of the prebuilt place pages failed into the error log. The second check
 * below holds that shut.
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

// The mechanism itself: shorten, never opt out. Comments are stripped so the
// header's own explanation of the old bug does not trip the check.
const MECHANISM = 'lib/site/degraded-isr.ts'
{
  const abs = join(ROOT, MECHANISM)
  if (!existsSync(abs)) {
    missing.push(`${MECHANISM} — file not found (mechanism moved? update this gate)`)
  } else {
    const code = readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    if (/\bunstable_noStore\b|\bnoStore\s*\(/.test(code)) {
      missing.push(
        `${MECHANISM} — calls unstable_noStore(); inside a runtime ISR render that throws DYNAMIC_SERVER_USAGE (E550) and answers HTTP 500, not an opt-out`,
      )
    }
    if (!/\bunstable_cache\s*\(/.test(code) || !/DEGRADED_ISR_REVALIDATE_S/.test(code)) {
      missing.push(`${MECHANISM} — must shorten a degraded render's ISR lifetime through unstable_cache({ revalidate: DEGRADED_ISR_REVALIDATE_S })`)
    }
  }
}

if (missing.length) {
  console.error('ci:degraded-isr FAILED — place/ISR pages missing the SITE-118 degraded-copy guard:')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('\nWrap the page body in runPublishedPageRender from @/lib/site/degraded-isr.')
  process.exit(1)
}
console.log(`ci:degraded-isr passed (${PAGES.length} ISR pages refuse a degraded persist).`)
