#!/usr/bin/env node
/**
 * check-site-node.mjs — G72: site commits name their node.
 *
 * The site queue (`loop_work_nodes`, domain `public-ux`) is the only site
 * backlog (`scripts/seed-site-queue.ts`, `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md`
 * "Site queue" table). A commit touching `app/**` or `components/site/**` must
 * name the node it serves — or explicitly record that it has none — so site
 * work stays traceable to the queue instead of drifting back into ad-hoc
 * findings and rogue audit docs.
 *
 * Rule: when the commit-message file is given (commit-msg hook usage) and any
 * staged path (git diff --cached --name-only --diff-filter=ACMR) starts with
 * `app/` or `components/site/`, the commit message must contain a trailer
 * line matching:
 *
 *   /^Node:\s*(?:<uuid>|none \(<reason>\))\s*$/m
 *
 * What clears it:
 *   - `Node: <uuid>` — the site-queue node id this commit serves
 *   - `Node: none (<reason>)` — an explicit record of why there is no node
 *   - env `SITE_NODE_OK=1` (emergency override, audit-logged in CI)
 *
 * Modes:
 *   - `--report`            : print the rule, always exit 0 (for the static
 *                             ci:gates chain, which has no commit-message file)
 *   - `<msg-file>` (argv[2]): commit-msg hook usage — the real check
 *   - (neither)              : read `.git/COMMIT_EDITMSG` if present, else
 *                             exit 0 (ci:gates in CI is a no-op)
 *
 * Invoked by .husky/commit-msg with the commit-message file as argv[2].
 */

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SITE_PATH_PREFIXES = ['app/', 'components/site/']

const NODE_TRAILER =
  /^Node:\s*(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|none \(.+\))\s*$/m

const RULE =
  'Rule (G72, site commits name their node): a commit touching app/** or components/site/** ' +
  'must carry a `Node: <id>` (or `Node: none (<reason>)`) trailer naming the site queue node ' +
  '(loop_work_nodes, domain public-ux) this change serves.'

function isSitePath(path) {
  return SITE_PATH_PREFIXES.some((p) => path.startsWith(p))
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

function printFailure(offending) {
  console.error('')
  console.error('========================================================')
  console.error('Site-node commit gate FAILED')
  console.error('========================================================')
  console.error('')
  console.error(RULE)
  console.error('')
  console.error('Offending staged paths:')
  for (const f of offending.slice(0, 10)) console.error(`  ${f}`)
  if (offending.length > 10) console.error(`  ... +${offending.length - 10} more`)
  console.error('')
  console.error('Fix: run `npx tsx scripts/loop-brief.ts` and add `Node: <id>` from the served')
  console.error('public-ux node, or `Node: none (<reason>)` to record why this site change has')
  console.error('no node.')
  console.error('')
}

function main() {
  if (process.argv.includes('--report')) {
    console.log(RULE)
    process.exit(0)
  }

  const argFile = process.argv[2]
  const msgFile = argFile ?? (existsSync('.git/COMMIT_EDITMSG') ? '.git/COMMIT_EDITMSG' : undefined)

  if (!msgFile) {
    // No commit-message file and not --report: nothing to check against —
    // this keeps the static ci:gates chain a no-op in CI (no commit in flight).
    process.exit(0)
  }

  const staged = getStagedFiles()
  const offending = staged.filter(isSitePath)

  if (offending.length === 0) process.exit(0)

  if (process.env.SITE_NODE_OK === '1') {
    console.log('Site-node gate skipped via SITE_NODE_OK=1 (audit trail in CI logs).')
    process.exit(0)
  }

  const msg = readCommitMessage(msgFile)
  if (NODE_TRAILER.test(msg)) process.exit(0)

  printFailure(offending)
  process.exit(1)
}

main()
