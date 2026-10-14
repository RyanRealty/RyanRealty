#!/usr/bin/env node
/**
 * pr-stale.mjs — label open PRs older than 3 days, close after 2 more.
 *
 * Skips hold-for-matt. Closing keeps the branch. Used by
 * .github/workflows/pr-stale.yml (daily + workflow_dispatch).
 *
 * Usage: node scripts/pr-stale.mjs
 */
import { spawnSync } from 'node:child_process'
import { HOLD_LABEL, STALE_LABEL, staleDecision } from './lib/pr-housekeeping.mjs'

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' })
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

function staleLabeledAt(number) {
  const events = gh(['api', `repos/{owner}/{repo}/issues/${number}/events`, '--paginate'])
  if (!events.ok) return null
  let latest = null
  try {
    const rows = JSON.parse(events.stdout || '[]')
    for (const row of rows) {
      if (row?.event !== 'labeled') continue
      if (row?.label?.name !== STALE_LABEL) continue
      const at = Date.parse(row.created_at)
      if (Number.isFinite(at) && (latest == null || at > latest)) latest = at
    }
  } catch {
    return null
  }
  return latest
}

const listed = gh([
  'pr',
  'list',
  '--state',
  'open',
  '--limit',
  '100',
  '--json',
  'number,title,labels,createdAt,isDraft',
])
if (!listed.ok) fail(listed.stderr || 'gh pr list failed')

const now = Date.now()
const prs = JSON.parse(listed.stdout || '[]')
let marked = 0
let closed = 0
let skipped = 0

for (const pr of prs) {
  const labels = (pr.labels || []).map((label) => label.name || label)
  const decision = staleDecision({
    createdAt: pr.createdAt,
    labels,
    title: pr.title,
    now,
    staleLabeledAt: labels.includes(STALE_LABEL) ? staleLabeledAt(pr.number) : null,
  })
  if (decision === 'skip-hold' || decision === 'none' || decision === 'wait-stale') {
    skipped += 1
    console.log(`#${pr.number} ${decision}`)
    continue
  }
  if (decision === 'mark-stale') {
    const add = gh(['pr', 'edit', String(pr.number), '--add-label', STALE_LABEL])
    const body =
      `This PR is older than 3 days and is not labeled \`${HOLD_LABEL}\`. ` +
      `Rebase and merge it, or it will close in 2 days and keep the branch so the work is not lost.`
    gh(['pr', 'comment', String(pr.number), '--body', body])
    if (add.ok) {
      marked += 1
      console.log(`#${pr.number} marked ${STALE_LABEL}`)
    } else {
      console.error(`#${pr.number} could not label ${STALE_LABEL}: ${add.stderr || add.stdout}`.trim())
    }
    continue
  }
  if (decision === 'close') {
    const reason =
      `Closing because this PR stayed \`${STALE_LABEL}\` for 2 days after the 3-day mark ` +
      `and is not labeled \`${HOLD_LABEL}\`. The branch is kept so the work is not lost. ` +
      `Re-open after a rebase if it should still land.`
    const closedPr = gh(['pr', 'close', String(pr.number), '--comment', reason])
    if (closedPr.ok) {
      closed += 1
      console.log(`#${pr.number} closed (branch kept)`)
    } else {
      console.error(`#${pr.number} close failed: ${closedPr.stderr || closedPr.stdout}`.trim())
    }
    continue
  }
  console.log(`#${pr.number} ${decision}`)
}

console.log(`stale run: marked=${marked} closed=${closed} skipped=${skipped} open=${prs.length}`)
