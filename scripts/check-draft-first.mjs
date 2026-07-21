#!/usr/bin/env node
/**
 * check-draft-first.mjs — commit-msg gate for the approval model.
 *
 * APPROVAL MODEL (Matt, confirmed 2026-07-21 — supersedes the old
 * "Draft-First, Commit-Last" blanket rule for code and site content):
 *
 *   Full autonomy with post-hoc review for everything reversible —
 *   code, infrastructure, gates, DAL, migrations, site content, skills,
 *   dead-code deletion. Those commit and push clean, no marker needed.
 *
 *   Per-action approval survives for exactly four classes, all of which
 *   are RUNTIME actions gated elsewhere (send paths, publisher's
 *   humanApprovedAt stamp, spend, OAuth) — plus ONE commit-time class
 *   this gate still enforces:
 *
 *   Rendered content deliverables. A video file landing in a tracked
 *   public/ path feeds distribution surfaces. Committing one requires an
 *   explicit approval marker in the commit message.
 *
 * What triggers the gate:
 *   - public/<anywhere>/*.mp4|mov|webm
 *
 * What clears it:
 *   - Commit message body contains `Approved-by: matt` (case-insensitive)
 *   - OR `Draft-shown: <url-or-path>` (proof the draft was reviewed)
 *   - OR env `DRAFT_FIRST_OK=1` (emergency override, audit-logged in CI)
 *
 * Invoked by .husky/commit-msg with the commit-message file as argv[2].
 */

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const CONTENT_DELIVERABLE_PATTERNS = [
  /^public\/.+\.(mp4|mov|webm)$/i,
]

const APPROVAL_MARKERS = [
  /^approved-by:\s*matt/im,
  /^draft-shown:\s*\S+/im,
]

function isContentDeliverable(path) {
  return CONTENT_DELIVERABLE_PATTERNS.some((re) => re.test(path))
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
  const msgFile = process.argv[2] || '.git/COMMIT_EDITMSG'
  const msg = readCommitMessage(msgFile)
  const deliverables = getStagedFiles().filter(isContentDeliverable)

  if (deliverables.length === 0) process.exit(0)

  if (process.env.DRAFT_FIRST_OK === '1') {
    console.log('Approval gate skipped via DRAFT_FIRST_OK=1 (audit trail in CI logs).')
    process.exit(0)
  }

  if (APPROVAL_MARKERS.some((re) => re.test(msg))) process.exit(0)

  console.error('')
  console.error('========================================================')
  console.error('Content-deliverable approval gate FAILED')
  console.error('========================================================')
  console.error('')
  console.error('This commit lands rendered content deliverables in tracked')
  console.error('public/ paths. Per the approval model (confirmed 2026-07-21),')
  console.error('rendered content needs Matt\'s explicit approval before it')
  console.error('reaches a distribution surface. Code and site content commit')
  console.error('clean — this gate only fires on media files.')
  console.error('')
  console.error('Deliverables in this commit:')
  for (const f of deliverables.slice(0, 12)) console.error(`  ${f}`)
  if (deliverables.length > 12) console.error(`  ... +${deliverables.length - 12} more`)
  console.error('')
  console.error('To clear the gate, add ONE of these lines to the commit')
  console.error('message body (any case):')
  console.error('  Approved-by: matt')
  console.error('  Draft-shown: <url-or-screenshot-path>')
  console.error('')
  process.exit(1)
}

main()
