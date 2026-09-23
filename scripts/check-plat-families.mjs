#!/usr/bin/env node
/**
 * check-plat-families.mjs — `npm run ci:plat-families`.
 *
 * Matt 2026-09-23: "When there are multiple phases in a subdivision, we want
 * all those to go into the same main neighborhood page, and then they can jump
 * into the different phases after that. ... we just want to make sure that that
 * grouping is always happening." (visibility audit 2026-09-22: SEO-7, SEO-4,
 * EXP-3, VOICE-8, gsc-trend-4.)
 *
 * The grouping itself is locked by lib/market/plat-family.lock.test.ts, which
 * runs the family rule over every recorded plat (the 3,427-plat snapshot beside
 * it) and fails when a multi-phase group has no single main page. A lock on the
 * rule is not a lock on the PAGES: a refactor can keep every test green and
 * still stop rendering the link up, drop the phase list, or unhook the
 * directory. This gate fails when any wire between the rule and the served
 * HTML is cut:
 *
 *   1. the rule and its lock exist (derivePlatFamilies, platBaseGroups, the
 *      full-snapshot invariant test and its fixture);
 *   2. a PHASE page links up: the visible family line is a real <a href> to the
 *      family's main page, the family crumb is in the visible trail AND the
 *      JSON-LD, and the title is the subordinate one (platDocumentTitle);
 *   3. a FAMILY page lists every phase (#phases, familyPhaseEntries) and is
 *      indexable through the family-aware indexable set;
 *   4. a COMMUNITY page lists its own family's phases and links down to the
 *      families inside it;
 *   5. /subdivisions renders the whole directory (V3PlaceDirectory built from
 *      the indexable set and the families), and the city/community rail keeps
 *      its crawlable door;
 *   6. docs/plans/PUBLIC_PRODUCT/PLACE_PAGES.md carries the contract.
 *
 * Static, secret-less: it reads source files only.
 *
 * Usage: node scripts/check-plat-families.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const GATE = 'ci:plat-families'

/** Source with block, JSX and line comments removed, so a wire named only in a comment does not count. */
function code(rel) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function raw(rel) {
  const path = join(ROOT, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** [file, description, predicate over the file's code] */
const WIRES = [
  // 1. The rule and its lock.
  ['lib/market/plat-family.ts', 'exports derivePlatFamilies', (s) => /export function derivePlatFamilies\(/.test(s)],
  ['lib/market/plat-family.ts', 'exports platBaseGroups (the invariant\'s view of every multi-plat group)', (s) => /export function platBaseGroups\(/.test(s)],
  ['lib/market/plat-family.ts', 'exports platFamilyRole', (s) => /export function platFamilyRole\(/.test(s)],
  ['lib/market/plat-family.ts', 'exports familiesNestedInCommunity', (s) => /export function familiesNestedInCommunity\(/.test(s)],
  [
    'lib/market/plat-family.lock.test.ts',
    'runs the no-orphan invariant over the full recorded-plat snapshot',
    (s) =>
      /plat-family-recorded\.json/.test(s) &&
      /platBaseGroups\(/.test(s) &&
      /every multi-plat group has a family with a main page/.test(s),
  ],
  [
    'lib/data/subdivisions/getPlatFamilies.ts',
    'feeds derivePlatFamilies from the live recorded plats, closed counts and MLS names',
    (s) => /derivePlatFamilies\(/.test(s) && /getRecordedPlatTree\(\)/.test(s) && /getPlatClosedCounts\(\)/.test(s),
  ],

  // 2. A phase page links up.
  [
    'app/subdivisions/[slug]/page.tsx',
    'reads the families and this URL\'s role in them',
    (s) => /getPlatFamilies\(\)/.test(s) && /platFamilyRole\(\s*families\s*,\s*slug\s*\)/.test(s),
  ],
  [
    'app/subdivisions/[slug]/page.tsx',
    'renders the visible link up as a real anchor (familyMemberLine -> <a href={familyLine.href}>)',
    (s) => /familyMemberLine\(\s*familyRole\s*\)/.test(s) && /<a\s+href=\{familyLine\.href\}/.test(s),
  ],
  [
    'app/subdivisions/[slug]/page.tsx',
    'puts the family in the visible breadcrumb (withFamilyCrumb) and the JSON-LD breadcrumb',
    (s) => /withFamilyCrumb\(/.test(s) && /url:\s*familyUp\.href/.test(s),
  ],
  [
    'app/subdivisions/[slug]/page.tsx',
    'titles a phase as part of its family (platDocumentTitle in generateMetadata)',
    (s) => /title:\s*platDocumentTitle\(/.test(s),
  ],
  [
    'app/subdivisions/[slug]/_v3/plat-family-view.ts',
    'points the phase line and the crumb at the family main page',
    (s) => (s.match(/href:\s*role\.family\.mainHref/g) ?? []).length >= 2,
  ],

  // 3. A family page lists every phase.
  [
    'app/subdivisions/[slug]/page.tsx',
    'renders every phase on the family page (#phases, familyPhaseEntries(headFamily))',
    (s) => /id="phases"/.test(s) && /familyPhaseEntries\(\s*headFamily\s*\)/.test(s),
  ],
  [
    'lib/data/subdivisions/getIndexableSubdivisions.ts',
    'builds the indexable set with the family heads and the reserved place slugs',
    (s) => /buildIndexableSubdivisions\([\s\S]*?families[\s\S]*?\)/.test(s) && /reservedSlugs:\s*reservedPlaceSlugs\(/.test(s),
  ],

  // 4. A community page links its phases and the families inside it.
  [
    'app/communities/[slug]/page.tsx',
    'lists its own family\'s phases and links down to nested families in the rail',
    (s) =>
      /getPlatFamilies\(\)/.test(s) &&
      /familiesNestedInCommunity\(/.test(s) &&
      /extras:[^\n]*\.\.\.nestedFamilyDoors[^\n]*\.\.\.familyPhaseDoors/.test(s),
  ],

  // 5. The directory and the rail door.
  [
    'app/subdivisions/page.tsx',
    'renders the whole A to Z directory from the indexable set and the families',
    (s) =>
      /<V3PlaceDirectory\b/.test(s) &&
      /buildSubdivisionDirectory\(\s*\{\s*indexable:\s*indexablePlats\s*,\s*families:\s*platFamilies\s*\}\s*\)/.test(s) &&
      /getIndexableSubdivisions\(\)/.test(s) &&
      /getPlatFamilies\(\)/.test(s),
  ],
  [
    'app/subdivisions/_v3/subdivision-directory.ts',
    'nests each family\'s phases under its main page',
    (s) => /href:\s*family\.mainHref/.test(s) && /children:\s*phases\.map\(/.test(s),
  ],
  [
    'components/site/v3/PlaceSubdivisionMap.client.tsx',
    'gives every rail row with a page a crawlable <Link href={entry.href}> door',
    (s) => /<Link\s+className="place-subdiv-rail__open"\s+href=\{entry\.href\}/.test(s),
  ],
]

const failures = []
for (const [file, what, test] of WIRES) {
  const src = code(file)
  if (src == null) {
    failures.push(`${file}: missing (${what})`)
    continue
  }
  if (!test(src)) failures.push(`${file}: ${what}`)
}

// The fixture the invariant runs over must be the whole recorded set, not a sample.
const fixture = raw('lib/market/__fixtures__/plat-family-recorded.json')
if (fixture == null) {
  failures.push('lib/market/__fixtures__/plat-family-recorded.json: missing (the full recorded-plat snapshot)')
} else {
  try {
    const plats = JSON.parse(fixture).plats
    if (!Array.isArray(plats) || plats.length < 3000) {
      failures.push(`lib/market/__fixtures__/plat-family-recorded.json: holds ${plats?.length ?? 0} plats; the lock needs the whole recorded set (3,427 on 2026-09-23)`)
    }
  } catch (e) {
    failures.push(`lib/market/__fixtures__/plat-family-recorded.json: not JSON (${e.message})`)
  }
}

// 6. The contract.
const doc = raw('docs/plans/PUBLIC_PRODUCT/PLACE_PAGES.md')
if (doc == null || !/^## Subdivision families\b/m.test(doc)) {
  failures.push('docs/plans/PUBLIC_PRODUCT/PLACE_PAGES.md: the "## Subdivision families" contract section is missing')
}

if (failures.length) {
  console.error(`${GATE} FAILED: a multi-phase subdivision must have one main page, and every phase must link to it (Matt 2026-09-23)\n`)
  for (const f of failures) console.error(`  x ${f}`)
  console.error('\nSee docs/plans/PUBLIC_PRODUCT/PLACE_PAGES.md "Subdivision families".')
  process.exit(1)
}

console.log(
  `${GATE}: OK. ${WIRES.length} wires hold: families derived and locked over every recorded plat, phases link up, family pages list every phase, communities link down, /subdivisions is the whole directory.`,
)
