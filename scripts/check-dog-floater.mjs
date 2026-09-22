#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-153 floating dog CTA.
 *
 * Refuse if the public layout drops V3DogFloater, remounts a sticky
 * phone dock, parks the FAB on the cookie bar, ships continuous idle,
 * a Close link, the wrong six doors, cover-crops the head, or ships a
 * circular pre-crop / edge-tight jax-head. Wired as ci:dog-floater.
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
  `${DOG_FLOATER_GATE} OK: V3DogFloater mounted mid-end, brief flip/spin/invert, full-seal inner head with 4–8% pad, exact six doors, no Close link, no em dash, sticky phone dock stays down.`,
)
