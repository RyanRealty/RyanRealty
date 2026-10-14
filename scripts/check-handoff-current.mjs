#!/usr/bin/env node
/**
 * check-handoff-current.mjs — ci:handoff-current (G76).
 *
 * Since 2026-10-14 (Matt): one handoff note per session in docs/plans/handoffs/
 * (scripts/lib/handoff-notes.mjs). This gate fails when:
 *   - docs/plans/CROSS_AGENT_HANDOFF.md, once it carries the frozen header, grows a
 *     "# Current" block again,
 *   - docs/plans/handoffs/README.md is missing,
 *   - a note is misnamed, has no "# " title, carries a "# Current" heading, or
 *     runs past the line cap.
 *
 * The one-block rule it replaced (visibility audit PROCESS-8, 2026-09-23) lives
 * on as history in scripts/lib/handoff-current.mjs.
 *
 * Usage: node scripts/check-handoff-current.mjs [repo-root]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FROZEN_FILE, NOTES_DIR, NOTES_README, frozenFileProblems, newestNotes, noteProblems } from './lib/handoff-notes.mjs'

const ROOT = process.argv[2] ?? process.cwd()

console.log('Handoff notes gate (ci:handoff-current)')
console.log('=======================================')
const problems = []
if (existsSync(join(ROOT, FROZEN_FILE))) problems.push(...frozenFileProblems(readFileSync(join(ROOT, FROZEN_FILE), 'utf8')))
const dir = join(ROOT, NOTES_DIR)
let names = []
if (!existsSync(dir)) problems.push(`${NOTES_DIR}/ is missing. It holds one handoff note per session.`)
else {
  names = readdirSync(dir).filter((n) => n.endsWith('.md'))
  if (!names.includes(NOTES_README)) problems.push(`${NOTES_DIR}/${NOTES_README} is missing (note format + standing holds).`)
  for (const n of names) problems.push(...noteProblems(n, readFileSync(join(dir, n), 'utf8')))
}
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`)
  process.exit(1)
}
const newest = newestNotes(names, 1)[0]
console.log(`✓ ${names.length - 1} handoff note(s) in ${NOTES_DIR}/${newest ? `, newest ${newest}` : ''}.`)
