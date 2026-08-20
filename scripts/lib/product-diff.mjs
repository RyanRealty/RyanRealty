/**
 * product-diff.mjs — shared "does this push change the product?" classifier.
 *
 * Used by:
 *   - scripts/vercel-ignore-build.mjs  (Vercel ignoreCommand — skip Next compile)
 *   - scripts/should-create-release.mjs (GitHub Release — skip docs/skills/plans)
 *
 * Keep the skip lists in ONE place so a docs-only push cannot skip the Vercel
 * build and still mint a GitHub Release (or the reverse).
 */
import { execSync } from 'node:child_process'

/** Paths that never change the production Next.js output. */
export const SKIP_PREFIXES = [
  'docs/',
  '.cursor/',
  '.claude/',
  '.github/',
  '.husky/',
  '.auto-memory/',
  'marketing_brain_skills/',
  'social_media_skills/',
  'automation_skills/',
  'video_production_skills/',
  'design_system/', // mockups / parity contracts — not imported by the app build
  'scripts/', // CI gates + one-off scripts; runtime code lives in app/lib
  'supabase/migrations/', // SQL applies to the DB out-of-band; never changes the Next build output
]

export const SKIP_EXACT = new Set([
  'CHANGELOG.md',
  'CLAUDE.md',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'README.md',
  '.gitignore',
  '.design-token-lint-ignore',
])

export const SKIP_SUFFIXES = ['.md', '.mdc', '.png', '.jpg', '.jpeg', '.webp', '.gif']

const ZERO_SHA = /^0+$/

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isVercelSkippable(file) {
  if (SKIP_EXACT.has(file)) return true
  if (SKIP_PREFIXES.some((p) => file.startsWith(p))) return true
  // Pure markdown / cursor rules at repo root or nested (not under app/).
  if (!file.startsWith('app/') && SKIP_SUFFIXES.some((s) => file.endsWith(s))) return true
  return false
}

/**
 * GitHub Release skip: same as the Vercel Next-build skip, except hosted
 * migrations are a product change even when they do not change the Next
 * compile. A docs/skills/plans/.github-only push must not tag a release.
 *
 * @param {string} file
 * @returns {boolean}
 */
export function isReleaseSkippable(file) {
  if (file.startsWith('supabase/migrations/')) return false
  return isVercelSkippable(file)
}

/**
 * @param {string | undefined | null} sha
 * @returns {boolean}
 */
export function isUsableSha(sha) {
  const s = (sha || '').trim()
  return s.length >= 7 && !ZERO_SHA.test(s)
}

/**
 * @param {{ prev?: string, head?: string }} [opts]
 * @returns {string[] | null}  null = git failed / unknown (caller should build/release)
 */
export function listChangedFiles(opts = {}) {
  const prev = (opts.prev ?? process.env.VERCEL_GIT_PREVIOUS_SHA ?? process.env.PRODUCT_DIFF_PREV ?? '').trim()
  const head = (opts.head ?? 'HEAD').trim() || 'HEAD'
  try {
    const cmd = isUsableSha(prev)
      ? `git diff --name-only ${prev}...${head}`
      : `git diff-tree --no-commit-id --name-only -r ${head}`
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

/**
 * @param {string[] | null} files
 * @param {{ skippable?: (file: string) => boolean }} [opts]
 * @returns {{ status: 'unknown' | 'empty' | 'skip' | 'build', files: string[], blockers: string[] }}
 */
export function classifyDiff(files, opts = {}) {
  const skippable = opts.skippable ?? isVercelSkippable
  if (!files) return { status: 'unknown', files: [], blockers: [] }
  if (files.length === 0) return { status: 'empty', files, blockers: [] }
  const blockers = files.filter((f) => !skippable(f))
  return {
    status: blockers.length === 0 ? 'skip' : 'build',
    files,
    blockers,
  }
}
