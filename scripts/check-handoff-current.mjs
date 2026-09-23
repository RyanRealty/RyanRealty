#!/usr/bin/env node
/**
 * check-handoff-current.mjs — ci:handoff-current (visibility audit PROCESS-8, 2026-09-23).
 *
 * docs/plans/CROSS_AGENT_HANDOFF.md holds ONE `# Current` block. A second one
 * fails, because a stacked handoff is how a booting session misses what the
 * last session (or Matt) said: on 2026-09-22 the file held 52 blocks and the
 * brief showed the first 18 lines of them. Logic: scripts/lib/handoff-current.mjs.
 *
 * Usage: node scripts/check-handoff-current.mjs [path]
 */
import { existsSync, readFileSync } from 'node:fs'
import { currentHeadingLines, handoffCurrentProblems } from './lib/handoff-current.mjs'

const FILE = process.argv[2] ?? 'docs/plans/CROSS_AGENT_HANDOFF.md'

console.log('Handoff Current gate (ci:handoff-current)')
console.log('=========================================')
if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} is missing. Every tool reads it after a pull; restore it with one "# Current" block.`)
  process.exit(1)
}
const text = readFileSync(FILE, 'utf8')
const problems = handoffCurrentProblems(text, FILE)
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`)
  process.exit(1)
}
console.log(`✓ ${FILE}: one "# Current" block (line ${currentHeadingLines(text)[0]}).`)
