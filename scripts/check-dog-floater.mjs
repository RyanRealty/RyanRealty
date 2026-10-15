#!/usr/bin/env node
/**
 * check-dog-floater.mjs — SITE-153 floating dog CTA.
 *
 * Refuse if the public layout remounts V3DogFloater or a sticky phone
 * dock (Sarah is the public FAB; cookie settings is the only extra floater), drops Sarah, or if leftover
 * floater source stretches the broker photo or hard-codes a non-Matt
 * fallback. Wired as ci:dog-floater.
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
  `${DOG_FLOATER_GATE} OK: V3DogFloater and V3PhoneDock stay unmounted, Sarah is the public FAB, CRM desk broker (Matt fallback), leftover floater source still locked.`,
)
