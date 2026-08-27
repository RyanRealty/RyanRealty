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
//
//    THE RULE IS ABOUT PUBLISHING A PER-RESORT FIGURE, NOT ABOUT OWNING A
//    LEDGER. The defect this arm was written for is a resort count that
//    undercounts because it matched the literal subdivision name (Widgi Creek
//    0 or 28 against a true 48), and that defect only exists on a page that
//    PRINTS a per-resort count. So the wiring assertions below run when the
//    city page prints one, and the membership assertion below runs always.
//
//    app/cities/[slug]/page.tsx stopped printing one on 2026-08-12, when the
//    route moved to the components/site/v3 barrel (P9 Places family). The
//    golf and master-planned LEDGER left with that migration: PUBLIC_UI.md's
//    rhythm rule caps a page at four of the six patterns, the city node's four
//    are Instrument, Field, Sheet and Quiet, and V3Quiet's contract puts a
//    number in an Instrument with its source line rather than in a supporting
//    block. Each resort's live count now renders on that resort's own node,
//    under that node's own trace, and section 2b below still holds it to the
//    alias-aware path. See design_system/ryan-realty/ui_kits/city/parity.json.
//
//    This arm is deliberately NOT left to self-release by scope: a gate that
//    silently stops applying is how a regression ships (docs/plans/
//    PUBLIC_PRODUCT/gate-contracts.md §3.11). The predicate is explicit, the
//    membership rule below keeps the arm doing work on the migrated page, and
//    the day the city page prints a resort count again the four wiring tokens
//    are demanded again with no edit here.
// ──────────────────────────────────────────────────────────────────────────
let cityPageSrc = ''
try {
  cityPageSrc = readFileSync(CITY_PAGE, 'utf8')
} catch (e) {
  fails.push(`${CITY_PAGE}: cannot read city page (${e.message})`)
}

if (cityPageSrc) {
  // Does the page publish a per-resort figure? Any of these three is that claim:
  // the alias-aware counter, the map it returns, or the snapshot fallback the
  // ledger used when the counter had no entry.
  const publishesResortFigure =
    /\bresortActiveSfrCounts\b/.test(cityPageSrc) ||
    /\bresortSfrCounts\b/.test(cityPageSrc) ||
    /\bcommunitySfrBySlug\b/.test(cityPageSrc)

  if (publishesResortFigure) {
    const required = [
      // alias-aware count call, with the resortTiles argument
      { token: 'resortActiveSfrCounts(slug, resortTiles)', why: 'alias-aware active-SFR count' },
      // the paginated uncapped fetch (Bend > 1000 rows)
      { token: 'fetchAllCityActiveSfr', why: 'paginated uncapped active-SFR fetch' },
      // golf-ledger membership source
      { token: 'cityResorts(slug)', why: 'golf-ledger resort membership' },
      // hover photo map lookup
      { token: 'CITY_RESORT_LEDGER_IMG[', why: 'resort hover photos' },
    ]
    for (const { token, why } of required) {
      if (!cityPageSrc.includes(token)) {
        fails.push(`${CITY_PAGE}: missing "${token}" (§0 ${why}) — the resort count/ledger/photos are not wired`)
      }
    }
  }

  // ALWAYS, whether the page prints a resort figure or only a resort door:
  // membership and destination both come from the registry, never from slugs
  // typed into the page. A hand-typed community URL drifts the moment the
  // registry gains, loses, or renames a resort, which is the same class of
  // defect as the literal-name count one level up.
  if (/\bcityResorts\s*\(/.test(cityPageSrc) && !cityPageSrc.includes('cityResorts(slug)')) {
    fails.push(
      `${CITY_PAGE}: calls cityResorts() with something other than the route's own \`slug\` — resort membership must be scoped to the city being rendered`,
    )
  }
  const hardCodedCommunityUrl = /['"\`]\/communities\/[a-z0-9-]+/i.exec(cityPageSrc)
  if (hardCodedCommunityUrl) {
    fails.push(
      `${CITY_PAGE}: hard-codes the community URL "${hardCodedCommunityUrl[0].slice(1)}" — resolve every community destination through getPlaceLinks({ type: 'community', … }) so one registry rename moves every link`,
    )
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
    // The canonical-slug hop is NOT an in-page redirect any more: a redirect
    // thrown after loading.tsx flushed serves 200 with no Location header
    // (measured 2026-08-19, 91 of 104 compound slugs), so the hop moved to
    // middleware. The wiring is asserted below on the files that own it now.
    { token: 'getResortCommunityContent(', why: 'rich resort content (amenities/golf/membership/builders) fetch' },
  ]
  for (const { token, why } of required) {
    if (!commPageSrc.includes(token)) {
      fails.push(`${COMMUNITY_PAGE}: missing "${token}" (§0 ${why}) — the resort community wiring is incomplete`)
    }
  }

  // Compound resort slug → canonical bare slug, as a PRE-RENDER hop: the
  // resolver must exist and middleware must consult it before anything
  // streams. An in-page redirect() here is the regression D96 forbids.
  let hopsSrc = ''
  try {
    hopsSrc = readFileSync('lib/routing/pre-render-hops.ts', 'utf8')
  } catch (e) {
    fails.push(`lib/routing/pre-render-hops.ts: cannot read (${e.message})`)
  }
  let middlewareSrc = ''
  try {
    middlewareSrc = readFileSync('middleware.ts', 'utf8')
  } catch (e) {
    fails.push(`middleware.ts: cannot read (${e.message})`)
  }
  if (hopsSrc && !/resolveCanonicalCommunityPath/.test(hopsSrc)) {
    fails.push(
      `lib/routing/pre-render-hops.ts: missing resolveCanonicalCommunityPath — a compound resort slug would render a duplicate undercounted page`,
    )
  }
  if (middlewareSrc && !/resolvePreRenderHop\(/.test(middlewareSrc)) {
    fails.push(
      `middleware.ts: does not consult resolvePreRenderHop — the community canonical hop never runs`,
    )
  }

  // The page must RENDER the rich resort content, not merely hold it — owner
  // directive: "every resort/golf/planned community needs an overview section…
  // amenities." That rule is about the content reaching the reader, so it is
  // spelled here as "the fetched config feeds a renderer", not as one component
  // name. The KB register spelled it <KbResortOverview content={…}>; the v3
  // register (P9, 2026-08-12) spells it buildPlaceKnowledge({ content: … }), the
  // route-local builder that turns the SAME config into the rendered knowledge
  // rows — overview prose, at-a-glance, drive times, amenities by category, the
  // course, membership, builders. A page that fetches the config and renders
  // nothing still fails, which is the whole defect this arm exists to catch.
  // See design_system/ryan-realty/ui_kits/community/parity.json.
  const rendersResortContent =
    /\bKbResortOverview\b/.test(commPageSrc) || /\bbuildPlaceKnowledge\s*\(/.test(commPageSrc)
  if (!rendersResortContent) {
    fails.push(
      `${COMMUNITY_PAGE}: fetches the resort config but renders it nowhere — pass it to a renderer (<KbResortOverview content={…}> on the KB register, buildPlaceKnowledge({ content: … }) on the v3 register)`,
    )
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
// 4. RESORT_IMG COVERAGE (WARNING) — and the map must EXIST while it is USED.
//    A half-declared map is the defect: a page that looks up RESORT_IMG[slug]
//    with no declaration, or with a declaration missing a Bend resort, renders
//    an empty hover photo for that resort. So the declaration is a hard fail
//    whenever the page reads from the map, and the per-slug coverage stays a
//    WARNING so adding a resort to the registry never hard-breaks the build.
//
//    A page that renders no resort imagery at all is a different thing from a
//    page that renders it wrongly, and only the second is what this arm exists
//    to catch. app/cities/[slug]/page.tsx stopped rendering resort hover photos
//    on 2026-08-12 with the golf ledger, when the route moved to the
//    components/site/v3 barrel (see the note in section 2 above and
//    design_system/ryan-realty/ui_kits/city/parity.json). The declaration is
//    demanded again the moment the page reads the map again, with no edit here.
//
//    app/communities/[slug]/page.tsx stopped rendering resort hover photos the
//    same day and for the same reason: RESORT_IMG fed a rail of OTHER resorts,
//    and the v3 community node has no such rail (the rhythm rule caps that page
//    at four of the six patterns and Ledger is not one of its four). So the
//    community page moved from section 2b's hard-required token list into this
//    conditional arm — the rule is MOVED, not dropped: read the map on either
//    page and the declaration plus its Bend coverage are demanded again.
// ──────────────────────────────────────────────────────────────────────────
for (const [pagePath, pageSrc] of [
  [CITY_PAGE, cityPageSrc],
  [COMMUNITY_PAGE, commPageSrc],
]) {
  if (!pageSrc || !pageSrc.includes('RESORT_IMG[')) continue
  const declMatch = pageSrc.match(/const\s+RESORT_IMG[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!declMatch) {
    fails.push(`${pagePath}: reads RESORT_IMG[...] but the map declaration is missing entirely`)
  } else if (registry) {
    const mapBody = declMatch[1]
    const bendResortSlugs = (registry.communities ?? []).filter((c) => c?.is_resort === true && c.city_slug === 'bend').map((c) => c.slug)
    const uncovered = bendResortSlugs.filter((slug) => {
      // a key may be bare (vandevert-ranch:) or quoted ('broken-top':)
      const keyRe = new RegExp(`(^|[\\s{,])(['"\`]?)${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\2\\s*:`, 'm')
      return !keyRe.test(mapBody)
    })
    for (const slug of uncovered) {
      warnings.push(`${pagePath}: Bend resort "${slug}" has no RESORT_IMG key (hover photo falls back to community/empty)`)
    }
  }
}

const CITY_RESORT_IMG = 'lib/kb/city-page-config.ts'
const cityResortImgSrc = readFileSync(CITY_RESORT_IMG, 'utf8')
if (cityPageSrc.includes('CITY_RESORT_LEDGER_IMG[')) {
  const declMatch = cityResortImgSrc.match(/export const\s+CITY_RESORT_LEDGER_IMG[^=]*=\s*\{([\s\S]*?)\n\}/)
  if (!declMatch) {
    fails.push(`${CITY_PAGE}: reads CITY_RESORT_LEDGER_IMG[...] but ${CITY_RESORT_IMG} has no map declaration`)
  } else if (registry) {
    const mapBody = declMatch[1]
    const bendResortSlugs = (registry.communities ?? [])
      .filter((c) => c?.is_resort === true && c.city_slug === 'bend')
      .map((c) => c.slug)
    for (const slug of bendResortSlugs) {
      const keyRe = new RegExp(`(^|[\\s{,])(['"\`]?)${slug.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\2\\s*:`, 'm')
      if (!keyRe.test(mapBody)) {
        warnings.push(`${CITY_RESORT_IMG}: Bend resort "${slug}" has no CITY_RESORT_LEDGER_IMG key (hover photo falls back to community/empty)`)
      }
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
