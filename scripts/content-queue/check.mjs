#!/usr/bin/env node
/**
 * ci:content-queue — required gate for social drafts (AGENTS.md "Social content queue").
 *
 * 1. Self-test: every fixture under fixtures/bad MUST fail with the reason named in its
 *    `expect_fail` frontmatter, and every fixture under fixtures/good MUST pass. If the gate
 *    stops catching a bad fixture, CI goes red.
 * 2. Every draft in content-queue/<slug>/<platform>.md must pass.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDraft, listDrafts, readSource, parseFrontmatter } from './lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = join(ROOT, 'scripts', 'content-queue', 'fixtures')
let failed = 0

function run(root) {
  return listDrafts(root).map((d) => {
    const sourceText = readSource(root, d.slug)
    const text = readFileSync(d.file, 'utf8')
    const errs = sourceText == null ? [`missing ${d.slug}/source.md snapshot`] : checkDraft({ text, platform: d.platform, slug: d.slug, sourceText })
    return { ...d, text, errs }
  })
}

const bad = run(join(FIX, 'bad'))
if (bad.length < 7) { console.error(`self-test: expected at least 7 bad fixtures, found ${bad.length}`); failed++ }
for (const r of bad) {
  const want = parseFrontmatter(r.text).data?.expect_fail
  const hit = r.errs.some((e) => want && e.includes(want))
  console.log(`${hit ? 'ok  ' : 'FAIL'} bad fixture ${r.slug}/${r.platform} rejected for "${want}"${hit ? '' : ` (got: ${r.errs.join('; ') || 'PASSED'})`}`)
  if (!hit) failed++
}
const good = run(join(FIX, 'good'))
if (good.length < 1) { console.error('self-test: no good fixtures'); failed++ }
for (const r of good) {
  console.log(`${r.errs.length ? 'FAIL' : 'ok  '} good fixture ${r.slug}/${r.platform}${r.errs.length ? `: ${r.errs.join('; ')}` : ''}`)
  if (r.errs.length) failed++
}

const queue = run(join(ROOT, 'content-queue'))
for (const r of queue) {
  if (r.errs.length) { failed++; console.log(`FAIL ${r.slug}/${r.platform}\n  - ${r.errs.join('\n  - ')}`) }
}
console.log(`content-queue: ${queue.length} drafts checked, ${queue.filter((r) => !r.errs.length).length} pass`)
if (failed) { console.error(`ci:content-queue: ${failed} failure(s)`); process.exit(1) }
console.log('ci:content-queue green')
