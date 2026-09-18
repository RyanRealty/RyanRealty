#!/usr/bin/env node
/**
 * check-place-craft.mjs — SITE-128 / place explorer Tip Ready lock.
 *
 * Holds map-drives-hierarchy on every push and keeps the competitor
 * first-look evidence path documented. --ship of the stub still refuses
 * until named-peer shots land (do not invent them here).
 *
 * Wired as ci:place-craft (always lane + ci:gates:chain).
 *
 * Usage: node scripts/check-place-craft.mjs
 */
import { placeCraftCiProblems, PLACE_CRAFT_GATE } from './lib/place-craft.mjs'

const failures = placeCraftCiProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${PLACE_CRAFT_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${PLACE_CRAFT_GATE} — OK: map-drives-hierarchy locked; competitor first-look evidence path documented. Tip Ready is --ship with named-peer shots.`,
)
