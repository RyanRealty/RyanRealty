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
 * Skip list lives in scripts/lib/product-diff.mjs (shared with release.yml).
 */
import { classifyDiff, isVercelSkippable, listChangedFiles } from './lib/product-diff.mjs'

// Preview / non-production: always skip. Pushing wt/* or cloud branches to
// GitHub used to start a full Turbo Preview build (extra Build CPU on top of
// production). Production keeps the docs/skills path filter below.
// Belt-and-suspenders with project setting previewDeploymentsDisabled=true.
const vercelEnv = (process.env.VERCEL_ENV || '').trim()
const commitRef = (process.env.VERCEL_GIT_COMMIT_REF || '').trim()

// PR 161 / homepage stack — allow walkable Vercel previews of the listing
// land-face branch and the homepage restyle stacked on it. Production (main)
// ignore behavior is unchanged.
if (
  commitRef === 'cursor/listing-land-face-d3ec' ||
  commitRef === 'cursor/homepage-restyle-e216' ||
  commitRef === 'cursor/search-field-restyle-f6ee' ||
  commitRef === 'cursor/sell-restyle-8b1d' ||
  commitRef === 'cursor/valuation-restyle-942b' ||
  commitRef === 'cursor/city-restyle-ba64' ||
  commitRef === 'cursor/neighborhood-restyle-cfa4'
) {
  console.log(`[vercel-ignore-build] BUILD — allowlisted preview branch (${commitRef})`)
  process.exit(1)
}

if (vercelEnv && vercelEnv !== 'production') {
  console.log(`[vercel-ignore-build] SKIP — non-production env (${vercelEnv})`)
  process.exit(0)
}

const files = listChangedFiles()
const result = classifyDiff(files, { skippable: isVercelSkippable })

if (result.status === 'unknown') {
  console.log('[vercel-ignore-build] no diff available — building')
  process.exit(1)
}
if (result.status === 'empty') {
  console.log('[vercel-ignore-build] empty diff — skip')
  process.exit(0)
}
if (result.status === 'skip') {
  console.log(`[vercel-ignore-build] SKIP — ${result.files.length} file(s), none affect the Next build`)
  for (const f of result.files.slice(0, 20)) console.log(`  · ${f}`)
  process.exit(0)
}

console.log(`[vercel-ignore-build] BUILD — ${result.blockers.length} runtime-affecting change(s)`)
for (const f of result.blockers.slice(0, 20)) console.log(`  · ${f}`)
process.exit(1)
