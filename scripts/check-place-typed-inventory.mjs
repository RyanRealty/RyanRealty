#!/usr/bin/env node
/**
 * check-place-typed-inventory.mjs — SITE-129.
 *
 * Community + subdivision typed stock on the page. Empty types omit.
 * PlaceSplitView / morphing search / Atlas price scrubber cannot return.
 *
 * Usage: node scripts/check-place-typed-inventory.mjs
 */
import { placeTypedInventoryCiProblems, PLACE_TYPED_INVENTORY_GATE } from './lib/place-typed-inventory.mjs'

const failures = placeTypedInventoryCiProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${PLACE_TYPED_INVENTORY_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${PLACE_TYPED_INVENTORY_GATE} — OK: typed stock on community/subdivision; empty types omit; scrubber unmounted.`,
)
