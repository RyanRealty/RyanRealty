#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-134 / SITE-135 / SITE-146 floating dog CTA.
 *
 * Refuse if the public layout drops V3DogFloater, remounts a sticky
 * Call/Text/Work-with-us phone dock, cover-crops the head, ships a
 * circular pre-crop / edge-tight jax-head, ships a 70% static idle
 * that reads as frozen on a phone, shortens a door label, or puts an
 * em dash (U+2014) in public copy. Wired as ci:dog-floater (always + chain).
 *
 * Usage: node scripts/check-dog-floater.mjs
 */
import { dogFloaterProblems, dogHeadCropProblems, DOG_FLOATER_GATE } from './lib/dog-floater.mjs'

const failures = [
  ...dogFloaterProblems({ root: process.cwd() }),
  ...(await dogHeadCropProblems({ root: process.cwd() })),
]

if (failures.length) {
  console.error(`${DOG_FLOATER_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${DOG_FLOATER_GATE} OK: V3DogFloater mounted, visible idle tilt, full-seal inner head with 4–8% pad (no fat ring, no circular pre-crop), exact five doors, no em dash in public copy, header Work with us stays out, sticky phone dock stays down.`,
)
