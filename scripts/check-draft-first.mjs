#!/usr/bin/env node
/**
 * check-draft-first.mjs — pre-commit gate for CLAUDE.md §0.5 Draft-First.
 *
 * CLAUDE.md §0.5 says: "Nothing gets committed, pushed, posted, sent,
 * rendered to a tracked location, or written to a place a publishing
 * automation can pick up — until Matt has personally seen the draft
 * and explicitly approved it."
 *
 * This was prose. Agents (and humans under time pressure) routinely
 * skip the review step on user-facing diffs. This gate makes the rule
 * mechanical: if the commit touches a user-facing surface AND the
 * commit message does NOT carry an explicit approval marker, the
 * commit fails.
 *
 * What counts as a user-facing surface (triggers the gate):
 *   - app/<route>/page.tsx, layout.tsx, error.tsx, loading.tsx
 *   - components/site/<any> (the Wave 2 site shelf)
 *   - public/lp/<any>, public/<any>.html
 *   - app/lp/<any> (landing pages)
 *
 * What counts as approval (clears the gate):
 *   - Commit message body contains `Approved-by: matt` (case-insensitive)
 *   - OR commit message body contains `Draft-shown: <url>` (the agent
 *     showed Matt the draft preview and is recording proof)
 *   - OR the env var `DRAFT_FIRST_OK=1` is set on the commit (manual
 *     override for emergency hot-fixes — leaves a clear audit trail
 *     in CI logs)
 *
 * Excluded from the gate (still safe to commit without approval):
 *   - lib/data/<any> (DAL infrastructure)
 *   - lib/site/<any> (helpers)
 *   - components/site/primitives/<any> (atomic primitives — already locked)
 *   - scripts/, docs/, .github/, .cursor/, eslint-rules/
 *   - any *.test.{ts,tsx,mjs}
 *   - migrations / SQL
 *
 * Usage:
 *   This script is invoked by .husky/pre-commit. To run manually:
 *     git diff --cached --name-only | node scripts/check-draft-first.mjs
 *   For an in-flight commit message:
 *     node scripts/check-draft-first.mjs <commit-message-file>
 */

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const USER_FACING_PATTERNS = [
  /^app\/(?!api\/|admin\/|account\/|dashboard\/|\(internal\)\/).+\/(page|layout|error|loading|not-found|template)\.(tsx|jsx)$/,
  /^app\/lp\/.+\.(tsx|jsx)$/,
  /^components\/site\/(?!primitives\/).+\.(tsx|jsx)$/,
  /^public\/.+\.html$/,
  // Rendered video deliverables — videos published to the tracked
  // library are user-facing and require explicit Matt approval per
  // CLAUDE.md §0.5 "Draft-First, Commit-Last" (the video-review-gate
  // rule). Closes GAP-2 from the 2026-05-28 guardrail inventory.
  /^public\/v5_library\/.+\.(mp4|mov|webm)$/,
  /^public\/videos\/.+\.(mp4|mov|webm)$/,
]

const NEVER_USER_FACING = [
  /\.test\.(ts|tsx|mjs|js)$/,
  /^lib\//,
  /^scripts\//,
  /^docs\//,
  /^\.github\//,
  /^\.cursor\//,
  /^eslint-rules\//,
  /^components\/site\/primitives\//,
  /^supabase\/migrations\//,
  /^design_system\//,
]

const APPROVAL_MARKERS = [
  /^approved-by:\s*matt/im,
  /^draft-shown:\s*\S+/im,
]

function isUserFacing(path) {
  if (NEVER_USER_FACING.some((re) => re.test(path))) return false
  return USER_FACING_PATTERNS.some((re) => re.test(path))
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
    })
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function readCommitMessage(file) {
  if (!file) return ''
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8')
}

function main() {
  // git commit hands the commit-msg file path as argv[2] (the script in
  // .husky/commit-msg). When run as pre-commit, argv is empty — we look
  // at COMMIT_EDITMSG instead.
  const msgFile = process.argv[2] || '.git/COMMIT_EDITMSG'
  const msg = readCommitMessage(msgFile)
  const files = getStagedFiles()
  const userFacing = files.filter(isUserFacing)

  if (userFacing.length === 0) {
    // Nothing user-facing — no approval needed
    process.exit(0)
  }

  if (process.env.DRAFT_FIRST_OK === '1') {
    console.log('Draft-first gate skipped via DRAFT_FIRST_OK=1 (audit trail in CI logs).')
    process.exit(0)
  }

  const hasApproval = APPROVAL_MARKERS.some((re) => re.test(msg))
  if (hasApproval) {
    process.exit(0)
  }

  console.error('')
  console.error('========================================================')
  console.error('Draft-first gate FAILED')
  console.error('========================================================')
  console.error('')
  console.error('This commit touches user-facing files but the message')
  console.error("carries no approval marker. Per CLAUDE.md §0.5, Matt's")
  console.error('explicit approval is required before committing changes')
  console.error('to surfaces that publish to production.')
  console.error('')
  console.error('User-facing files in this commit:')
  for (const f of userFacing.slice(0, 12)) console.error(`  ${f}`)
  if (userFacing.length > 12) console.error(`  ... +${userFacing.length - 12} more`)
  console.error('')
  console.error('To clear the gate, add ONE of these lines to the commit')
  console.error('message body (any case):')
  console.error('  Approved-by: matt')
  console.error('  Draft-shown: <url-or-screenshot-path>')
  console.error('')
  console.error('Or, for an emergency hot-fix (audit-logged):')
  console.error('  DRAFT_FIRST_OK=1 git commit ...')
  console.error('')
  process.exit(1)
}

main()
