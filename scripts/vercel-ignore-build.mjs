#!/usr/bin/env node
/**
 * vercel-ignore-build.mjs — Ignored Build Step for Vercel.
 *
 * Exit 0 = SKIP the build (no Next.js compile). Exit 1 = build as usual.
 *
 * Why this exists: July 2026 Pro bill was ~$540 in Build CPU Minutes because
 * every push to main (incl. "chore: update changelog" and docs-only agent
 * commits) triggered a full production build of this Next app. Traffic was
 * cheap; build churn was not.
 *
 * Wired via vercel.json → ignoreCommand.
 */
import { execSync } from 'node:child_process'

/** Paths that never change the production Next.js output. */
const SKIP_PREFIXES = [
  'docs/',
  '.cursor/',
  '.claude/',
  '.github/',
  '.auto-memory/',
  'marketing_brain_skills/',
  'social_media_skills/',
  'automation_skills/',
  'video_production_skills/',
  'design_system/', // mockups / parity contracts — not imported by the app build
  'scripts/', // CI gates + one-off scripts; runtime code lives in app/lib
]

const SKIP_EXACT = new Set([
  'CHANGELOG.md',
  'CLAUDE.md',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'README.md',
  '.gitignore',
  '.design-token-lint-ignore',
])

const SKIP_SUFFIXES = ['.md', '.mdc', '.png', '.jpg', '.jpeg', '.webp', '.gif']

// Preview / non-production: always skip. Pushing wt/* or cloud branches to
// GitHub used to start a full Turbo Preview build (extra Build CPU on top of
// production). Production keeps the docs/skills path filter below.
// Belt-and-suspenders with project setting previewDeploymentsDisabled=true.
const vercelEnv = (process.env.VERCEL_ENV || '').trim()
if (vercelEnv && vercelEnv !== 'production') {
  console.log(`[vercel-ignore-build] SKIP — non-production env (${vercelEnv})`)
  process.exit(0)
}

function changedFiles() {
  // Vercel often uses a shallow clone. Prefer VERCEL_GIT_PREVIOUS_SHA; if it is
  // missing, inspect only the tip commit via diff-tree (works at depth=1).
  // Falling back to HEAD^ used to throw on shallow clones → we returned null
  // → exit 1 → every docs push still burned a full production build.
  const prev = (process.env.VERCEL_GIT_PREVIOUS_SHA || '').trim()
  try {
    const cmd = prev
      ? `git diff --name-only ${prev}...HEAD`
      : 'git diff-tree --no-commit-id --name-only -r HEAD'
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    // First deploy / corrupt git state → always build.
    return null
  }
}

function isSkippable(file) {
  if (SKIP_EXACT.has(file)) return true
  if (SKIP_PREFIXES.some((p) => file.startsWith(p))) return true
  // Pure markdown / cursor rules at repo root or nested (not under app/).
  if (!file.startsWith('app/') && SKIP_SUFFIXES.some((s) => file.endsWith(s))) return true
  return false
}

const files = changedFiles()
if (!files) {
  console.log('[vercel-ignore-build] no diff available — building')
  process.exit(1)
}
if (files.length === 0) {
  console.log('[vercel-ignore-build] empty diff — skip')
  process.exit(0)
}

const blockers = files.filter((f) => !isSkippable(f))
if (blockers.length === 0) {
  console.log(`[vercel-ignore-build] SKIP — ${files.length} file(s), none affect the Next build`)
  for (const f of files.slice(0, 20)) console.log(`  · ${f}`)
  process.exit(0)
}

console.log(`[vercel-ignore-build] BUILD — ${blockers.length} runtime-affecting change(s)`)
for (const f of blockers.slice(0, 20)) console.log(`  · ${f}`)
process.exit(1)
