#!/usr/bin/env node
/**
 * stamp-gates-marker.mjs — records that the local gate chain passed for the
 * exact tree at HEAD, so .husky/pre-push can verify in milliseconds instead
 * of re-running the ~10-minute chain inside the hook.
 *
 * WHY: git establishes the ssh connection to github.com and advertises refs
 * BEFORE running pre-push. A 10-minute hook (ci:gates + next build) idles the
 * connection out, and the pack write dies with SIGPIPE (exit 141) even though
 * the hook itself passed — observed twice on 2026-07-17. The heavy work now
 * runs in `npm run push` (scripts/push-with-gates.sh) BEFORE git push opens
 * the connection; this marker is the handshake between the two.
 *
 * Marker: <git-dir>/rr-gates-marker containing "<HEAD-tree-hash> <epoch-secs>".
 * Per-worktree by construction (each worktree has its own git-dir).
 *
 * NOTE: the marker certifies the tree at HEAD. Commit first, then run
 * `npm run push` — gates run on the working tree, so a commit made after
 * stamping will (correctly) fail the pre-push tree match.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' }).trim()

const gitDir = git('rev-parse --git-dir')
const tree = git("rev-parse 'HEAD^{tree}'")
const markerPath = join(gitDir, 'rr-gates-marker')

writeFileSync(markerPath, `${tree} ${Math.floor(Date.now() / 1000)}\n`)

const dirty = git('status --porcelain --untracked-files=no')
if (dirty) {
  console.warn(
    'stamp-gates-marker: WARNING — working tree has uncommitted tracked changes.\n' +
    'The marker certifies the tree at HEAD; commit before stamping or the\n' +
    'pre-push tree match will fail (or certify content gates did not see).'
  )
}
console.log(`gates marker stamped: tree ${tree.slice(0, 12)}… -> ${markerPath}`)
