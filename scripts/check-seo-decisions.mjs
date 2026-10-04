#!/usr/bin/env node
/**
 * check-seo-decisions.mjs — ci:seo-decisions: a pinned SEO decision changes
 * only on purpose.
 *
 * data/seo/decisions.json lists Matt's SEO calls (one page per place, the
 * homepage title, which pages index). The live audit (scripts/lib/live-seo-
 * audit.mjs) fails a deploy when production stops keeping one. That check is
 * only as strong as the file: the cheap way to "fix" a failing decision is to
 * delete or loosen the entry, which is how a decided split has come back
 * before (SITE-187 kept /cities/sunriver beside /communities/sunriver until
 * Search Console showed the query split, 2026-10-04).
 *
 * Rule (commit-msg hook): when data/seo/decisions.json is staged and any entry
 * that exists at HEAD is removed, or its path or expect changed, the commit
 * message must carry a trailer naming who decided and why:
 *
 *   SEO-decision: Matt 2026-10-04, <why>
 *
 * Adding a new entry needs nothing. SEO_DECISION_OK=1 is the emergency override.
 *
 * Modes:
 *   --report     validate the file's shape only (static ci:gates chain)
 *   <msg-file>   commit-msg hook usage: the real check
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const FILE = 'data/seo/decisions.json'
const TRAILER = /^SEO-decision:\s*\S.{8,}$/m

/** Entries at HEAD that the staged file removed or changed. Exported for tests. */
export function changedDecisions(before, after) {
  const now = new Map((after?.decisions ?? []).map((d) => [d.id, d]))
  const out = []
  for (const d of before?.decisions ?? []) {
    const n = now.get(d.id)
    if (!n) out.push(`${d.id}: removed`)
    else if (n.path !== d.path || JSON.stringify(n.expect) !== JSON.stringify(d.expect)) out.push(`${d.id}: changed`)
  }
  return out
}

/** Shape problems in the file. Exported for tests. */
export function shapeProblems(doc) {
  const out = []
  if (!Array.isArray(doc?.decisions) || doc.decisions.length === 0) return ['no decisions array']
  const ids = new Set()
  for (const d of doc.decisions) {
    if (!d.id || ids.has(d.id)) out.push(`duplicate or missing id: ${d.id}`)
    ids.add(d.id)
    if (typeof d.path !== 'string' || !d.path.startsWith('/')) out.push(`${d.id}: path must start with /`)
    if (!d.decided || !d.why) out.push(`${d.id}: needs decided and why`)
    if (!d.expect || Object.keys(d.expect).length === 0) out.push(`${d.id}: empty expect`)
  }
  return out
}

function git(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  const doc = JSON.parse(readFileSync(FILE, 'utf8'))
  const shape = shapeProblems(doc)
  if (shape.length > 0) {
    console.error(`✗ seo-decisions: ${FILE} is malformed:`)
    for (const s of shape) console.error(`  - ${s}`)
    process.exit(1)
  }
  if (arg === '--report' || !arg) {
    console.log(`✓ seo-decisions: ${doc.decisions.length} pinned decisions, well formed`)
    process.exit(0)
  }
  const staged = (git('git diff --cached --name-only') ?? '').split('\n').map((s) => s.trim())
  if (!staged.includes(FILE)) process.exit(0)
  const headText = git(`git show HEAD:${FILE}`)
  const stagedText = git(`git show :${FILE}`)
  if (!headText || !stagedText) process.exit(0)
  const changed = changedDecisions(JSON.parse(headText), JSON.parse(stagedText))
  if (changed.length === 0) process.exit(0)
  const msg = existsSync(arg) ? readFileSync(arg, 'utf8') : ''
  if (TRAILER.test(msg) || process.env.SEO_DECISION_OK === '1') process.exit(0)
  console.error('')
  console.error('✗ seo-decisions: this commit removes or loosens a pinned SEO decision:')
  for (const c of changed) console.error(`  - ${c}`)
  console.error('')
  console.error('If the live check is failing, the SITE regressed: fix the site, not the entry.')
  console.error('If Matt changed the decision, say so in a trailer:')
  console.error('  SEO-decision: Matt <date>, <why>')
  process.exit(1)
}
