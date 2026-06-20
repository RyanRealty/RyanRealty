#!/usr/bin/env node
/**
 * check-breadcrumb.mjs — CI gate for "ONE breadcrumb canon, on every public page."
 *
 * Site-consistency program (2026-06-09) + site-polish audit P1-1 (2026-06-10).
 * The site shipped three breadcrumb components, ~19 crumbless pages, and then
 * FOUR different chromes around the one surviving component (floating
 * Container, a border-b band, a navy band, detail-shell offsets at y=113/125)
 * plus label drift ("Ryan Realty" root on /about, "Homes for Sale" vs
 * "Homes for sale" vs "Search" for the same surface).
 *
 * The canon: `components/site/PageBreadcrumb` is the ONLY way a page renders
 * a breadcrumb — Container pt-3 pb-1, Home root baked in, on-light tone,
 * sentence-case labels, JSON-LD once. This gate enforces:
 *
 *   1. Every public content page must render a breadcrumb (<PageBreadcrumb>,
 *      or via a shared shell — intentional exceptions are exempt below).
 *      Ratcheted via baseline `violators`.
 *   2. No page may render <BreadcrumbNav> directly — pages go through
 *      PageBreadcrumb so placement/labels/tone cannot drift. Ratcheted via
 *      baseline `directUsage` (the excluded-lane debt pages; list only shrinks).
 *   3. No page may import a deprecated breadcrumb variant (the old
 *      components/Breadcrumb or any re-created BreadcrumbStrip) — hard fail.
 *   4. Banned crumb labels (hard fail): a 'Ryan Realty' crumb (the root is
 *      "Home", the about page is "About"), Title-Case 'Homes for Sale', and
 *      a 'Search' crumb (the surface is "Homes for sale" -> /homes-for-sale).
 *   5. tone="on-navy" is reserved for the full-bleed search map band
 *      (app/search/[...slug]) — anywhere else is a hard fail.
 *   6. The retired border-b band wrapper around a crumb — hard fail.
 *
 * Opt-out: a leading `// @no-breadcrumb` comment for a page that legitimately
 * renders none (rare — prefer the exempt list).
 *
 * Usage:
 *   node scripts/check-breadcrumb.mjs                 # CI mode
 *   node scripts/check-breadcrumb.mjs --report        # human-readable, never fails
 *   node scripts/check-breadcrumb.mjs --json
 *   node scripts/check-breadcrumb.mjs --write-baseline
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const APP_DIR = join(ROOT, 'app')
const BASELINE_PATH = join(ROOT, 'scripts/breadcrumb-baseline.json')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const JSON_OUT = args.has('--json')
const WRITE_BASELINE = args.has('--write-baseline')

// Whole top-level areas that are not public content surfaces.
const SKIP_TOP_LEVEL = ['api', 'admin', 'account', 'dashboard', 'marketing']

// Routes that intentionally render no BreadcrumbNav, or render it via a shared
// wrapper component (so their own page.tsx has no BreadcrumbNav token).
const EXEMPT = [
  /^app\/page\.tsx$/, // homepage
  /^app\/(login|signup|forgot-password|auth-error|offline)\//, // auth + utility
  /^app\/(privacy|terms|fair-housing|accessibility|cookies|dmca|data-deletion)\/page\.tsx$/, // legal
  /^app\/alerts\//, // email unsubscribe utility
  /^app\/newsletter\/unsubscribe\//, // token-confirm utility (mirrors alerts/unsubscribe)
  /^app\/sign\//, // public tokenized e-signing surface — not a content page
  /^app\/dev\//, // internal component gallery for review, not a public page
  /^app\/feed\/page\.tsx$/, // standalone immersive video feed
  /^app\/cma-drafts\//, // internal draft viewer
  /^app\/team\/\[slug\]\/edit\//, // admin edit form
  /^app\/lp\//, // standalone landing pages are intentionally crumb-less
  /^app\/(sell|buy)\/\[intent\]\//, // intent LPs render LeadLandingPage (carries the crumb)
  /^app\/listing\/by-(address|key)\//, // render ListingDetailPage (carries the crumb)
  /^app\/housing-market\/reports\/\[slug\]\//, // re-export of app/reports/[slug] (+ the geoName redirect)
  /^app\/housing-market\/reports\/page\.tsx$/, // re-export of app/reports/page
  /^app\/reports\/\[slug\]\/\[geoName\]\//, // redirect-only (consolidated to /housing-market/<city>)
]

// Deprecated breadcrumb implementations that must never reappear in a page.
const DEPRECATED_IMPORT = /from ['"](?:[^'"]*\/)?(?:components\/Breadcrumb|components\/layout\/BreadcrumbStrip)['"]/

// Direct JSX render of the low-level component (pages must use PageBreadcrumb).
// \b keeps `<BreadcrumbNavItem` (the type) from matching.
const DIRECT_RENDER = /<BreadcrumbNav\b/

// The only file allowed to use tone="on-navy" (the full-bleed search map band).
const NAVY_TONE_ALLOWED = new Set(['app/search/[...slug]/page.tsx'])

// Canon label violations — each entry is [regex, why]. Scoped to page sources;
// these strings only plausibly occur as crumb labels.
const BANNED_LABELS = [
  [/label:\s*['"]Ryan Realty['"]/, `crumb label 'Ryan Realty' — the root is "Home"; the about page crumb is "About"`],
  [/label:\s*['"]Homes for Sale['"]/, `crumb label 'Homes for Sale' (Title Case) — canon is sentence case "Homes for sale"`],
  [/label:\s*['"]Search['"]/, `crumb label 'Search' — the search surface is "Homes for sale" -> /homes-for-sale`],
]

// The retired border-b band chrome wrapping a crumb (P1-1 variant b).
const BAND_WRAPPER = /border-b border-border py-3"[\s\S]{0,200}?<(?:BreadcrumbNav\b|PageBreadcrumb)/

function isExempt(rel) {
  return EXEMPT.some((re) => re.test(rel))
}

function walkPages(dir, acc = []) {
  if (!statSync(dir).isDirectory()) return acc
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const top = relative(APP_DIR, full).split('/')[0]
      if (SKIP_TOP_LEVEL.includes(top)) continue
      walkPages(full, acc)
    } else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'page.jsx') {
      acc.push(full)
    }
  }
  return acc
}

function classify(pagePath) {
  const src = readFileSync(pagePath, 'utf8')
  const rel = relative(ROOT, pagePath)
  const optOut = /@no-breadcrumb/.test(src.slice(0, 600))
  // A pure re-export page (e.g. app/housing-market/explore/page.tsx doing
  // `export { default } from '@/app/reports/explore/page'`) renders whatever
  // its target renders — it inherits the target's breadcrumb, so it counts as
  // compliant when the target module is the real surface. Detect: every
  // non-comment, non-blank line is an export-from statement.
  const meaningful = src
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'))
  const isReExportOnly =
    meaningful.length > 0 && meaningful.every((l) => /^export\s+(\{[^}]*\}|\*)\s+from\s+['"]/.test(l))
  // KbBreadcrumb is the KB-era breadcrumb (components/site/kb/KbBreadcrumb) — the
  // design-system pages render it instead of PageBreadcrumb. It counts as a real
  // breadcrumb; this gate predated it, which is why ~49 KB pages read as "missing".
  const hasBreadcrumb = isReExportOnly || /BreadcrumbNav|PageBreadcrumb|KbBreadcrumb/.test(src)
  const usesDeprecated = DEPRECATED_IMPORT.test(src)
  const directRender = DIRECT_RENDER.test(src)
  const navyTone = /tone="on-navy"/.test(src) && !NAVY_TONE_ALLOWED.has(rel)
  const bannedLabels = BANNED_LABELS.filter(([re]) => re.test(src)).map(([, why]) => why)
  const bandWrapper = BAND_WRAPPER.test(src)
  return {
    rel,
    optOut,
    hasBreadcrumb,
    usesDeprecated,
    directRender,
    navyTone,
    bannedLabels,
    bandWrapper,
    exempt: isExempt(rel),
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { missing: new Set(), direct: new Set() }
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return { missing: new Set(raw.violators ?? []), direct: new Set(raw.directUsage ?? []) }
}

function main() {
  const results = walkPages(APP_DIR).map(classify)

  // Hard fail (never baselined): a page importing a deprecated breadcrumb.
  const deprecated = results.filter((r) => r.usesDeprecated)

  // Missing breadcrumb (ratcheted): not exempt, not opted out, no breadcrumb.
  const missing = results.filter((r) => !r.exempt && !r.optOut && !r.hasBreadcrumb)
  const compliant = results.filter((r) => !r.exempt && r.hasBreadcrumb)

  // Canon violations (P1-1).
  const direct = results.filter((r) => r.directRender) // ratcheted (excluded-lane debt)
  const navyTone = results.filter((r) => r.navyTone) // hard fail
  const allLabelFails = results.filter((r) => r.bannedLabels.length > 0)
  const bandWrapper = results.filter((r) => r.bandWrapper) // hard fail

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason: 'Breadcrumb debt at canon time (P1-1). `violators` = pages with no breadcrumb. `directUsage` = pages still rendering <BreadcrumbNav> directly instead of <PageBreadcrumb> (excluded-lane pages pending their own migration). NEW entries in either class fail CI; both lists only shrink.',
      total: missing.length,
      violators: missing.map((r) => r.rel).sort(),
      directUsage: direct.map((r) => r.rel).sort(),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`Wrote baseline: ${missing.length} crumbless + ${direct.length} direct-usage debt pages recorded at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newMissing = missing.filter((r) => !baseline.missing.has(r.rel))
  const newDirect = direct.filter((r) => !baseline.direct.has(r.rel))
  // Label canon hard-fails only on pages already migrated to the canon —
  // direct-usage debt pages get their labels fixed when their lane migrates.
  const labelFails = allLabelFails.filter((r) => !baseline.direct.has(r.rel))
  const labelDebt = allLabelFails.filter((r) => baseline.direct.has(r.rel))
  const fixedSinceBaseline = [...baseline.missing].filter((rel) => !missing.some((r) => r.rel === rel))
  const fail =
    newMissing.length > 0 ||
    deprecated.length > 0 ||
    newDirect.length > 0 ||
    navyTone.length > 0 ||
    labelFails.length > 0 ||
    bandWrapper.length > 0

  if (JSON_OUT) {
    console.log(JSON.stringify({
      pagesScanned: results.length,
      compliant: compliant.length,
      totalMissing: missing.length,
      baselineSize: baseline.missing.size,
      newMissing: newMissing.map((r) => r.rel),
      directUsage: direct.map((r) => r.rel),
      newDirectUsage: newDirect.map((r) => r.rel),
      navyTone: navyTone.map((r) => r.rel),
      bannedLabels: labelFails.map((r) => ({ page: r.rel, why: r.bannedLabels })),
      bannedLabelDebt: labelDebt.map((r) => ({ page: r.rel, why: r.bannedLabels })),
      bandWrapper: bandWrapper.map((r) => r.rel),
      deprecated: deprecated.map((r) => r.rel),
      fixedSinceBaseline,
    }, null, 2))
    process.exit(fail ? 1 : 0)
  }

  console.log('Breadcrumb canon check (P1-1, ratcheted)')
  console.log('========================================')
  console.log()
  console.log(`Public pages scanned:             ${results.length}`)
  console.log(`  With a breadcrumb:              ${compliant.length}`)
  console.log(`  Missing (total):                ${missing.length}`)
  console.log(`  Missing baseline (debt):        ${baseline.missing.size}`)
  console.log(`  NEW missing (CI BLOCKER):       ${newMissing.length}`)
  console.log(`  Direct <BreadcrumbNav> (total): ${direct.length}`)
  console.log(`  Direct-usage baseline (debt):   ${baseline.direct.size}`)
  console.log(`  NEW direct usage (BLOCKER):     ${newDirect.length}`)
  console.log(`  on-navy tone misuse (BLOCKER):  ${navyTone.length}`)
  console.log(`  Banned crumb labels (BLOCKER):  ${labelFails.length}`)
  console.log(`  Band wrapper chrome (BLOCKER):  ${bandWrapper.length}`)
  console.log(`  Deprecated import (BLOCKER):    ${deprecated.length}`)
  console.log(`  Fixed since baseline:           ${fixedSinceBaseline.length}`)
  console.log()
  if (deprecated.length > 0) {
    console.log('Deprecated breadcrumb import (use @/components/site/PageBreadcrumb):')
    for (const r of deprecated) console.log(`  ${r.rel}`)
    console.log()
  }
  if (newDirect.length > 0) {
    console.log('NEW direct <BreadcrumbNav> usage (use <PageBreadcrumb trail={[...]}> — Home root is baked in):')
    for (const r of newDirect) console.log(`  ${r.rel}`)
    console.log()
  }
  if (navyTone.length > 0) {
    console.log('tone="on-navy" outside the search map band (canon tone is on-light):')
    for (const r of navyTone) console.log(`  ${r.rel}`)
    console.log()
  }
  if (labelFails.length > 0) {
    console.log('Banned crumb labels:')
    for (const r of labelFails) for (const why of r.bannedLabels) console.log(`  ${r.rel}: ${why}`)
    console.log()
  }
  if (labelDebt.length > 0) {
    console.log('Banned crumb labels on direct-usage debt pages (fix when that lane migrates — not blocking):')
    for (const r of labelDebt) for (const why of r.bannedLabels) console.log(`  ${r.rel}: ${why}`)
    console.log()
  }
  if (bandWrapper.length > 0) {
    console.log('Retired border-b band wrapper around a crumb (PageBreadcrumb owns its chrome):')
    for (const r of bandWrapper) console.log(`  ${r.rel}`)
    console.log()
  }
  if (newMissing.length > 0) {
    console.log('NEW pages without a breadcrumb (these fail CI):')
    for (const r of newMissing) console.log(`  ${r.rel}`)
    console.log()
    console.log('Fix: render <PageBreadcrumb trail={[...]} /> as the first element of <main> (see app/contact/page.tsx),')
    console.log('or add `// @no-breadcrumb` if the page legitimately has none.')
  }

  if (REPORT) process.exit(0)
  process.exit(fail ? 1 : 0)
}

main()
