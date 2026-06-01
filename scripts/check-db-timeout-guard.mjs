#!/usr/bin/env node
/**
 * G39 — DB-timeout-guard gate.
 *
 * The highest-traffic, DB-heaviest pages (search, listing detail, community
 * detail) each load multiple DAL queries server-side. A `.catch()` swallows an
 * ERROR but not SLOWNESS — a slow-but-successful query (or a pooler stall) with
 * no timeout hangs the whole RSC render to FUNCTION_INVOCATION_TIMEOUT, which
 * the user sees as a 30s+ blank wait or "Something went wrong". These pages were
 * doing exactly that (community detail: 35-50s). The fix was to wrap every
 * page-level fetch in withTimeout / withTimeoutFallback so a slow query degrades
 * one section instead of hanging the page.
 *
 * This gate hard-fails if any of those pages drops the timeout-guard import, so
 * the fix can't silently regress.
 *
 * Run: node scripts/check-db-timeout-guard.mjs   (wired into ci:gates)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// High-traffic, multi-query server pages that MUST timeout-guard their fetches.
const GUARDED_PAGES = [
  'app/search/page.tsx',
  'app/search/[...slug]/page.tsx',
  'app/listing/[listingKey]/page.tsx',
  'app/communities/[slug]/page.tsx',
]

const GUARD_RE = /\bwithTimeout(Fallback)?\b/

const missing = []
for (const rel of GUARDED_PAGES) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) {
    missing.push(`${rel} — file not found (route moved? update this gate)`)
    continue
  }
  const src = fs.readFileSync(abs, 'utf8')
  if (!GUARD_RE.test(src)) {
    missing.push(`${rel} — no withTimeout/withTimeoutFallback (page-level DB fetches must be timeout-guarded)`)
  }
}

if (missing.length) {
  console.error('DB-timeout-guard gate FAILED — high-traffic pages missing query timeout guards:')
  for (const m of missing) console.error('  - ' + m)
  console.error('\nWrap each page-level DAL fetch in withTimeoutFallback (see app/search/page.tsx).')
  process.exit(1)
}
console.log(`DB-timeout-guard gate passed (${GUARDED_PAGES.length} high-traffic pages timeout-guarded).`)
