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
  // Unit tests and the repo-root test/ harness do not change the Next build.
  // Prefix only: app/api/push/test and app/api/google-business-profile/test are
  // live routes, so a path segment named "test" must still build.
  if (file.startsWith('test/')) return true
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) return true
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
 * The files `head` changed. With a usable `prev`, the range prev...head; without
 * one, the commit itself, a merge commit against its FIRST parent (what it brought
 * into the branch). Plain `git diff-tree -r` prints nothing for a merge, so a
 * merged PR read as an empty diff: vercel-ignore-build skipped the production
 * build and deploy:verify gave the deploy only the 45-second SKIP window.
 *
 * @param {{ prev?: string, head?: string, cwd?: string }} [opts]
 * @returns {string[] | null}  null = git failed / unknown (caller should build/release)
 */
export function listChangedFiles(opts = {}) {
  const prev = (opts.prev ?? process.env.VERCEL_GIT_PREVIOUS_SHA ?? process.env.PRODUCT_DIFF_PREV ?? '').trim()
  const head = (opts.head ?? 'HEAD').trim() || 'HEAD'
  try {
    const cmd = isUsableSha(prev)
      ? `git diff --name-only ${prev}...${head}`
      : `git diff-tree --no-commit-id --name-only -r --diff-merges=first-parent ${head}`
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...(opts.cwd
        ? {
            cwd: opts.cwd,
            // A pre-commit hook sets GIT_DIR to this repo. Honor cwd.
            env: Object.fromEntries(
              Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
            ),
          }
        : {}),
    })
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

function gitOpts(cwd) {
  return {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    ...(cwd
      ? {
          cwd,
          env: Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
          ),
        }
      : {}),
  }
}

function gitShow(rev, file, cwd) {
  try {
    return execSync(`git show ${rev}:${file}`, gitOpts(cwd))
  } catch {
    return null
  }
}

function gitRevParse(rev, cwd) {
  try {
    return execSync(`git rev-parse ${rev}`, gitOpts(cwd)).trim()
  } catch {
    return ''
  }
}

function gitMergeBase(a, b, cwd) {
  try {
    return execSync(`git merge-base ${a} ${b}`, gitOpts(cwd)).trim()
  } catch {
    return ''
  }
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])]),
    )
  }
  return value
}

/**
 * True when package.json changed only under `scripts` (npm script names).
 * A dependency, engines, or exports edit still rebuilds Next.
 *
 * @param {{ prev?: string, head?: string, cwd?: string }} [opts]
 * @returns {boolean}
 */
export function packageJsonChangeIsScriptsOnly(opts = {}) {
  const head = (opts.head ?? 'HEAD').trim() || 'HEAD'
  let prev = (opts.prev ?? '').trim()
  if (isUsableSha(prev)) {
    const mergeBase = gitMergeBase(prev, head, opts.cwd)
    if (isUsableSha(mergeBase)) prev = mergeBase
  } else {
    prev = gitRevParse(`${head}^`, opts.cwd)
    if (!isUsableSha(prev)) return false
  }
  const before = gitShow(prev, 'package.json', opts.cwd)
  const after = gitShow(head, 'package.json', opts.cwd)
  if (before == null || after == null) return false
  try {
    const strip = (text) => {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('package.json is not an object')
      }
      const { scripts: _scripts, ...rest } = parsed
      return JSON.stringify(sortKeysDeep(rest))
    }
    return strip(before) === strip(after)
  } catch {
    return false
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

/**
 * Same as classifyDiff, plus: a scripts-only package.json edit does not
 * change the Next compile (Matt's cost-aware skip). Fail closed when git
 * cannot prove the rest of the file is unchanged.
 *
 * @param {string[] | null} files
 * @param {{
 *   skippable?: (file: string) => boolean
 *   packageJsonScriptsOnly?: boolean
 *   prev?: string
 *   head?: string
 *   cwd?: string
 * }} [opts]
 */
export function classifyProductDiff(files, opts = {}) {
  if (!files) return classifyDiff(null)
  const skippable = opts.skippable ?? isVercelSkippable
  let scriptsOnly = opts.packageJsonScriptsOnly
  if (scriptsOnly == null && files.includes('package.json')) {
    scriptsOnly = packageJsonChangeIsScriptsOnly({
      prev: opts.prev,
      head: opts.head,
      cwd: opts.cwd,
    })
  }
  return classifyDiff(files, {
    skippable: (file) => skippable(file) || (Boolean(scriptsOnly) && file === 'package.json'),
  })
}
