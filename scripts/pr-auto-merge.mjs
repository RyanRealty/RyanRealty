#!/usr/bin/env node
/**
 * pr-auto-merge.mjs — queue squash auto-merge, or merge when required checks pass.
 *
 * Skips drafts and hold-for-matt (label or HOLD title). Creates the hold and
 * stale labels when the token can. Used by .github/workflows/pr-auto-merge.yml.
 *
 * Usage:
 *   node scripts/pr-auto-merge.mjs --pr 562
 *   node scripts/pr-auto-merge.mjs --ensure-labels
 */
import { spawnSync } from 'node:child_process'
import {
  HOLD_LABEL,
  HOLD_LABEL_COLOR,
  HOLD_LABEL_DESCRIPTION,
  STALE_LABEL,
  STALE_LABEL_COLOR,
  STALE_LABEL_DESCRIPTION,
  mergeAction,
  requiredChecksStatus,
  shouldQueueAutoMerge,
  titleLooksLikeHold,
} from './lib/pr-housekeeping.mjs'

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

function parseArgs(argv) {
  const out = { pr: null, ensureLabels: false, applyTitleHolds: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--ensure-labels') out.ensureLabels = true
    else if (arg === '--apply-title-holds') out.applyTitleHolds = true
    else if (arg === '--pr') {
      out.pr = argv[++i]
    } else if (arg.startsWith('--pr=')) {
      out.pr = arg.slice('--pr='.length)
    }
  }
  return out
}

function ensureLabel(name, color, description) {
  const created = gh([
    'api',
    `repos/{owner}/{repo}/labels`,
    '-X',
    'POST',
    '-f',
    `name=${name}`,
    '-f',
    `color=${color}`,
    '-f',
    `description=${description}`,
  ])
  if (created.ok) {
    console.log(`created label ${name}`)
    return true
  }
  if (/already_exists|Validation Failed/i.test(`${created.stdout} ${created.stderr}`)) {
    console.log(`label ${name} already exists`)
    return true
  }
  console.error(`could not create label ${name}: ${created.stderr || created.stdout}`.trim())
  return false
}

function applyTitleHolds() {
  const listed = gh(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels'])
  if (!listed.ok) fail(listed.stderr || 'gh pr list failed')
  const prs = JSON.parse(listed.stdout || '[]')
  for (const pr of prs) {
    if (!titleLooksLikeHold(pr.title)) continue
    const add = gh(['pr', 'edit', String(pr.number), '--add-label', HOLD_LABEL])
    if (add.ok) console.log(`#${pr.number} labeled ${HOLD_LABEL} from title`)
    else console.error(`#${pr.number} could not add ${HOLD_LABEL}: ${add.stderr || add.stdout}`.trim())
  }
}

function disableAutoMerge(number) {
  const disabled = gh(['pr', 'merge', String(number), '--disable-auto'])
  if (disabled.ok) console.log(`#${number} auto-merge disabled`)
  else console.log(`#${number} auto-merge already off or unavailable`)
}

function handlePr(number) {
  const viewed = gh([
    'pr',
    'view',
    String(number),
    '--json',
    'number,title,isDraft,labels,mergeable,url,state',
  ])
  if (!viewed.ok) fail(viewed.stderr || `gh pr view ${number} failed`)
  const pr = JSON.parse(viewed.stdout)
  if (pr.state !== 'OPEN') {
    console.log(`#${number} is ${pr.state}; skip`)
    return
  }
  if (titleLooksLikeHold(pr.title)) {
    const add = gh(['pr', 'edit', String(number), '--add-label', HOLD_LABEL])
    if (add.ok) console.log(`#${number} labeled ${HOLD_LABEL} from title`)
  }
  if (!shouldQueueAutoMerge({ draft: pr.isDraft, labels: pr.labels, title: pr.title })) {
    disableAutoMerge(number)
    console.log(`#${number} skipped (draft or hold-for-matt)`)
    return
  }

  const checks = gh(['pr', 'checks', String(number), '--json', 'name,state,bucket'])
  if (!checks.ok) {
    console.log(`#${number} checks unread; leave open`)
    return
  }
  const requiredStatus = requiredChecksStatus(JSON.parse(checks.stdout || '[]'))
  const repo = gh(['api', 'repos/{owner}/{repo}', '--jq', '.allow_auto_merge'])
  const allowAutoMerge = repo.ok && repo.stdout.trim() === 'true'
  const action = mergeAction({ requiredStatus, allowAutoMerge })
  console.log(`#${number} required checks: ${requiredStatus}; allow_auto_merge=${allowAutoMerge}; action=${action}`)
  if (action === 'queue-auto') {
    const queued = gh(['pr', 'merge', String(number), '--auto', '--squash', '--delete-branch'])
    if (queued.ok) console.log(`#${number} auto-merge queued`)
    else console.log(`#${number} --auto failed: ${(queued.stderr || queued.stdout).trim()}`)
    return
  }
  if (action !== 'squash-now') return
  const merged = gh(['pr', 'merge', String(number), '--squash', '--delete-branch'])
  if (!merged.ok) fail(merged.stderr || `gh pr merge ${number} failed`)
  console.log(`#${number} squash-merged after required checks`)
}

const args = parseArgs(process.argv.slice(2))
if (args.ensureLabels || args.applyTitleHolds || args.pr) {
  ensureLabel(HOLD_LABEL, HOLD_LABEL_COLOR, HOLD_LABEL_DESCRIPTION)
  ensureLabel(STALE_LABEL, STALE_LABEL_COLOR, STALE_LABEL_DESCRIPTION)
}
if (args.applyTitleHolds) applyTitleHolds()
if (args.pr) handlePr(args.pr)
if (!args.ensureLabels && !args.applyTitleHolds && !args.pr) {
  fail('usage: node scripts/pr-auto-merge.mjs --pr N [--ensure-labels] [--apply-title-holds]')
}
