#!/usr/bin/env node
/**
 * G53 — Resort/golf/master-planned community DEFINITION lock (Matt directive
 * 2026-06-17: "these pages must be locked in").
 *
 * The golf/resort/master-planned community pages are built on hard-won spatial
 * data work: a curated registry (data/resort-communities.json) whose
 * subdivision_aliases + center/radius are the only thing that makes the
 * alias-aware active-SFR count correct (Widgi 0 vs true 48, Tetherow 14 vs true
 * 55). That count, the golf ledger, and the hover photos are all wired into the
 * city page via a small set of §0 helpers. Any of these can silently regress:
 *   - a registry edit drops an alias array, center, radius, or city_slug
 *   - a refactor renames/removes resortActiveSfrCounts / cityResorts / the
 *     uncapped fetch / RESORT_IMG on the city page
 *   - cityResorts stops filtering is_resort===true and the ledger over-matches
 *
 * This gate makes the definitions self-enforcing so the work can never quietly
 * unravel. It asserts FOUR things (the first three are hard fails; RESORT_IMG
 * coverage is a warning so adding a resort never hard-breaks the build):
 *   1. Registry integrity — every is_resort entry carries the spatial truth.
 *   2. Alias-aware count wired into app/cities/[slug]/page.tsx.
 *   3. Helper contract in lib/kb/resort-active-counts.ts.
 *   4. RESORT_IMG coverage (warning) — but RESORT_IMG itself must exist.
 *
 * Usage: node scripts/check-resort-definitions.mjs
 */
import { readFileSync } from 'node:fs'

const REGISTRY = 'data/resort-communities.json'
const CITY_PAGE = 'app/cities/[slug]/page.tsx'
const COMMUNITY_PAGE = 'app/communities/[slug]/page.tsx'
const HELPER = 'lib/kb/resort-active-counts.ts'

const fails = []
const warnings = []

// ──────────────────────────────────────────────────────────────────────────
// 1. RESORT REGISTRY INTEGRITY
//    Every is_resort===true community must carry the full spatial definition:
//    a non-empty subdivision_aliases array, a [lon,lat] center pair, a numeric
//    broad_radius_km, and a city_slug. These four are exactly what the
//    alias-aware count + map fall back on; drop any and a resort silently
//    undercounts or vanishes.
// ──────────────────────────────────────────────────────────────────────────
let registry
try {
  registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
} catch (e) {
  fails.push(`${REGISTRY}: cannot read/parse registry (${e.message})`)
}

const resortSlugs = [] // is_resort===true slugs, for the RESORT_IMG coverage check
if (registry) {
  const communities = Array.isArray(registry.communities) ? registry.communities : null
  if (!communities) {
    fails.push(`${REGISTRY}: missing or non-array "communities"`)
  } else {
    for (const c of communities) {
      if (c?.is_resort !== true) continue
      const id = c.slug ? `"${c.slug}"` : '(slug missing)'
      resortSlugs.push(c.slug)

      // subdivision_aliases: non-empty array of non-empty strings.
      if (
        !Array.isArray(c.subdivision_aliases) ||
        c.subdivision_aliases.length === 0 ||
        !c.subdivision_aliases.every((a) => typeof a === 'string' && a.trim().length > 0)
      ) {
        fails.push(`${REGISTRY}: resort ${id} has no non-empty subdivision_aliases array`)
      }

      // center_lon_lat: [lon, lat] numeric pair.
      if (
        !Array.isArray(c.center_lon_lat) ||
        c.center_lon_lat.length !== 2 ||
        !c.center_lon_lat.every((n) => typeof n === 'number' && Number.isFinite(n))
      ) {
        fails.push(`${REGISTRY}: resort ${id} has no valid center_lon_lat [lon,lat] number pair`)
      }

      // broad_radius_km: finite number > 0.
      if (typeof c.broad_radius_km !== 'number' || !Number.isFinite(c.broad_radius_km) || c.broad_radius_km <= 0) {
        fails.push(`${REGISTRY}: resort ${id} has no positive numeric broad_radius_km`)
      }

      // city_slug: non-empty string (the alias-aware count buckets by city).
      if (typeof c.city_slug !== 'string' || c.city_slug.trim().length === 0) {
        fails.push(`${REGISTRY}: resort ${id} has no non-empty city_slug`)
      }
    }
    if (resortSlugs.length === 0) {
      fails.push(`${REGISTRY}: no is_resort===true communities found — the registry is empty or mis-flagged`)
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2. ALIAS-AWARE COUNT WIRED into the city page (the §0 fixes).
//    The city page must reference each of these tokens, or the golf ledger
//    falls back to undercounted literal-name snapshot numbers / loses photos.
// ──────────────────────────────────────────────────────────────────────────
let cityPageSrc = ''
try {
  cityPageSrc = readFileSync(CITY_PAGE, 'utf8')
} catch (e) {
  fails.push(`${CITY_PAGE}: cannot read city page (${e.message})`)
}

if (cityPageSrc) {
  const required = [
    // alias-aware count call, with the resortTiles argument
    { token: 'resortActiveSfrCounts(slug, resortTiles)', why: 'alias-aware active-SFR count' },
    // the paginated uncapped fetch (Bend > 1000 rows)
    { token: 'fetchAllCityActiveSfr', why: 'paginated uncapped active-SFR fetch' },
    // golf-ledger membership source
    { token: 'cityResorts(slug)', why: 'golf-ledger resort membership' },
    // hover photo map lookup
    { token: 'RESORT_IMG[', why: 'resort hover photos' },
  ]
  for (const { token, why } of required) {
    if (!cityPageSrc.includes(token)) {
      fails.push(`${CITY_PAGE}: missing "${token}" (§0 ${why}) — the resort count/ledger/photos are not wired`)
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2b. COMMUNITY PAGE WIRING — app/communities/[slug]/page.tsx.
//     A resort community page must use the SAME alias-aware count AND resolve its
//     map/featured/ticker from the resort's alias-matched tiles (the literal-name
//     query misses ~all of an alias-heavy resort like Widgi Creek), and must
//     canonicalize a compound resort slug to the bare slug. Without these the
//     community hero would publish the literal-name undercount + show no listings.
// ──────────────────────────────────────────────────────────────────────────
let commPageSrc = ''
try {
  commPageSrc = readFileSync(COMMUNITY_PAGE, 'utf8')
} catch (e) {
  fails.push(`${COMMUNITY_PAGE}: cannot read community page (${e.message})`)
}
if (commPageSrc) {
  const required = [
    { token: 'resortActiveSfrCounts(', why: 'alias-aware active-SFR count (matches the city ledger)' },
    { token: 'resortTilesForSlug(', why: 'alias-matched listings for the map/featured/ticker' },
    { token: 'cityResorts(', why: 'resort membership (is_resort filter)' },
    { token: 'isBoundaryReliable(', why: 'oversized-boundary guard (no bloated polygon/count)' },
    { token: 'RESORT_IMG', why: 'resort hover/banner photos' },
    { token: 'redirect(', why: 'compound resort slug → canonical bare slug (no duplicate undercounted page)' },
  ]
  for (const { token, why } of required) {
    if (!commPageSrc.includes(token)) {
      fails.push(`${COMMUNITY_PAGE}: missing "${token}" (§0 ${why}) — the resort community wiring is incomplete`)
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 3. HELPER CONTRACT — lib/kb/resort-active-counts.ts.
//    Must export the three §0 helpers, and cityResorts must filter
//    is_resort===true (so Three Rivers and other is_resort:false rows never
//    enter the ledger / over-match unrelated city homes).
// ──────────────────────────────────────────────────────────────────────────
let helperSrc = ''
try {
  helperSrc = readFileSync(HELPER, 'utf8')
} catch (e) {
  fails.push(`${HELPER}: cannot read helper (${e.message})`)
}

if (helperSrc) {
  for (const fn of ['resortActiveSfrCounts', 'cityResorts', 'resortLabelToSlug']) {
    const exported = new RegExp(`export\\s+(?:async\\s+)?function\\s+${fn}\\b`).test(helperSrc)
    if (!exported) fails.push(`${HELPER}: does not export ${fn}()`)
  }
  // cityResorts must filter is_resort===true. Tolerant of spacing.
  if (!/is_resort\s*===\s*true/.test(helperSrc)) {
    fails.push(`${HELPER}: cityResorts no longer filters is_resort===true — non-resort rows can pollute the golf ledger`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 4. RESORT_IMG COVERAGE (WARNING) — but the map must EXIST.
//    Removing RESORT_IMG entirely is a hard fail (handled by check #2's
//    `RESORT_IMG[` token). Here we additionally require the declaration to
//    exist, then WARN (not fail) for any Bend is_resort slug missing a key, so
//    adding a new resort to the registry never hard-breaks the build.
// ──────────────────────────────────────────────────────────────────────────
if (cityPageSrc) {
  const declMatch = cityPageSrc.match(/const\s+RESORT_IMG[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!declMatch) {
    fails.push(`${CITY_PAGE}: RESORT_IMG map declaration is missing entirely`)
  } else if (registry) {
    const mapBody = declMatch[1]
    const bendResortSlugs = (registry.communities ?? []).filter((c) => c?.is_resort === true && c.city_slug === 'bend').map((c) => c.slug)
    const uncovered = bendResortSlugs.filter((slug) => {
      // a key may be bare (vandevert-ranch:) or quoted ('broken-top':)
      const keyRe = new RegExp(`(^|[\\s{,])(['"\`]?)${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\2\\s*:`, 'm')
      return !keyRe.test(mapBody)
    })
    for (const slug of uncovered) {
      warnings.push(`${CITY_PAGE}: Bend resort "${slug}" has no RESORT_IMG key (hover photo falls back to community/empty)`)
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────────────────────
console.log('Resort/golf definition lock (G53)')
console.log('=================================')
console.log(`${resortSlugs.length} is_resort community(ies) checked.\n`)

if (warnings.length) {
  console.log('⚠ WARNINGS (non-blocking):')
  for (const w of warnings) console.log('  • ' + w)
  console.log('')
}

if (fails.length) {
  console.error('✗ Resort definitions regressed:\n')
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  These pages are LOCKED (Matt directive 2026-06-17). The registry carries the\n' +
      '  spatial truth (aliases + center + radius + city_slug); the city page wires the\n' +
      '  alias-aware count + golf ledger + hover photos; lib/kb/resort-active-counts.ts\n' +
      '  exports the §0 helpers and filters is_resort===true.\n' +
      '  Source of truth: data/resort-communities.json. See CLAUDE.md §0 (Data Accuracy).',
  )
  process.exit(1)
}

console.log('Resort registry carries full spatial definitions; the alias-aware count,')
console.log('golf ledger, and hover photos are wired; the §0 helper contract holds.')
process.exit(0)
