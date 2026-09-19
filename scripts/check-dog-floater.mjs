#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-134 floating dog CTA.
 *
 * Refuse if the public layout drops V3DogFloater or remounts a sticky
 * Call/Text/Work-with-us phone dock. Wired as ci:dog-floater (always + chain).
 *
 * Usage: node scripts/check-dog-floater.mjs
 */
import { dogFloaterProblems, DOG_FLOATER_GATE } from './lib/dog-floater.mjs'

const failures = dogFloaterProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${DOG_FLOATER_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${DOG_FLOATER_GATE} — OK: V3DogFloater mounted, five doors, header Work with us stays, sticky phone dock stays down.`,
)
