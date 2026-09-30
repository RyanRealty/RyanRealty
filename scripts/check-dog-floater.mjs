#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-153 floating dog CTA.
 *
 * Refuse if the public layout drops V3DogFloater, remounts a sticky
 * phone dock, parks the FAB on the cookie bar, ships continuous idle,
 * a Close link, the wrong six doors, cover-crops the head, ships a
 * circular pre-crop / edge-tight jax-head, or leaves a finger's look
 * standing on a phone (SITE-210). Wired as ci:dog-floater.
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
  `${DOG_FLOATER_GATE} OK: V3DogFloater mounted mid-end, brief flip/spin/invert, full-seal inner head with 4–8% pad, exact six doors, no Close link, a finger's look released on lift, sticky phone dock stays down.`,
)
