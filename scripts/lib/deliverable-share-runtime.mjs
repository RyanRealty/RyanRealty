/**
 * Bundle + import lib/marketing-brain/deliverable-share.ts from plain .mjs so
 * ci:deliverable-share-safety can EXECUTE the allowlist against a fixture table
 * rather than grep its source (the W10.2 lesson: a security gate that reads text
 * instead of running the code is defeatable by respelling). The module is pure
 * (no imports), so bundling is cheap and total.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolvingNodeModules } from './resolve-node-modules.mjs'

export const SHARE_MODULE_REL = 'lib/marketing-brain/deliverable-share.ts'

export async function loadShareModule(repoRoot) {
  const src = join(repoRoot, SHARE_MODULE_REL)
  if (!existsSync(src)) return { ok: false, error: `${SHARE_MODULE_REL} not found` }
  // Resolve esbuild the way every other executing gate does. A git worktree has
  // its own (usually empty) node_modules, so joining repoRoot hard-failed this
  // SECURITY gate to "esbuild not installed" in every worktree — a false red
  // that invites being waved past. resolvingNodeModules() walks up to the real
  // install the same Node resolution the scripts already rely on would find.
  const esbuild = join(resolvingNodeModules(), '.bin/esbuild')
  if (!existsSync(esbuild)) return { ok: false, error: 'esbuild not installed' }

  const dir = mkdtempSync(join(tmpdir(), 'rr-share-'))
  const out = join(dir, 'share.mjs')
  try {
    execFileSync(esbuild, [src, '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'], {
      stdio: 'pipe',
    })
    const mod = await import(pathToFileURL(out).href)
    return { ok: true, mod }
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
