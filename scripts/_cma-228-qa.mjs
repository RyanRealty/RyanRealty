#!/usr/bin/env node
/**
 * QA gate for the 228 SE Soft Tail Dr CMA draft.
 *
 *   1. Em-dash usage in narrative (manual review)
 *   2. HEAD-check every hero photo URL
 *   3. Page count + footer page-of-N consistency
 *   4. Map endpoint registration check (lib/cma-map.ts)
 *
 * Page-fit headless-browser bleed check is run separately via
 * scripts/_cma-228-page-fit.mjs (requires puppeteer).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const HTML_PATH = resolve(REPO_ROOT, 'public/drafts/cma-228-soft-tail/cma.html')

const html = readFileSync(HTML_PATH, 'utf8')

// Strip quoted MLS public_remarks + style/head before scanning narrative text.
const NARRATIVE = html
  // Drop the quoted MLS remarks (flyer-desc paragraphs)
  .replace(/<p class="flyer-desc">[\s\S]*?<\/p>/g, '')
  // Drop the cover hero caption + similar quoted blocks
  // Keep everything else (cover, narrative paragraphs, headers)
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<head[\s\S]*?<\/head>/g, '')

// Em-dash usage in narrative (allowed only as data placeholder)
const emDashLines = NARRATIVE.split('\n').filter(l => l.includes('—') && !l.match(/<td/) && !l.includes('<th'))
console.log(`=== 1. Em-dash usage in narrative ===`)
console.log(`  ${emDashLines.length} lines contain em-dash (manual review — allowed where used as a separator/punctuation per design system)`)

// 2. Hero photo HEAD-check
console.log('\n=== 2. Hero photo HEAD-check ===')
const photoUrls = [...new Set(html.match(/https:\/\/cdn\.resize\.sparkplatform\.com[^"'\s]+/g) || [])]
console.log(`  ${photoUrls.length} unique photo URLs found`)

let photoOk = 0
let photoFail = 0
const failed = []
for (const url of photoUrls) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (res.ok) photoOk++
    else {
      photoFail++
      failed.push(`${res.status} ${url}`)
    }
  } catch (e) {
    photoFail++
    failed.push(`ERR ${url}`)
  }
}
console.log(`  ${photoOk} OK, ${photoFail} fail`)
if (failed.length) {
  console.log('  Failures:')
  failed.forEach(f => console.log(`    ${f}`))
}

// 3. Page count + footer consistency
console.log('\n=== 3. Page count + footer Page X of Y ===')
const sections = (html.match(/<section class="page">/g) || []).length
const footers = [...html.matchAll(/Page (\d+) of (\d+)/g)]
console.log(`  Sections: ${sections}`)
console.log(`  Footers: ${footers.length}`)
const totals = new Set(footers.map(m => m[2]))
const pageNums = footers.map(m => parseInt(m[1], 10))
const expected = Array.from({ length: sections }, (_, i) => i + 1)
console.log(`  Footer "of N" values: ${[...totals].join(', ')} (expected: ${sections})`)
const sequential = JSON.stringify(pageNums) === JSON.stringify(expected)
console.log(`  Sequential 1..${sections}: ${sequential ? 'PASS' : 'FAIL'}`)
if (!sequential) console.log(`  Got: ${pageNums.join(', ')}`)

// 4. Map endpoint registration
console.log('\n=== 4. Map endpoint registration ===')
const mapTs = readFileSync(resolve(REPO_ROOT, 'lib/cma-map.ts'), 'utf8')
const mapRegistered = mapTs.includes("'cma-228-soft-tail'")
console.log(`  cma-228-soft-tail in CMA_MAPS: ${mapRegistered ? 'PASS' : 'FAIL'}`)

const routeExists = (() => {
  try {
    readFileSync(resolve(REPO_ROOT, 'app/api/maps/cma-228-soft-tail/route.ts'))
    return true
  } catch {
    return false
  }
})()
console.log(`  /api/maps/cma-228-soft-tail/route.ts: ${routeExists ? 'EXISTS' : 'MISSING'}`)

console.log('\n=== Summary ===')
const ok = photoFail === 0 && sequential && mapRegistered && routeExists
console.log(ok ? '✓ ALL QA CHECKS PASS (page-fit not yet run)' : '✗ FAILURES — fix above')
