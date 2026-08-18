#!/usr/bin/env node
/**
 * should-create-release.mjs — GitHub Release gate for push-to-main.
 *
 * Docs / skills / rules / plans / handoffs-only pushes must not mint a tag
 * or GitHub Release. Product/buildable diffs still release.
 *
 * Classifier: scripts/lib/product-diff.mjs (same idea as vercel-ignore-build;
 * migrations count as a product release even though they skip the Next compile).
 *
 * Writes should_release=true|false to GITHUB_OUTPUT when that env is set.
 * Always exits 0 — a classify miss must not fail the workflow; unknown → release.
 *
 * Usage (release.yml):
 *   PRODUCT_DIFF_PREV=${{ github.event.before }} node scripts/should-create-release.mjs
 */
import { appendFileSync } from 'node:fs'
import {
  classifyDiff,
  isReleaseSkippable,
  isUsableSha,
  listChangedFiles,
} from './lib/product-diff.mjs'

const prev = (process.env.PRODUCT_DIFF_PREV || process.env.GITHUB_EVENT_BEFORE || '').trim()
const files = listChangedFiles({ prev: isUsableSha(prev) ? prev : '' })
const result = classifyDiff(files, { skippable: isReleaseSkippable })

// unknown / empty-with-no-git → do not swallow a product release.
const shouldRelease = result.status === 'build' || result.status === 'unknown'

if (result.status === 'unknown') {
  console.log('[should-create-release] no diff available — creating release')
} else if (result.status === 'empty') {
  console.log('[should-create-release] empty diff — skip release')
} else if (result.status === 'skip') {
  console.log(
    `[should-create-release] SKIP — ${result.files.length} file(s), none are product/buildable`,
  )
  for (const f of result.files.slice(0, 20)) console.log(`  · ${f}`)
} else {
  console.log(
    `[should-create-release] RELEASE — ${result.blockers.length} product/buildable change(s)`,
  )
  for (const f of result.blockers.slice(0, 20)) console.log(`  · ${f}`)
}

const line = `should_release=${shouldRelease ? 'true' : 'false'}`
console.log(line)

const out = (process.env.GITHUB_OUTPUT || '').trim()
if (out) {
  appendFileSync(out, `${line}\n`)
}
