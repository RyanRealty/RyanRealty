#!/usr/bin/env node
/**
 * check-map-hierarchy.mjs — SITE-128 Tip Ready #2.
 *
 * Subject place polygon only. Child select zooms that recorded ring.
 * Subdivision grain stays readable. place-craft first-look refuse stays.
 *
 * Usage: node scripts/check-map-hierarchy.mjs
 */
import { mapHierarchyCiProblems, MAP_HIERARCHY_GATE } from './lib/map-hierarchy.mjs'

const failures = mapHierarchyCiProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${MAP_HIERARCHY_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${MAP_HIERARCHY_GATE} — OK: subject ring only; child select zooms recorded bounds; subdiv grain readable; place-craft first-look refuse intact.`,
)
