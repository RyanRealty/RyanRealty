#!/usr/bin/env node
/**
 * ci:community-href-canonical — no internal link to a redirecting community URL.
 *
 * The durable registry slug is a data key, not always a door. Juniper Preserve
 * is keyed `pronghorn` (MLS, HOA, plats, geo_key) and `/communities/pronghorn`
 * 308s to `/communities/juniper-preserve`. Five call sites on the plat page
 * built `/communities/${resortSlug}` from the durable slug, so every Juniper
 * Preserve plat linked a redirect in its breadcrumb, its JSON-LD trail, its
 * "homes for sale" door and its edges (found 2026-09-24). The same shape sat in
 * the mega menu, the CMA links, the golf and trail pages, the listing atlas,
 * the blog geo links, the newsletter, the page warmers and the subdivision
 * area redirect map.
 *
 * The rule: a `/communities/${expr}` template literal may only interpolate an
 * expression that is already the PUBLIC slug. Everything else goes through
 * `communityPath()` (lib/communities/community-public-pair.ts), which resolves
 * any registry key to the live door. The exceptions below are each a place
 * where `expr` is provably public (the route's own param, a variable named for
 * the public slug, a call that returns it); a new interpolation fails until it
 * is either routed through communityPath() or added here with its reason.
 *
 * The runtime half (every registry key's communityPath() is a non-redirecting
 * canonical URL) is lib/communities/community-public-pair.test.ts.
 *
 * CLI: node scripts/check-community-href-canonical.mjs [--report]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const REPORT = process.argv.includes('--report')
const SCAN = ['app', 'components', 'lib']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', '__fixtures__'])

/** Expressions that are the public slug by construction, anywhere. */
const PUBLIC_EXPRS = [
  /^publicSlug$/,
  /^[\w.]+\.publicSlug$/,
  /^communityPublicSlug$/,
  /^resolvePublicCommunitySlug\(.*\)$/,
  /^publicCommunitySlug\(.*\)$/,
]

/** file -> expressions that are public there, with the reason. */
const FILE_EXCEPTIONS = {
  // The route param: middleware 308s a durable or compound slug before render,
  // so `slug` inside the community route is the live door.
  'app/communities/[slug]/page.tsx': ['slug'],
  'app/communities/[slug]/_v3/community-metadata.ts': ['slug'],
  'app/communities/[slug]/types/[type]/page.tsx': ['slug'],
  // RESORT_COMMUNITY_SLUGS is getAllResortCommunities().map(publicCommunitySlug).
  'app/sitemap.ts': ['slug'],
  // Rewrites a path that is already a /communities/<x> door, keeping <x>.
  'lib/place/publish-place-type-cards.ts': ['communities[1]'],
  // The redirect resolver itself: its targets are the canonical slugs.
  'lib/communities/canonical-community-slug.ts': ['target', 'destSlug'],
  // Doc comment + the index browser default (callers pass publicSlug rows).
  'components/community/CommunityIndexBrowser.tsx': ['slug', 'item.slug'],
}

/** The one place allowed to build the path from a raw key. */
const OWNER = 'lib/communities/community-public-pair.ts'

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.|\.spec\./.test(name)) out.push(p)
  }
}

const files = []
for (const d of SCAN) walk(join(ROOT, d), files)

const RE = /\/communities\/\$\{([^}]+)\}/g
const violations = []
let scanned = 0
for (const abs of files) {
  const rel = relative(ROOT, abs).split('\\').join('/')
  if (rel === OWNER) continue
  // Admin surfaces are not crawled, but they link the public site; hold them too.
  const text = readFileSync(abs, 'utf8')
  if (!text.includes('/communities/${')) continue
  scanned++
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(RE)) {
      const expr = m[1].trim()
      if (PUBLIC_EXPRS.some((re) => re.test(expr))) continue
      if ((FILE_EXCEPTIONS[rel] ?? []).includes(expr)) continue
      violations.push({ file: rel, line: i + 1, expr, src: line.trim() })
    }
  })
}

if (REPORT || violations.length) {
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  /communities/\${${v.expr}}\n      ${v.src}`)
  }
}

if (violations.length) {
  console.error(
    `\nci:community-href-canonical: FAIL — ${violations.length} community link(s) interpolate a slug that is not\n` +
      '  provably the public one. A durable registry key (pronghorn) 308s; build the href with\n' +
      "  communityPath(key) from '@/lib/communities/community-public-pair', or, when the\n" +
      '  expression already IS the public slug, add it to FILE_EXCEPTIONS with the reason.',
  )
  process.exit(1)
}
console.log(`ci:community-href-canonical: OK — ${scanned} files build /communities/ links; every one names the live door.`)
