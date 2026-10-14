#!/usr/bin/env node
/**
 * check-technique-approval.mjs — commit-msg gate: only Matt approves a studio technique.
 *
 * Matt 2026-10-14: nothing is approved by an agent. A signature technique is
 * usable in a film only once Matt has watched its showcase reel and said yes.
 * Until those approvals live in the database (/admin), the approval is a row in
 * .claude/skills/ryan-studio/techniques/registry.json with status "approved",
 * approved_by "matt", an ISO approved_on and a reel that exists
 * (.claude/skills/ryan-studio/tools/technique-approval.mjs holds that rule for
 * video_gate, ci:studio-techniques, the render preflight and video:check).
 *
 * This gate closes the commit door: a commit that ADDS or CHANGES an approved
 * row must carry, in its message,
 *
 *   Approved-by: matt
 *
 * and name every technique it approves or changes. Lowering a row from approved,
 * or removing it, needs nothing. A merge whose approved row arrived unchanged from
 * the merged branch needs nothing (that branch's commit carried the trailer).
 * There is no override env: the point is that an agent cannot approve its own work.
 *
 * Invoked by .husky/commit-msg with the commit-message file as argv[2], the same
 * way as scripts/check-draft-first.mjs.
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const REGISTRY = '.claude/skills/ryan-studio/techniques/registry.json'
export const TRAILER = /^approved-by:\s*matt\s*$/im

/** JSON with sorted keys, so a re-ordered row is not a "change". */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}

/**
 * Names of approved rows in `after` that are new or changed against `before`
 * (the HEAD registry's techniques) and against every other parent (a merge).
 */
export function approvedRowChanges(before, after, otherParents = []) {
  const out = []
  for (const [name, row] of Object.entries(after ?? {})) {
    if (!row || typeof row !== 'object' || row.status !== 'approved') continue
    const same = (reg) => reg && reg[name] !== undefined && canonical(reg[name]) === canonical(row)
    if (same(before) || otherParents.some(same)) continue
    out.push(name)
  }
  return out
}

/** What the message still lacks for these names: the trailer, and each name as a whole word. */
export function messageProblems(message, names) {
  if (!names.length) return []
  const body = String(message ?? '').split('\n').filter((l) => !l.startsWith('#')).join('\n')
  const out = []
  if (!TRAILER.test(body)) out.push('no `Approved-by: matt` line')
  const word = (n) => new RegExp(`(^|[^A-Za-z0-9_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`)
  for (const n of names) if (!word(n).test(body)) out.push(`the message does not name "${n}"`)
  return out
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 })
  } catch {
    return null
  }
}

/** The registry's techniques at a revision (":" is the index), null when the file is not there. Throws on bad JSON. */
function techniquesAt(rev) {
  const text = git(['show', `${rev}:${REGISTRY}`])
  if (text === null) return null
  return JSON.parse(text).techniques ?? {}
}

function main() {
  const staged = (git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']) ?? '').split('\n').map((s) => s.trim())
  if (!staged.includes(REGISTRY)) process.exit(0)
  const msgFile = process.argv[2] || '.git/COMMIT_EDITMSG'
  const message = existsSync(msgFile) ? readFileSync(msgFile, 'utf8') : ''
  let after
  try {
    after = techniquesAt('')
  } catch (e) {
    console.error(`Technique approval gate: the staged ${REGISTRY} is not valid JSON (${e.message}).`)
    process.exit(1)
  }
  const parents = []
  for (const rev of ['HEAD', 'MERGE_HEAD']) {
    if (git(['rev-parse', '-q', '--verify', rev]) === null) continue
    try {
      parents.push(techniquesAt(rev))
    } catch {
      parents.push(null)
    }
  }
  const names = approvedRowChanges(parents[0] ?? null, after, parents.slice(1))
  const problems = messageProblems(message, names)
  if (!problems.length) process.exit(0)
  console.error('')
  console.error('========================================================')
  console.error('Technique approval gate FAILED')
  console.error('========================================================')
  console.error('')
  console.error(`This commit adds or changes approved technique row(s) in ${REGISTRY}:`)
  for (const n of names) console.error(`  ${n}`)
  console.error('')
  console.error('Only Matt approves a technique, after watching its showcase reel (Matt 2026-10-14).')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  console.error('An agent does not write this line for itself. If Matt has not approved it, set the')
  console.error('row back to "ready" and ask him to watch the reel.')
  console.error('')
  process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
