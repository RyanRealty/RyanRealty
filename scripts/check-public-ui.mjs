#!/usr/bin/env node
/**
 * check-public-ui.mjs - the PUBLIC UI RATCHET (P9, PUBLIC-PRODUCT-OS.md).
 *
 * WHY THIS EXISTS
 * Five design languages coexist on the public site today. Nothing stopped a
 * sixth, because nothing counted. This gate counts, and the counts may only go
 * down. It is the mechanical half of the P9 roll: each family that migrates to
 * components/site/v3 lowers a number, and the lowered number is committed back
 * as the new ceiling.
 *
 * WHAT COUNTS AS A REGISTER
 * A "register" is a body of components carrying one visual language and one
 * token layer. Five are measured, exactly the five named in the constitution's
 * gate spec:
 *
 *   kb         components/site/kb/*            the kinetic-brutalist register
 *   legacy     components/site/<File>          the flat files directly under
 *                                              components/site (site-v2 era)
 *   primitives components/site/primitives/*    the typography primitive set
 *   explore    components/site/explore/*       the explore-graph register
 *   v3         components/site/v3              THE DESTINATION, not debt
 *
 * Everything else under components/site (sell, listing-detail, analytics, nav,
 * providers, golf, experience) is out of this gate's frame by design: the P9
 * spec names five registers and the seeded numbers must mean exactly what the
 * spec says they mean. Widening the register map is a P10 decision, and it
 * re-seeds every number, so it is a deliberate act with a diff, not a drift.
 *
 * THE THREE RATCHETED NUMBERS
 *   A. nonV3ImportSites  every import declaration on a public page that reaches
 *      a non-v3 register. Import SITES, not distinct registers: a page pulling
 *      six kb files is six pieces of debt to unwind, not one.
 *   B. legacyPages       public pages importing at least one non-v3 register
 *      and zero v3. The pages the roll has not reached yet.
 *   C. mixedPages        public pages importing BOTH v3 and a non-v3 register.
 *      Mid-migration pages. Two languages on one page is the exact defect this
 *      rebuild exists to end, so this number must reach zero, and a roll that
 *      raises it has traded one defect for a worse one.
 *
 * THE NEW-PAGE RULE
 * Totals alone would let a brand-new page arrive on an old register as long as
 * some other page shrank more that day. That is precisely how a sixth language
 * gets added. So: a public page absent from the baseline's knownPages list that
 * imports any non-v3 register fails immediately, whatever the totals did. New
 * public surfaces are built from the barrel or they are not built.
 *
 * SCOPE
 * app/**\/page.tsx, minus app/admin (its own ratchet, ci:admin-ui), app/api,
 * app/dev (prototypes are where a language is allowed to be tried), and the
 * four auth-internal routes, which are sign-in machinery rather than public
 * product surfaces. Direct imports on the page file only. Transitive debt is
 * real but it is the migrated component's problem, and counting it twice would
 * make a single fix move the number by an amount nobody can predict.
 *
 * DETECTION IS AST ONLY
 * The TypeScript compiler, reading module specifiers off ImportDeclaration,
 * ExportDeclaration, and dynamic import() call expressions. Never a text scan:
 * this repo has twice shipped a gate that fired on its own explanatory comment,
 * and this file names all five registers in prose above. It also means the
 * next/dynamic escape hatch is closed rather than invisible.
 *
 * RE-SEEDING IS SHRINK-ONLY TOO, FOR THE TWO RATCHETED NUMBERS
 * A ratchet whose re-seed command quietly raises every ceiling is not a ratchet.
 * --write-baseline refuses to write an A or a B larger than the one it replaces.
 * Loosening one of those ceilings is a real decision, so it costs an explicit
 * --allow-growth and shows up in the diff as what it is. C is recorded, not
 * guarded, for the reason the RATCHETED constant below states in full.
 *
 * Usage:
 *   node scripts/check-public-ui.mjs                    # check (CI + local)
 *   node scripts/check-public-ui.mjs --write-baseline   # re-seed after a roll
 *   node scripts/check-public-ui.mjs --write-baseline --allow-growth
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const BASELINE_PATH = 'scripts/public-ui-baseline.json'
const WRITE = process.argv.includes('--write-baseline')
const ALLOW_GROWTH = process.argv.includes('--allow-growth')

/** Directories whose page.tsx files are not public product surfaces. */
const EXCLUDED_DIRS = ['app/admin/', 'app/api/', 'app/dev/']

/** Sign-in machinery, not public product surfaces. */
const AUTH_INTERNAL = new Set([
  'app/login/page.tsx',
  'app/signup/page.tsx',
  'app/forgot-password/page.tsx',
  'app/auth-error/page.tsx',
])

const SITE_PREFIX = 'components/site/'
const REGISTERS = ['kb', 'legacy', 'primitives', 'explore', 'v3']
const NON_V3 = REGISTERS.filter((r) => r !== 'v3')

/** Recursively collect page.tsx files under app/. */
function pageFiles(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) pageFiles(rel, out)
    else if (entry.name === 'page.tsx') out.push(rel)
  }
  return out
}

const isPublic = (rel) =>
  !EXCLUDED_DIRS.some((d) => rel.startsWith(d)) && !AUTH_INTERNAL.has(rel)

const dirCache = new Map()
function isDirectory(relPath) {
  if (!dirCache.has(relPath)) {
    const abs = join(ROOT, relPath)
    dirCache.set(relPath, existsSync(abs) && statSync(abs).isDirectory())
  }
  return dirCache.get(relPath)
}

/**
 * Map a module specifier to one of the five registers, or null.
 * Handles the @/ alias and relative specifiers; a relative path is how the
 * kb register already reaches one page today, so a prefix test on the alias
 * alone would undercount.
 */
function classify(spec, importerRel) {
  let repoPath
  if (spec.startsWith('@/')) {
    repoPath = spec.slice(2)
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    repoPath = relative(ROOT, resolve(ROOT, dirname(importerRel), spec))
  } else {
    return null
  }
  repoPath = repoPath.split(sep).join('/')
  if (!repoPath.startsWith(SITE_PREFIX)) return null
  const rest = repoPath.slice(SITE_PREFIX.length)
  if (!rest) return null
  const segments = rest.split('/')
  const head = segments[0]
  if (head === 'kb') return 'kb'
  if (head === 'explore') return 'explore'
  if (head === 'primitives') return 'primitives'
  if (head === 'v3') return 'v3'
  // A single segment that is not one of the register directories is a flat
  // legacy file (components/site/MetadataBlock, components/site/SiteFooter).
  if (segments.length === 1 && !isDirectory(`${SITE_PREFIX}${head}`)) return 'legacy'
  return null
}

/** Every module specifier a file pulls in, read off the AST. */
function moduleSpecifiers(relPath) {
  const text = readFileSync(join(ROOT, relPath), 'utf8')
  const src = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const specs = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text)
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return specs
}

/* -------------------------------------------------------------------------- */
/* Measure                                                                     */
/* -------------------------------------------------------------------------- */

const pages = pageFiles('app').filter(isPublic).sort()

/** page -> {kb, legacy, primitives, explore, v3} (only non-zero keys kept). */
const counts = {}
for (const page of pages) {
  const tally = {}
  for (const spec of moduleSpecifiers(page)) {
    const register = classify(spec, page)
    if (register) tally[register] = (tally[register] ?? 0) + 1
  }
  if (Object.keys(tally).length) counts[page] = tally
}

const nonV3Of = (tally) => NON_V3.reduce((sum, r) => sum + (tally?.[r] ?? 0), 0)
const v3Of = (tally) => tally?.v3 ?? 0

let nonV3ImportSites = 0
let legacyPages = 0
let mixedPages = 0
for (const page of pages) {
  const tally = counts[page]
  const nonV3 = nonV3Of(tally)
  const v3 = v3Of(tally)
  nonV3ImportSites += nonV3
  if (nonV3 > 0 && v3 === 0) legacyPages += 1
  if (nonV3 > 0 && v3 > 0) mixedPages += 1
}

const totals = { nonV3ImportSites, legacyPages, mixedPages }

/**
 * The two RATCHETED numbers. mixedPages is deliberately not one of them.
 *
 * The check path already treats C as tracked rather than gated (decisions.md,
 * 2026-08-11, "ci:public-ui rule C corrected by the fixer"): a family being rebuilt
 * necessarily holds v3 sections beside chrome that has not moved yet, so failing on
 * C blocked the only path off the old registers. The WRITE path kept the old
 * shrink-only rule over all three keys, which reproduced the same block one step
 * later: the first real migration shrank A by 14 and B by 1 and then could not
 * record the result, because C went 0 to 1 exactly as designed. --allow-growth
 * would have unlocked it by loosening A and B at the same time, which is the
 * opposite of what a ratchet is for. So the guard names the two numbers it is
 * guarding. What C is doing per page is still written to the baseline, and rule C
 * below still fails any page whose non-v3 count grows AFTER it joins the barrel.
 */
const RATCHETED = ['nonV3ImportSites', 'legacyPages']

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

if (WRITE) {
  if (existsSync(join(ROOT, BASELINE_PATH)) && !ALLOW_GROWTH) {
    const prior = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8')).totals ?? {}
    const grew = RATCHETED.filter(
      (k) => typeof prior[k] === 'number' && totals[k] > prior[k],
    )
    if (grew.length) {
      console.error('public-ui ratchet: refusing to re-seed, these numbers would GROW:')
      for (const k of grew) console.error(`  ${k}: ${prior[k]} -> ${totals[k]}`)
      console.error(
        'Shrink them, or pass --allow-growth to loosen the ceiling deliberately and defend it in review.',
      )
      process.exit(1)
    }
  }
  const seed = {
    note:
      'Public UI ratchet (ci:public-ui). Non-v3 design-register imports on public pages. ' +
      'nonV3ImportSites and legacyPages may only SHRINK. mixedPages is TRACKED, not ' +
      'gated: it is the visible migration front, and a roll that moves a family onto ' +
      'the barrel while its chrome waits necessarily raises it. Per page, once a page ' +
      'imports the barrel its non-v3 count may never grow. knownPages is the new-page ' +
      'tripwire: a public page absent from it that imports a non-v3 register fails ' +
      'regardless of totals. ' +
      'Re-seed after a P9 roll with `node scripts/check-public-ui.mjs --write-baseline`.',
    generated_by: 'check-public-ui.mjs --write-baseline',
    registers: {
      kb: 'components/site/kb/*',
      legacy: 'components/site/<File> (flat files directly under components/site)',
      primitives: 'components/site/primitives/*',
      explore: 'components/site/explore/*',
      v3: 'components/site/v3 (the destination register, not debt)',
    },
    totals,
    knownPages: pages,
    pages: counts,
  }
  writeFileSync(join(ROOT, BASELINE_PATH), `${JSON.stringify(seed, null, 2)}\n`)
  console.log(`public-ui ratchet: baseline written to ${BASELINE_PATH}`)
  console.log(
    `  nonV3ImportSites=${nonV3ImportSites}  legacyPages=${legacyPages}  mixedPages=${mixedPages}` +
      `  (${pages.length} public pages)`,
  )
  process.exit(0)
}

if (!existsSync(join(ROOT, BASELINE_PATH))) {
  console.error(`public-ui ratchet: ${BASELINE_PATH} is missing. Seed it with --write-baseline.`)
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'))
const baseTotals = baseline.totals ?? {}
const basePages = baseline.pages ?? {}
const knownPages = new Set(baseline.knownPages ?? [])

/* -------------------------------------------------------------------------- */
/* Judge                                                                       */
/* -------------------------------------------------------------------------- */

const failures = []

const LABEL = {
  nonV3ImportSites: 'A. non-v3 register import sites',
  legacyPages: 'B. legacy pages (non-v3 imports, no v3)',
  mixedPages: 'C. mixed pages (the migration front, tracked not gated)',
}

// A and B are the debt, and debt may only shrink.
for (const key of ['nonV3ImportSites', 'legacyPages']) {
  const now = totals[key]
  const was = baseTotals[key]
  if (typeof was !== 'number') {
    failures.push(`${LABEL[key]}: baseline has no number for "${key}". Re-seed the baseline.`)
    continue
  }
  if (now > was) {
    failures.push(`${LABEL[key]}: ${was} -> ${now}. This number may only shrink.`)
  }
}

// C is NOT debt, it is the migration front. A family being rebuilt necessarily
// holds v3 body sections beside chrome that has not moved yet, so failing on a
// rising mixed count would block the only path off the old registers. What is a
// real defect is a page that already knows v3 reaching BACK: once a page imports
// the barrel, its non-v3 count may never grow.
const regressed = []
for (const page of pages) {
  const tally = counts[page]
  if (v3Of(tally) === 0) continue
  const now = nonV3Of(tally)
  const was = nonV3Of(basePages[page])
  if (typeof was === 'number' && now > was) {
    regressed.push(`${page}: on v3 and its non-v3 imports grew ${was} -> ${now}.`)
  }
}
if (regressed.length) {
  failures.push(
    `C. a page on v3 reached back into an old register:\n      ${regressed.join('\n      ')}`,
  )
}

// The new-page tripwire.
const newDirtyPages = []
for (const page of pages) {
  if (knownPages.has(page)) continue
  const nonV3 = nonV3Of(counts[page])
  if (nonV3 > 0) {
    const detail = NON_V3.filter((r) => counts[page]?.[r])
      .map((r) => `${r}=${counts[page][r]}`)
      .join(' ')
    newDirtyPages.push(`${page}  (${detail})`)
    failures.push(
      `NEW PUBLIC PAGE on an old register: ${page} imports ${nonV3} non-v3 register file(s) [${detail}]. ` +
        'A new public surface is built from components/site/v3 or it is not built.',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

const delta = (now, was) => {
  if (typeof was !== 'number') return 'no baseline'
  if (now === was) return 'held'
  return now < was ? `shrank ${was - now}` : `GREW ${now - was}`
}

console.log('public UI ratchet (ci:public-ui)')
console.log('===============================')
console.log(`${pages.length} public pages scanned (app/**/page.tsx, minus admin/api/dev/auth).`)
console.log(
  `  A. non-v3 import sites : ${nonV3ImportSites}  (baseline ${baseTotals.nonV3ImportSites ?? '?'}, ${delta(nonV3ImportSites, baseTotals.nonV3ImportSites)})`,
)
console.log(
  `  B. legacy pages        : ${legacyPages}  (baseline ${baseTotals.legacyPages ?? '?'}, ${delta(legacyPages, baseTotals.legacyPages)})`,
)
console.log(
  `  C. mixed pages         : ${mixedPages}  (baseline ${baseTotals.mixedPages ?? '?'}, ${delta(mixedPages, baseTotals.mixedPages)})`,
)

const byRegister = {}
for (const page of pages) {
  for (const r of REGISTERS) byRegister[r] = (byRegister[r] ?? 0) + (counts[page]?.[r] ?? 0)
}
console.log(
  `  by register            : ${REGISTERS.map((r) => `${r}=${byRegister[r] ?? 0}`).join('  ')}`,
)

if (failures.length) {
  console.log(`\n${failures.length} violation(s):`)
  for (const f of failures) console.log(`  - ${f}`)

  const offenders = pages
    .filter((p) => nonV3Of(counts[p]) > 0)
    .map((p) => ({
      page: p,
      nonV3: nonV3Of(counts[p]),
      was: nonV3Of(basePages[p]),
      isNew: !knownPages.has(p),
      breakdown: REGISTERS.filter((r) => counts[p]?.[r])
        .map((r) => `${r}=${counts[p][r]}`)
        .join(' '),
    }))
    .sort((a, b) => b.nonV3 - a.nonV3 || a.page.localeCompare(b.page))

  console.log('\nWorst offenders (non-v3 import sites per public page):')
  for (const o of offenders.slice(0, 20)) {
    const flag = o.isNew ? '  [NEW PAGE]' : o.nonV3 > o.was ? `  [REGRESSED from ${o.was}]` : ''
    console.log(`  ${String(o.nonV3).padStart(3)}  ${o.page}  (${o.breakdown})${flag}`)
  }
  if (offenders.length > 20) console.log(`  ... and ${offenders.length - 20} more pages.`)

  const regressed = offenders.filter((o) => !o.isNew && o.nonV3 > o.was)
  if (regressed.length) {
    console.log('\nPages that grew since the baseline:')
    for (const o of regressed) console.log(`  ${o.page}: ${o.was} -> ${o.nonV3}`)
  }
  if (newDirtyPages.length) {
    console.log('\nNew public pages carrying an old register:')
    for (const p of newDirtyPages) console.log(`  ${p}`)
  }

  console.log(
    '\nThe destination is components/site/v3. A page needing a control the barrel lacks adds ' +
      'a primitive there (components/site/v3/index.ts is the pressure valve); it does not reach ' +
      'back into kb, the flat legacy files, primitives, or explore.',
  )
  process.exit(1)
}

const shrank = ['nonV3ImportSites', 'legacyPages', 'mixedPages'].filter(
  (k) => totals[k] < (baseTotals[k] ?? Infinity),
)
if (shrank.length) {
  console.log(
    `\nOK - and ${shrank.join(', ')} came in under baseline. Re-seed in this commit: ` +
      'node scripts/check-public-ui.mjs --write-baseline',
  )
} else {
  console.log('\nOK - no public page gained a design register.')
}
