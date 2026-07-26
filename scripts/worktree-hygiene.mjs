#!/usr/bin/env node
/**
 * worktree-hygiene.mjs — list RyanRealty worktrees and flag stranded work.
 *
 * Exit 0 always (advisory). Agents should run this at session start/end when
 * using worktrees. See AGENTS.md → Worktrees.
 */
import { execSync } from 'node:child_process'

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

const porcelain = sh('git worktree list --porcelain')
const blocks = porcelain.split('\n\n').filter(Boolean)

console.log('Ryan Realty worktree hygiene')
console.log('============================')

let warnings = 0
for (const block of blocks) {
  const lines = block.split('\n')
  const path = lines.find((l) => l.startsWith('worktree '))?.slice(9) ?? '?'
  const head = lines.find((l) => l.startsWith('HEAD '))?.slice(5)?.slice(0, 10) ?? '?'
  const branchLine = lines.find((l) => l.startsWith('branch '))
  const detached = lines.includes('detached')
  const branch = detached
    ? '(detached)'
    : (branchLine?.replace(/^branch refs\/heads\//, '') ?? '(unknown)')

  let aheadMain = '?'
  let unpushed = false
  try {
    if (!detached && branch !== 'main') {
      aheadMain = sh(`git rev-list --count origin/main..${branch} 2>/dev/null || git rev-list --count main..${branch}`)
      const upstream = sh(`git rev-parse --abbrev-ref ${branch}@{upstream} 2>/dev/null || true`)
      if (!upstream) {
        const localOnly = Number(aheadMain) > 0
        unpushed = localOnly
      } else {
        const aheadRemote = sh(`git rev-list --count @{u}..${branch} 2>/dev/null || echo 0`)
        unpushed = Number(aheadRemote) > 0
      }
    }
  } catch {
    aheadMain = '?'
  }

  const flags = []
  const isGatesVerify = path.includes('ryanrealty-gates-verify')
  if (detached && !isGatesVerify) {
    flags.push('detached worktree — merge/handoff or remove if stale')
    warnings++
  }
  if (branch !== 'main' && branch !== '(detached)' && !/^(wt\/|claude\/|cursor\/)/.test(branch)) {
    flags.push('NAME: prefer wt/<topic>-YYYYMMDD')
    warnings++
  }
  if (branch !== 'main' && aheadMain !== '?' && Number(aheadMain) > 0) {
    flags.push(`${aheadMain} commit(s) not in origin/main — merge or handoff`)
    warnings++
  }
  if (unpushed) {
    flags.push('local-only commits (ok if intentional; record in CROSS_AGENT_HANDOFF)')
  }

  console.log(`\n· ${path}`)
  console.log(`  branch ${branch} @ ${head}${flags.length ? `\n  ⚠ ${flags.join('; ')}` : ''}`)
}

if (warnings === 0) {
  console.log('\n✓ No stranded-work signals.')
} else {
  console.log(`\n⚠ ${warnings} signal(s). Default: merge to main + push, or document in docs/plans/CROSS_AGENT_HANDOFF.md.`)
}
