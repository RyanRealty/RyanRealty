#!/usr/bin/env node
/**
 * check-no-public-em-dash.mjs — ci:no-public-em-dash (SITE-145).
 *
 * Matt lock 2026-09-20: NEVER use em dashes (U+2014) in Ryan Realty public
 * site copy, headers, or captions. Prefer colon, period, comma, or rewrite.
 * Plain ` -- ` used as a dash is the same refuse.
 *
 * Scope (widened SITE-193, 2026-09-24): every place page tree (cities,
 * communities, subdivisions), both address answers (community ask and /sell),
 * the v3 barrel, lib/site and lib/place, with a shrink-only baseline
 * (scripts/no-public-em-dash-baseline.json) for the dashes those trees held
 * when they came in; before that, public new-construction + home/search string literals, including
 * the "Central Oregon right now" pulse in app/_v3/home-pulse.ts, plus the
 * SITE-149 residual paths (root titles, brand suffix, $/sqft aria, Bend /
 * neighborhood claim strings, web manifest). Comments in other files,
 * markdown docs, *.test.* files, console.* logs, and `new Error(...)` text
 * are out of scope. home-pulse.ts must also stay U+2014-free in comments
 * (SITE-145 Cos widen).
 *
 * Usage:
 *   node scripts/check-no-public-em-dash.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { walkFiles } from './lib/walk.mjs'

const EM = '\u2014'
const DOUBLE_HYPHEN_DASH = / -- /

const ROOTS = [
  'lib/site/bend-new-construction.ts',
  'app/new-construction',
  'app/page.tsx',
  'app/search',
  'app/_v3',
  'app/_v3/home-pulse.ts',
  // SITE-149 residual visitor strings the 2026-09-20 audit still found.
  'app/layout.tsx',
  'lib/site/page-metadata.ts',
  'components/search/ppsf-band.ts',
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/oregon/[city]/_v3/oregon-city-fold.ts',
  'app/invest/page.tsx',
  'app/invest/_v3/InvestInsight.client.tsx',
  'app/invest/_v3/invest-pulse.ts',
  'app/housing-market/central-oregon/_v3/RegionInsight.client.tsx',
  'app/housing-market/central-oregon/_v3/region-insight.ts',
  'app/housing-market/[...slug]/_v3/CityInsight.client.tsx',
  'app/housing-market/[...slug]/_v3/city-insight.ts',
  'app/zip/[zip]/page.tsx',
  'app/zip/[zip]/_v3/ZipHomesField.tsx',
  'app/zip/[zip]/_v3/ZipInsight.client.tsx',
  // Visibility audit PROCESS-7 (2026-09-23): ci:dog-floater and
  // ci:deliverable-share-safety each carried their own dash check. They were
  // removed so this gate is the one owner of Matt's 2026-09-20 lock, and the
  // two surfaces they guarded moved here: the dog floater's door labels and
  // the share captions a broker posts publicly.
  'components/site/v3/V3DogFloater.client.tsx',
  'lib/marketing-brain/deliverable-share.ts',
  // Commercial space for lease (Matt 2026-09-23): the page and its copy.
  'app/commercial-space-for-lease',
  // /about AEO playbook (Matt 2026-09-23): the page, the playbook copy, and the
  // five primitives it added. about-constants.ts is not listed: its
  // ABOUT_LOCK_QUOTES are lock evidence copied verbatim from source comments,
  // never rendered, and its FAQ answers are held by about-playbook.test.tsx.
  'app/about/page.tsx',
  'app/about/_v3/about-playbook.ts',
  'components/site/v3/V3Entries.tsx',
  'components/site/v3/V3Claims.tsx',
  'components/site/v3/V3Roll.tsx',
  'components/site/v3/V3Steps.tsx',
  'components/site/v3/V3Facts.tsx',
  // SITE-193 (2026-09-24): "5 comparable closes so far — too few to chart
  // honestly" reached the community valuation answer because this gate walked
  // a hand-kept list of files and neither the answer's shaper
  // (lib/site/answer-figures.ts) nor the community route was on it. It was not
  // a dynamic string the walker could not see: it was a template literal in a
  // file nobody listed. So the scope is now the trees public place copy and
  // the two address answers are written in, not files one at a time, and the
  // dashes those trees already held sit on a shrink-only baseline
  // (scripts/no-public-em-dash-baseline.json) instead of keeping them out of
  // scope. A NEW dash anywhere in these trees fails. lib/market came in with
  // the neighborhood door's trace ("listings — Active and Active Under
  // Contract, Coming Soon excluded — inside ..."), the same miss one tree over.
  'app/cities',
  'app/communities',
  'app/subdivisions',
  'app/sell',
  'components/site/v3',
  'lib/site',
  'lib/place',
  'lib/data/places',
  'lib/cma/place-comps.ts',
  'lib/market',
  // The market report a contact receives (Matt 2026-09-29): every report had
  // printed "—" for a missing value, including months of supply on every
  // neighborhood report. The renderer, its formatters, the branded shell and
  // its footer, and the no-login preferences page, its report web view, its
  // one-click answer, and the account page's market-report block. Its
  // controls primitive (components/site/v3/V3Controls.tsx) is walked with the
  // v3 tree above.
  'lib/crm/market-report-email.ts',
  'lib/crm/market-report-format.ts',
  'lib/email/shell.ts',
  'app/email-preferences',
  'app/api/email/report-unsubscribe/route.ts',
  'components/dashboard/DashboardNotificationPrefs.tsx',
]

/**
 * Dashes these trees held when they came into scope (SITE-193), per file. A
 * file may hold this many and no more; fix one and lower its number (or drop
 * the entry) in the same commit. Never raise a number to pass.
 */
const BASELINE_PATH = 'scripts/no-public-em-dash-baseline.json'

/** JSON the visitor can read; not walked as TypeScript. */
const JSON_FILES = ['public/manifest.json']

const SKIP_TEST = /\.(test|spec)\.(ts|tsx)$/
/** Cos SITE-145 widen: this pulse module may not hide U+2014 in comments. */
const WHOLE_FILE_CLEAN = ['app/_v3/home-pulse.ts']

function collectFiles() {
  const files = []
  for (const root of ROOTS) {
    if (!existsSync(root)) continue
    if (statSync(root).isDirectory()) {
      files.push(...walkFiles(root))
    } else {
      files.push(root)
    }
  }
  return [...new Set(files)]
    .filter((file) => !SKIP_TEST.test(file))
    .sort()
}

/**
 * @param {string} text
 * @param {number} pos
 * @param {ts.SourceFile} source
 * @param {string} rel
 * @param {string[]} fails
 */
function checkText(text, pos, source, rel, fails) {
  if (!text) return
  const { line } = source.getLineAndCharacterOfPosition(pos)
  const loc = `${rel}:${line + 1}`
  if (text.includes(EM)) {
    fails.push(`${loc}: U+2014 em dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
  if (DOUBLE_HYPHEN_DASH.test(text)) {
    fails.push(`${loc}: \` -- \` used as a dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
}

function isConsoleCallee(expr) {
  return ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'console'
}

function isErrorCtor(expr) {
  return ts.isIdentifier(expr) && expr.text === 'Error'
}

/** Logs and thrown Error() text are not public site copy. */
function skipPublicCopy(node) {
  if (ts.isCallExpression(node) && isConsoleCallee(node.expression)) return true
  if (ts.isNewExpression(node) && node.expression && isErrorCtor(node.expression)) return true
  if (ts.isCallExpression(node) && isErrorCtor(node.expression)) return true
  return false
}

/**
 * @param {ts.Node} node
 * @param {ts.SourceFile} source
 * @param {string} rel
 * @param {string[]} fails
 */
function visit(node, source, rel, fails) {
  if (skipPublicCopy(node)) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    checkText(node.text, node.getStart(source), source, rel, fails)
  } else if (ts.isTemplateExpression(node)) {
    checkText(node.head.text, node.head.getStart(source), source, rel, fails)
    for (const span of node.templateSpans) {
      checkText(span.literal.text, span.literal.getStart(source), source, rel, fails)
    }
  } else if (ts.isJsxText(node)) {
    checkText(node.getText(source), node.getStart(source), source, rel, fails)
  }
  ts.forEachChild(node, (child) => visit(child, source, rel, fails))
}

const files = collectFiles()
const fails = []

for (const file of files) {
  const code = readFileSync(file, 'utf8')
  const rel = relative(process.cwd(), file)
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, kind)
  visit(source, source, rel, fails)
}

for (const file of WHOLE_FILE_CLEAN) {
  if (!existsSync(file)) continue
  const code = readFileSync(file, 'utf8')
  if (code.includes(EM)) {
    fails.push(`${file}: U+2014 anywhere in this file, including comments. Rewrite with colon, period, or comma.`)
  }
}

for (const file of JSON_FILES) {
  if (!existsSync(file)) continue
  const code = readFileSync(file, 'utf8')
  const rel = relative(process.cwd(), file)
  if (code.includes(EM)) {
    fails.push(`${rel}: U+2014 em dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
  if (DOUBLE_HYPHEN_DASH.test(code)) {
    fails.push(`${rel}: \` -- \` used as a dash in public copy. Prefer colon, period, comma, or rewrite.`)
  }
}

console.log('public em-dash gate (ci:no-public-em-dash)')
console.log('=========================================')
console.log(`Scanned ${files.length} public source files + ${JSON_FILES.length} JSON`)

// The shrink-only baseline: a file's hits up to its recorded count are the
// debt it came into scope with; one more is a failure. A file under its count
// is reported so the number can come down in the same commit.
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {} : {}
const hitsByFile = new Map()
for (const fail of fails) {
  const file = /^(.+?\.(?:tsx|ts|mjs|json)):/.exec(fail)?.[1] ?? fail
  hitsByFile.set(file, [...(hitsByFile.get(file) ?? []), fail])
}
const shrunk = []
for (const [file, allowed] of Object.entries(baseline)) {
  const now = hitsByFile.get(file)?.length ?? 0
  if (now <= allowed) {
    fails.splice(0, fails.length, ...fails.filter((f) => !f.startsWith(`${file}:`)))
    if (now < allowed) shrunk.push(`${file}: ${now} now, baseline ${allowed}. Lower it in ${BASELINE_PATH}.`)
  }
}
if (shrunk.length > 0) {
  console.log(`\n${shrunk.length} baselined file(s) hold fewer dashes than recorded:`)
  for (const line of shrunk) console.log(`  ${line}`)
}

if (fails.length === 0) {
  console.log('\nOK: public string literals in scope have no U+2014 and no ` -- ` dash beyond the baseline.')
  process.exit(0)
}

console.log(`\n${fails.length} public em-dash / double-hyphen dash hit(s):`)
for (const fail of fails) console.log(`  ${fail}`)
console.log('\nMatt lock 2026-09-20: never use em dashes in public site copy, headers, or captions.')
process.exit(1)
