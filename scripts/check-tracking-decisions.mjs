#!/usr/bin/env node
/**
 * check-tracking-decisions.mjs: a pinned tracking decision changes only on
 * purpose. Runs from .husky/commit-msg on every commit (it validates the file's
 * shape each time, and needs the trailer when an entry is removed or loosened).
 *
 * data/analytics/decisions.json lists Matt's tracking calls (one page_view
 * sender, the Google tag on Initialization, Signals on, the key events, the
 * Business Profile link, no second GTM admin). `npm run analytics:audit` fails
 * when live GA4 or GTM stops keeping a `check` entry. That check is only as
 * strong as the file: the cheap way to "fix" a failing decision is to delete or
 * loosen the entry, which is how settled tracking calls kept getting re-made
 * (Matt 2026-10-14: "this all needs to be written someplace so that we're
 * always moving ... forward and not one-offing things, breaking things").
 * Same mechanism as data/seo/decisions.json (scripts/check-seo-decisions.mjs).
 *
 * Rule (commit-msg hook): when data/analytics/decisions.json is staged and any
 * entry that exists at HEAD is removed, or its check, code or manual changed,
 * the commit message must carry a trailer naming who decided and why:
 *
 *   Tracking-decision: Matt 2026-10-14, <why>
 *
 * Adding a new entry needs nothing. TRACKING_DECISION_OK=1 is the emergency override.
 *
 * Modes:
 *   --report     validate the file's shape only
 *   <msg-file>   commit-msg hook usage: the real check
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const FILE = 'data/analytics/decisions.json'
const TRAILER = /^Tracking-decision:\s*\S.{8,}$/m

const holdOf = (d) => JSON.stringify({ check: d.check ?? null, code: d.code ?? null, manual: d.manual ?? null })

/** Entries at HEAD that the staged file removed or changed. Exported for tests. */
export function changedDecisions(before, after) {
  const now = new Map((after?.decisions ?? []).map((d) => [d.id, d]))
  const out = []
  for (const d of before?.decisions ?? []) {
    const n = now.get(d.id)
    if (!n) out.push(`${d.id}: removed`)
    else if (holdOf(n) !== holdOf(d)) out.push(`${d.id}: changed`)
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
    if (!d.decided || !d.why) out.push(`${d.id}: needs decided and why`)
    const holds = ['check', 'code', 'manual'].filter((k) => d[k])
    if (holds.length !== 1) out.push(`${d.id}: needs exactly one of check, code or manual`)
    if (d.check) {
      if (typeof d.check.fact !== 'string' || !d.check.fact) out.push(`${d.id}: check needs a fact`)
      const has = ['equals', 'includes'].filter((k) => k in d.check)
      if (has.length !== 1) out.push(`${d.id}: check needs exactly one of equals or includes`)
      if ('includes' in d.check && (!Array.isArray(d.check.includes) || d.check.includes.length === 0)) out.push(`${d.id}: includes must be a non-empty array`)
    }
    if (d.code && (typeof d.code !== 'string' || !existsSync(d.code))) out.push(`${d.id}: code must name a file that exists (${d.code})`)
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
    console.error(`✗ tracking-decisions: ${FILE} is malformed:`)
    for (const s of shape) console.error(`  - ${s}`)
    process.exit(1)
  }
  if (arg === '--report' || !arg) {
    console.log(`✓ tracking-decisions: ${doc.decisions.length} pinned decisions, well formed`)
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
  if (TRAILER.test(msg) || process.env.TRACKING_DECISION_OK === '1') process.exit(0)
  console.error('')
  console.error('✗ tracking-decisions: this commit removes or loosens a pinned tracking decision:')
  for (const c of changed) console.error(`  - ${c}`)
  console.error('')
  console.error('If npm run analytics:audit is failing, the live SETUP drifted: fix GA4 or GTM, not the entry.')
  console.error('If Matt changed the decision, say so in a trailer:')
  console.error('  Tracking-decision: Matt <date>, <why>')
  process.exit(1)
}
