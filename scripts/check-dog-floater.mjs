#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-134 / SITE-135 floating dog CTA.
 *
 * Refuse if the public layout drops V3DogFloater, remounts a sticky
 * Call/Text/Work-with-us phone dock, cover-crops the head, or ships a
 * 70% static idle that reads as frozen on a phone. Wired as
 * ci:dog-floater (always + chain).
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
  `${DOG_FLOATER_GATE} — OK: V3DogFloater mounted, visible idle tilt, full head inside the circle, five doors, header Work with us stays, sticky phone dock stays down.`,
)
