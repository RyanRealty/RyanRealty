#!/usr/bin/env node
/**
 * stamp-gates-marker.mjs — records that the local gate chain passed for an
 * exact tree, so .husky/pre-push can verify in milliseconds instead of
 * re-running the ~10-minute chain inside the hook.
 *
 * WHY: git establishes the ssh connection to github.com and advertises refs
 * BEFORE running pre-push. A 10-minute hook (ci:gates + next build) idles the
 * connection out, and the pack write dies with SIGPIPE (exit 141) even though
 * the hook itself passed — observed twice on 2026-07-17. The heavy work now
 * runs in `npm run push` (scripts/push-with-gates.sh) BEFORE git push opens
 * the connection; this marker is the handshake between the two.
 *
 * Marker: <git-dir>/rr-gates-marker containing "<tree-hash> <epoch-secs>".
 * Per-worktree by construction (each worktree has its own git-dir).
 *
 * Usage:
 *   node scripts/stamp-gates-marker.mjs                 # stamp HEAD's tree
 *   node scripts/stamp-gates-marker.mjs --commit <sha>  # stamp <sha>'s tree
 *
 * --commit is what push-with-gates.sh uses after isolated verification: the
 * verify worktree checked out exactly <sha>, so its tree is certified no
 * matter what the shared working tree or HEAD look like by now. The bare
 * form is for manual flows (`npm run gates:stamp && git push`) — there the
 * chain saw the working tree, so a dirty tree earns a warning.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' }).trim()

const args = process.argv.slice(2)
const commitIdx = args.indexOf('--commit')
const commit = commitIdx !== -1 ? args[commitIdx + 1] : null
if (commitIdx !== -1 && !commit) {
  console.error('stamp-gates-marker: --commit requires a sha')
  process.exit(2)
}

const gitDir = git('rev-parse --git-dir')
const ref = commit ?? 'HEAD'
const tree = git(`rev-parse '${ref}^{tree}'`)
const markerPath = join(gitDir, 'rr-gates-marker')

writeFileSync(markerPath, `${tree} ${Math.floor(Date.now() / 1000)}\n`)

if (!commit) {
  const dirty = git('status --porcelain --untracked-files=no')
  if (dirty) {
    console.warn(
      'stamp-gates-marker: WARNING — working tree has uncommitted tracked changes.\n' +
      'The marker certifies the tree at HEAD; commit before stamping or the\n' +
      'pre-push tree match will fail (or certify content gates did not see).'
    )
  }
}
console.log(`gates marker stamped: ${ref} tree ${tree.slice(0, 12)}… -> ${markerPath}`)
