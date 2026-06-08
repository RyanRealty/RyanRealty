#!/usr/bin/env node
/**
 * check-breadcrumb.mjs — CI gate for "one breadcrumb, on every public page."
 *
 * Site-consistency program. The site shipped three different breadcrumb
 * components (BreadcrumbNav, the old components/Breadcrumb, and a
 * BreadcrumbStrip wrapper) and ~19 public pages with no breadcrumb at all.
 * After consolidation, `components/site/BreadcrumbNav` is the SOLE breadcrumb.
 * This gate keeps it that way:
 *
 *   1. Every public content page must render <BreadcrumbNav> (directly or via a
 *      shared wrapper — wrappers/intentional exceptions are exempt below).
 *   2. No page may import a deprecated breadcrumb variant (the old
 *      components/Breadcrumb or any re-created BreadcrumbStrip) — hard fail.
 *
 * Ratcheted: pre-existing pages without a breadcrumb are recorded in
 * scripts/breadcrumb-baseline.json. NEW violations fail CI; the baseline only
 * shrinks (fix a debt page, drop it from the baseline).
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
  /^app\/search\/page\.tsx$/, // full-bleed map app (no hero, no crumb)
  /^app\/(login|signup|forgot-password|auth-error|offline)\//, // auth + utility
  /^app\/(privacy|terms|fair-housing|accessibility|cookies|dmca|data-deletion)\/page\.tsx$/, // legal
  /^app\/alerts\//, // email unsubscribe utility
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
  const hasBreadcrumb = /BreadcrumbNav/.test(src)
  const usesDeprecated = DEPRECATED_IMPORT.test(src)
  return { rel, optOut, hasBreadcrumb, usesDeprecated, exempt: isExempt(rel) }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return new Set(raw.violators ?? [])
}

function main() {
  const results = walkPages(APP_DIR).map(classify)

  // Hard fail (never baselined): a page importing a deprecated breadcrumb.
  const deprecated = results.filter((r) => r.usesDeprecated)

  // Missing breadcrumb (ratcheted): not exempt, not opted out, no BreadcrumbNav.
  const missing = results.filter((r) => !r.exempt && !r.optOut && !r.hasBreadcrumb)
  const compliant = results.filter((r) => !r.exempt && r.hasBreadcrumb)

  if (WRITE_BASELINE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      reason: 'Pages without a BreadcrumbNav at consolidation time. NEW violations fail CI; this list only shrinks as debt pages are fixed.',
      total: missing.length,
      violators: missing.map((r) => r.rel).sort(),
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(`Wrote baseline: ${missing.length} debt pages recorded at ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const newMissing = missing.filter((r) => !baseline.has(r.rel))
  const fixedSinceBaseline = [...baseline].filter((rel) => !missing.some((r) => r.rel === rel))
  const fail = newMissing.length > 0 || deprecated.length > 0

  if (JSON_OUT) {
    console.log(JSON.stringify({
      pagesScanned: results.length,
      compliant: compliant.length,
      totalMissing: missing.length,
      baselineSize: baseline.size,
      newMissing: newMissing.map((r) => r.rel),
      deprecated: deprecated.map((r) => r.rel),
      fixedSinceBaseline,
    }, null, 2))
    process.exit(fail ? 1 : 0)
  }

  console.log('Breadcrumb consistency check (ratcheted)')
  console.log('========================================')
  console.log()
  console.log(`Public pages scanned:            ${results.length}`)
  console.log(`  With BreadcrumbNav:            ${compliant.length}`)
  console.log(`  Missing (total):              ${missing.length}`)
  console.log(`  Baseline (tracked debt):      ${baseline.size}`)
  console.log(`  NEW missing (CI BLOCKER):     ${newMissing.length}`)
  console.log(`  Deprecated import (BLOCKER):  ${deprecated.length}`)
  console.log(`  Fixed since baseline:         ${fixedSinceBaseline.length}`)
  console.log()
  if (deprecated.length > 0) {
    console.log('Deprecated breadcrumb import (use @/components/site/BreadcrumbNav):')
    for (const r of deprecated) console.log(`  ${r.rel}`)
    console.log()
  }
  if (newMissing.length > 0) {
    console.log('NEW pages without a breadcrumb (these fail CI):')
    for (const r of newMissing) console.log(`  ${r.rel}`)
    console.log()
    console.log('Fix: render <BreadcrumbNav items={[...]} /> at the top of <main> (see app/cities/[slug]/page.tsx),')
    console.log('or add `// @no-breadcrumb` if the page legitimately has none.')
  }

  if (REPORT) process.exit(0)
  process.exit(fail ? 1 : 0)
}

main()
