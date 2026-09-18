#!/usr/bin/env node
/**
 * check-hierarchy-naming.mjs — SITE-128 Tip Ready #4.
 *
 * Community ≠ neighborhood in chrome. Name-only child cards. Twin-slug
 * collapse. Sitewide crumbs match place pages. Prior locks stay.
 *
 * Usage: node scripts/check-hierarchy-naming.mjs
 */
import { hierarchyNamingCiProblems, HIERARCHY_NAMING_GATE } from './lib/hierarchy-naming.mjs'

const failures = hierarchyNamingCiProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${HIERARCHY_NAMING_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${HIERARCHY_NAMING_GATE} — OK: plats are subdivisions; name-only children; crumbs match place pages; first-look / map-hierarchy / amenity intact.`,
)
