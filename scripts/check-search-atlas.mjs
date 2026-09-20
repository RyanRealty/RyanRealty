#!/usr/bin/env node
/**
 * check-search-atlas.mjs — SITE-110.
 *
 * Search stays Atlas cartography plus a list. Portal split / mute
 * comparison / seven uniform pills cannot return.
 *
 * Usage: node scripts/check-search-atlas.mjs
 */
import { searchAtlasCiProblems, SEARCH_ATLAS_GATE } from './lib/search-atlas.mjs'

const failures = searchAtlasCiProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${SEARCH_ATLAS_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${SEARCH_ATLAS_GATE} — OK: map-dominant Atlas + list; labeled compare; house sheet; portal pills cannot return.`,
)
