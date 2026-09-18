#!/usr/bin/env node
/**
 * check-listing-fold-density.mjs — listing fold + shared breadcrumb densify.
 *
 * WHY: Matt 2026-09-17 P0. Cream around the mosaic/thumbs and a wrapping
 * Bend / … / address band. Collapse, overlay, navy well, tap-height strip.
 * A rebuild that puts md padding or cream back on those primitives is refuse.
 *
 * Wired as ci:listing-fold-density (always lane + ci:gates:chain).
 * Same problems feed taste-receipt --ship for listing-detail.
 *
 * Usage: node scripts/check-listing-fold-density.mjs
 */
import { listingFoldDensityProblems, LISTING_FOLD_DENSITY_GATE } from './lib/listing-fold-density.mjs'

const failures = listingFoldDensityProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${LISTING_FOLD_DENSITY_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${LISTING_FOLD_DENSITY_GATE} — OK: crumb collapses at 3, overlay compact … / current, viewport mosaic, navy well + strip, 2.75rem thumbs, place overlay crumb + tap+2xs copy.`,
)
