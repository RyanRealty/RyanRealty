import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/**
 * The node_modules directory that actually resolves packages for this repo.
 *
 * Gate break-tests sandbox their subject files outside the repo and symlink
 * node_modules in. `join(REPO, 'node_modules')` is wrong in a git worktree:
 * there node_modules is a stub (or absent) and imports resolve by walking up
 * to the main checkout — so the symlink must point at the directory Node
 * itself resolves from, not at a path we assume. Found 2026-08-21: every
 * sandbox-based gate test (71 cases) failed in a worktree with
 * ERR_MODULE_NOT_FOUND for `typescript` while passing in the main checkout.
 */
export function resolvingNodeModules() {
  let dir = dirname(createRequire(import.meta.url).resolve('typescript'))
  while (dir !== dirname(dir) && !dir.endsWith('/node_modules')) dir = dirname(dir)
  return dir
}

// CLI mode for shell callers (push-with-gates.sh): print the directory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(resolvingNodeModules())
}
