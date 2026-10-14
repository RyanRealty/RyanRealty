#!/usr/bin/env node
/**
 * pr-head-branch-cleanup.mjs — delete merged and aged-closed PR head branches.
 *
 * Never main. Never a branch that still has an open PR. Merged PR heads delete
 * the same day. Closed-unmerged heads wait 7 days, then delete unless labeled
 * keep-branch or hold-for-matt. A branch with no PR is left alone.
 *
 * Used by .github/workflows/pr-head-branch-cleanup.yml (daily + workflow_dispatch).
 *
 * Usage: node scripts/pr-head-branch-cleanup.mjs [--dry-run]
 */
import { spawnSync } from 'node:child_process'
import {
  KEEP_BRANCH_LABEL,
  KEEP_BRANCH_LABEL_COLOR,
  KEEP_BRANCH_LABEL_DESCRIPTION,
  headBranchCleanupDecision,
} from './lib/pr-housekeeping.mjs'

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') }
}

function ensureKeepBranchLabel() {
  const created = gh([
    'api',
    'repos/{owner}/{repo}/labels',
    '-X',
    'POST',
    '-f',
    `name=${KEEP_BRANCH_LABEL}`,
    '-f',
    `color=${KEEP_BRANCH_LABEL_COLOR}`,
    '-f',
    `description=${KEEP_BRANCH_LABEL_DESCRIPTION}`,
  ])
  if (created.ok || /already_exists|Validation Failed/i.test(`${created.stdout} ${created.stderr}`)) {
    return
  }
  console.error(`could not create label ${KEEP_BRANCH_LABEL}: ${(created.stderr || created.stdout).trim()}`)
}

function listRemoteHeads() {
  const listed = gh(['api', '--paginate', 'repos/{owner}/{repo}/git/matching-refs/heads'])
  if (!listed.ok) fail(listed.stderr || 'list refs failed')
  /** @type {Array<{ ref?: string }>} */
  const rows = JSON.parse(listed.stdout || '[]')
  return rows
    .map((row) => String(row.ref || '').replace(/^refs\/heads\//, ''))
    .filter((name) => name.length > 0)
}

function listPulls() {
  const listed = gh([
    'pr',
    'list',
    '--state',
    'all',
    '--limit',
    '1000',
    '--json',
    'number,state,mergedAt,closedAt,headRefName,labels',
  ])
  if (!listed.ok) fail(listed.stderr || 'gh pr list --state all failed')
  return JSON.parse(listed.stdout || '[]')
}

/**
 * Latest closed or merged PR for a head branch, or null.
 * @param {Array<{ headRefName?: string, mergedAt?: string | null, closedAt?: string | null, labels?: unknown }>} pulls
 * @param {string} branch
 */
function latestClosedFor(pulls, branch) {
  const matches = pulls.filter((pr) => pr.headRefName === branch)
  if (matches.length === 0) return null
  matches.sort((a, b) => {
    const aAt = Date.parse(a.closedAt || a.mergedAt || 0)
    const bAt = Date.parse(b.closedAt || b.mergedAt || 0)
    return bAt - aAt
  })
  const pr = matches[0]
  return {
    merged: Boolean(pr.mergedAt),
    closedAt: pr.closedAt || pr.mergedAt || null,
    labels: (pr.labels || []).map((label) => (typeof label === 'string' ? label : label?.name)),
    number: pr.number,
  }
}

function deleteHead(name) {
  const deleted = gh(['api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${name}`])
  if (deleted.ok) return { ok: true, error: '' }
  return { ok: false, error: (deleted.stderr || deleted.stdout || 'delete failed').trim() }
}

const args = parseArgs(process.argv.slice(2))
ensureKeepBranchLabel()

const heads = listRemoteHeads()
const pulls = listPulls()
const openHeads = new Set(
  pulls.filter((pr) => String(pr.state || '').toUpperCase() === 'OPEN').map((pr) => pr.headRefName).filter(Boolean),
)
const closedPrs = pulls.filter((pr) => String(pr.state || '').toUpperCase() !== 'OPEN')
const now = Date.now()

let deleted = 0
let kept = 0
let failed = 0

for (const branch of heads) {
  const latestClosedPr = latestClosedFor(closedPrs, branch)
  const decision = headBranchCleanupDecision({
    branchName: branch,
    hasOpenPr: openHeads.has(branch),
    latestClosedPr,
    now,
  })
  if (!decision.startsWith('delete-')) {
    kept += 1
    const prNote = latestClosedPr?.number ? ` #${latestClosedPr.number}` : ''
    console.log(`keep ${branch}${prNote} (${decision})`)
    continue
  }
  const prNote = latestClosedPr?.number ? ` #${latestClosedPr.number}` : ''
  if (args.dryRun) {
    deleted += 1
    console.log(`dry-run delete ${branch}${prNote} (${decision})`)
    continue
  }
  const result = deleteHead(branch)
  if (result.ok) {
    deleted += 1
    console.log(`deleted ${branch}${prNote} (${decision})`)
  } else {
    failed += 1
    console.error(`failed ${branch}${prNote} (${decision}): ${result.error}`)
  }
}

console.log(`\nhead-branch cleanup: deleted=${deleted} kept=${kept} failed=${failed}`)
if (failed > 0) process.exit(1)
