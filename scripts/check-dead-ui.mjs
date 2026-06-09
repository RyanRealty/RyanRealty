#!/usr/bin/env node
/**
 * check-dead-ui.mjs — gate 9: curated list of deprecated/orphaned UI files.
 *
 * WHY (from site-consistency-audit-2026-06-09.md P2.7 + P1.25):
 *   Dead components with the old non-design-system patterns linger with zero
 *   importers. The default-export aliases look legitimate, inviting re-adoption.
 *   A future dev importing `Breadcrumb from '@/components/Breadcrumb'` reintroduces
 *   a second breadcrumb impl with divergent styling. components/site/BreadcrumbNav
 *   is the sole correct breadcrumb.
 *
 * This gate FAILS if any path in the curated DEAD_FILES list exists on disk.
 *
 * DESIGN PHILOSOPHY — curated list (not a zero-importer scanner):
 *   A generic "find all zero-importer components" scanner is prone to false
 *   positives (lazy-loaded components, components used only in E2E tests,
 *   re-exported barrels, etc.) and requires complex import-graph walking.
 *   This gate is a curated list of specifically confirmed dead files — each was
 *   verified to have zero import statements across app/, components/, and lib/
 *   before being added. When a new dead file is confirmed (via grep + tsc),
 *   add it to DEAD_FILES with a brief comment explaining why it is dead.
 *
 * HOW TO ADD A NEW ENTRY:
 *   1. Confirm zero import statements:
 *      grep -r "from.*['\"].*YourComponent['\"]" app/ components/ lib/ --include="*.ts" --include="*.tsx"
 *   2. Confirm no type-only imports:
 *      grep -r "YourComponent" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep import
 *   3. Delete the file: rm path/to/YourComponent.tsx (NOT git rm)
 *   4. Run: npx tsc --noEmit  (must be clean or show only pre-existing errors)
 *   5. Add the path to DEAD_FILES below with a comment.
 *
 * The path format is relative to the repo root, using forward slashes.
 *
 * Usage: node scripts/check-dead-ui.mjs [--json]
 */

import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Curated dead-file list
// Each entry is relative to the repo root.
// Format: { path: string, reason: string }
// ---------------------------------------------------------------------------

const DEAD_FILES = [
  // ----- Deprecated breadcrumb impls -----
  // The sole breadcrumb is components/site/BreadcrumbNav.tsx. The following
  // are old implementations that have been superseded. They have zero import
  // statements but their names look legitimate, risking re-adoption.
  {
    path: 'components/Breadcrumb.tsx',
    reason:
      'Deprecated alias of BreadcrumbNav — imports @/components/ui/breadcrumb and aliases ' +
      'it as BreadcrumbNav (confusingly). Zero importers confirmed. Sole breadcrumb: ' +
      'components/site/BreadcrumbNav.tsx.',
  },
  {
    path: 'components/layout/BreadcrumbStrip.tsx',
    reason:
      'Deprecated BreadcrumbStrip — legacy layout breadcrumb superseded by ' +
      'components/site/BreadcrumbNav.tsx. Zero importers confirmed.',
  },

  // ----- Orphaned listing-detail components -----
  // The live listing-detail page (app/listing/[listingKey]/page.tsx) uses
  // components/site/listing-detail/* exclusively. The following were the
  // old implementation and have zero importers.
  {
    path: 'components/site/listing-detail/PhotoGallery.tsx',
    reason:
      'Superseded by components/site/PhotoGalleryLightbox.tsx (used by ListingHero). ' +
      'Zero importers confirmed — no import statement references this path. ' +
      'Same hand-rolled overlay pattern identified in P1.25.',
  },
  {
    path: 'components/listing/ListingHeader.tsx',
    reason:
      'Orphaned listing component — the live listing-detail page uses ' +
      'components/site/listing-detail/* exclusively. Zero importers confirmed ' +
      '(2026-06-09 sweep). Already used the H1 primitive correctly; deleted ' +
      'to prevent inadvertent re-adoption of a superseded component.',
  },
  {
    path: 'components/listing/PropertyDetails.tsx',
    reason:
      'Orphaned listing component — same class as ListingHeader.tsx. Zero importers ' +
      'confirmed (2026-06-09 sweep). Already used the H2 primitive correctly; deleted ' +
      'to prevent inadvertent re-adoption of a superseded component.',
  },
  {
    path: 'components/listing/ListingSummary.tsx',
    reason:
      'Orphaned listing component — the live listing-detail page uses ' +
      'components/site/listing-detail/* exclusively. Zero importers confirmed. ' +
      'Contains .toLocaleString() render-body date formatting (hydration risk, P2.3).',
  },
  {
    path: 'components/listing/ListingDetails.tsx',
    reason:
      'Orphaned listing component — same class as ListingSummary.tsx. Zero importers ' +
      'confirmed. Contains .toLocaleString() render-body date formatting (hydration risk, P2.3).',
  },

  // ----- Orphaned geo MarketStats client components -----
  // These three components called reportsExploreYtdPath() from lib/slug.ts which
  // reads new Date() in the render body — a confirmed hydration (#418) risk (P2.2).
  // All three have zero importers confirmed (2026-06-09 audit).
  {
    path: 'components/city/CityMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Calls ' +
      'reportsExploreYtdPath() (lib/slug.ts:89-91) in the render body, which reads ' +
      'new Date() -> confirmed hydration risk (P2.2). Not used by any live city page.',
  },
  {
    path: 'components/neighborhood/NeighborhoodMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Same ' +
      'reportsExploreYtdPath()/new Date() hydration risk as CityMarketStats.',
  },
  {
    path: 'components/community/CommunityMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Same ' +
      'reportsExploreYtdPath()/new Date() hydration risk as CityMarketStats.',
  },
]

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

function checkFile(entry) {
  const abs = join(REPO_ROOT, entry.path)
  const exists = existsSync(abs)
  return { ...entry, exists, absPath: abs }
}

function main() {
  const results = DEAD_FILES.map(checkFile)
  const found = results.filter((r) => r.exists)

  if (JSON_OUT) {
    console.log(JSON.stringify({ results, foundCount: found.length }, null, 2))
    process.exit(found.length === 0 ? 0 : 1)
  }

  console.log('Dead-UI gate (curated)')
  console.log('======================')
  console.log()

  let allOk = true
  for (const r of results) {
    if (r.exists) {
      allOk = false
      console.log(`FAIL  ${r.path}`)
      console.log(`      Reason: ${r.reason}`)
      console.log(`      Fix:    rm ${r.path}  (verify zero importers first, then npx tsc --noEmit)`)
      console.log()
    } else {
      console.log(`OK    ${r.path}  (absent — good)`)
    }
  }

  console.log()
  if (allOk) {
    console.log('All deprecated/orphaned UI files are absent.')
    console.log(`(Checked ${results.length} curated entries.)`)
    process.exit(0)
  }

  console.log(`${found.length}/${results.length} dead file(s) found on disk.`)
  console.log('Dead components with old patterns linger as re-adoption vectors.')
  console.log('Delete them (rm, not git rm) after confirming zero importers + tsc clean.')
  process.exit(1)
}

main()
