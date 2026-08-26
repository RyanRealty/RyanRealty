/**
 * Load the PURE deliverable path algebra (lib/marketing-brain/deliverable-path.ts)
 * from plain Node .mjs, with no duplicated logic.
 *
 * Two callers need it outside the Next.js/TS build:
 *   - scripts/check-deliverable-library-scope.mjs, which EXECUTES it against a
 *     fixture table (a gate that only greps source text was defeated twice);
 *   - scripts/render-worker.mjs, which persists rendered video/image/PDF
 *     deliverables and must key them exactly the way the app does.
 *
 * Re-implementing safeSegment/pathBelongsToBroker here in JS would be a second
 * source of truth for a SECURITY boundary, and the two copies would drift the
 * first time one is patched. So the TS module is bundled on demand instead —
 * it is dependency-free by design, which makes this cheap and total.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolvingNodeModules } from './resolve-node-modules.mjs'

export const PURE_MODULE_REL = 'lib/marketing-brain/deliverable-path.ts'

/**
 * Bundle + import the pure module.
 * @param {string} repoRoot absolute path to the repo root
 * @returns {Promise<{ok: true, mod: object} | {ok: false, error: string}>}
 */
export async function loadDeliverablePath(repoRoot) {
  const src = join(repoRoot, PURE_MODULE_REL)
  if (!existsSync(src)) return { ok: false, error: `${PURE_MODULE_REL} not found` }

  // Same resolution every other executing gate uses. Joining repoRoot is wrong
  // in a git worktree: node_modules there is a stub and imports resolve by
  // walking up to the main checkout, so this reported "esbuild not installed"
  // on machines where esbuild was installed. That took ci:deliverable-library-scope
  // (28 adversarial path fixtures) and scripts/render-worker.mjs dark at once.
  const esbuild = join(resolvingNodeModules(), '.bin/esbuild')
  if (!existsSync(esbuild)) return { ok: false, error: 'esbuild not installed' }

  const dir = mkdtempSync(join(tmpdir(), 'rr-deliv-path-'))
  const out = join(dir, 'pure.mjs')
  try {
    execFileSync(esbuild, [src, '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'], {
      stdio: 'pipe',
    })
    const mod = await import(pathToFileURL(out).href)
    const missing = ['safeSegment', 'buildDeliverablePath', 'pathBelongsToBroker'].filter(
      (n) => typeof mod[n] !== 'function',
    )
    if (missing.length) return { ok: false, error: `missing exports: ${missing.join(', ')}` }
    return { ok: true, mod }
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
