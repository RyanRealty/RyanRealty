/**
 * Shared recursive file walker for gate scripts (audit p3.x DRY).
 *
 * ~33 `scripts/check-*.mjs` gates each re-implemented the identical
 * `walk(dir, acc)` (recurse, skip node_modules/.next/.git, collect .ts/.tsx).
 * This is the single source. Callers that need different extensions or skip
 * rules pass `ext` / `skip` regexes. Return order is readdir traversal order —
 * gates that need determinism sort the result themselves (most already do).
 */
import { readdirSync } from 'node:fs'

export const DEFAULT_SKIP_DIRS = /(^|\/)(node_modules|\.next|\.git)(\/|$)/
export const DEFAULT_EXT = /\.(ts|tsx)$/

/**
 * @param {string} dir            directory to walk
 * @param {{ext?: RegExp, skip?: RegExp}} [opts]
 * @param {string[]} [acc]        accumulator (internal)
 * @returns {string[]}            matching file paths
 */
export function walkFiles(dir, opts = {}, acc = []) {
  const ext = opts.ext ?? DEFAULT_EXT
  const skip = opts.skip ?? DEFAULT_SKIP_DIRS
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) {
      if (!skip.test(p)) walkFiles(p, { ext, skip }, acc)
    } else if (ext.test(e.name)) {
      acc.push(p)
    }
  }
  return acc
}
