#!/usr/bin/env node
/**
 * check-worktree-cleanup.mjs — G86: finished worktrees do not stay on disk.
 *
 * A rule that only lives in prose is forgotten. This gate fails when the
 * cleanup script, its hooks, the launchd job, ship-pr, or the agent
 * instruction files drop the merged-worktree cleanup rule.
 *
 * Usage: node scripts/check-worktree-cleanup.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const fails = []

function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) {
    fails.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(p, 'utf8')
}

const SCRIPT = 'scripts/cleanup-merged-worktrees.sh'
const script = read(SCRIPT)
if (script) {
  try {
    const mode = statSync(join(ROOT, SCRIPT)).mode
    if ((mode & 0o111) === 0) fails.push(`${SCRIPT} must be executable`)
  } catch (err) {
    fails.push(`${SCRIPT}: ${err.message}`)
  }
  for (const needle of [
    '--dry-run',
    'worktree remove',
    'worktree prune',
    'stash',
    'unpushed',
    'dirty',
    'node_modules',
    '.next',
    'RyanRealty-wt-',
    'rr-grok-',
    '.grok/worktrees',
    'git cherry',
  ]) {
    if (!script.includes(needle)) fails.push(`${SCRIPT} must contain ${JSON.stringify(needle)}`)
  }
}

const AGENT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/GROK_BOT_BRAIN.md',
  'docs/GROK_BOT_COMPANY.md',
  '.cursor/rules/cleanup-merged-worktrees.mdc',
  '.cursor/rules/always-merge-to-main.mdc',
]

for (const rel of AGENT_FILES) {
  const text = read(rel)
  if (!text) continue
  if (!text.includes('wt:cleanup') && !text.includes('cleanup-merged-worktrees')) {
    fails.push(`${rel} must name npm run wt:cleanup or scripts/cleanup-merged-worktrees.sh`)
  }
  const hasSafety =
    (text.includes('uncommitted') || text.includes('dirty')) &&
    text.includes('unpushed') &&
    text.includes('stash') &&
    (text.includes('another session') || text.includes('in-use'))
  if (!hasSafety) {
    fails.push(
      `${rel} must say never remove a checkout with uncommitted/dirty changes, unpushed commits, stashes, or one another session is using`,
    )
  }
}

const hookNeedles = ['cleanup-merged-worktrees.sh', '--hook']
for (const hook of ['.husky/post-merge', '.husky/post-checkout']) {
  const text = read(hook)
  if (!text) continue
  for (const n of hookNeedles) {
    if (!text.includes(n)) fails.push(`${hook} must call the cleanup script with --hook`)
  }
}

const plist = read('scripts/launchd/com.ryanrealty.cleanup-merged-worktrees.plist')
if (plist && !plist.includes('StartInterval')) {
  fails.push('launchd plist must set StartInterval (hourly on the Mini)')
}
const installer = read('scripts/install-cleanup-launchd.sh')
if (installer && !installer.includes('LaunchAgents')) {
  fails.push('scripts/install-cleanup-launchd.sh must install into LaunchAgents')
}

const ship = read('scripts/ship-pr.sh')
if (ship && !ship.includes('cleanup-merged-worktrees.sh')) {
  fails.push('scripts/ship-pr.sh must call cleanup-merged-worktrees.sh at the end of a land')
}

const pkg = JSON.parse(read('package.json') || '{}')
const scripts = pkg.scripts ?? {}
if (!String(scripts['wt:cleanup'] ?? '').includes('cleanup-merged-worktrees.sh')) {
  fails.push('package.json scripts.wt:cleanup must run scripts/cleanup-merged-worktrees.sh')
}
if (!String(scripts['wt:cleanup:dry'] ?? '').includes('--dry-run')) {
  fails.push('package.json scripts.wt:cleanup:dry must pass --dry-run')
}
if (!String(scripts['ci:worktree-cleanup'] ?? '').includes('check-worktree-cleanup.mjs')) {
  fails.push('package.json scripts.ci:worktree-cleanup must run this gate')
}
const chain = String(scripts['ci:gates:chain'] ?? '')
if (!chain.includes('ci:worktree-cleanup')) {
  fails.push('ci:gates:chain must run ci:worktree-cleanup')
}

console.log('Worktree cleanup gate (ci:worktree-cleanup)')
console.log('==========================================')
if (fails.length) {
  console.error(`\n✗ ci:worktree-cleanup — ${fails.length} failure(s):`)
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('✓ cleanup script, hooks, launchd, ship-pr, and agent instruction files are wired.')
process.exit(0)
