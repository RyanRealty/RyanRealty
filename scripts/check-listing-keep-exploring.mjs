#!/usr/bin/env node
/**
 * check-listing-keep-exploring.mjs — listing View more + Atlas plat chips.
 *
 * SITE-128 craft #4. View more → subdivision, not generic search.
 * Kill legal-plat chip leak (+52 more @375).
 *
 * Wired as ci:listing-keep-exploring (always lane + ci:gates:chain).
 * Same problems feed taste-receipt --ship for listing-detail.
 *
 * Usage: node scripts/check-listing-keep-exploring.mjs
 */
import { listingKeepExploringProblems, LISTING_KEEP_EXPLORING_GATE } from './lib/listing-keep-exploring.mjs'

const failures = listingKeepExploringProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${LISTING_KEEP_EXPLORING_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${LISTING_KEEP_EXPLORING_GATE} — OK: View more → subdivision door; listing Atlas plats under the 375 fold; no 60-plat dump.`,
)
