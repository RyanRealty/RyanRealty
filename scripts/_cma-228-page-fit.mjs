#!/usr/bin/env node
/**
 * Page-fit bleed check for the 228 SE Soft Tail Dr CMA draft.
 *
 * Loads the rendered HTML in playwright (chromium), reads each .page's
 * actual footer position, and reports any non-footer / non-header descendant
 * whose bottom exceeds (footerTop - 4 px). Per SKILL.md §"layout discipline."
 *
 * Run: node scripts/_cma-228-page-fit.mjs
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const HTML_PATH = resolve(REPO_ROOT, 'public/drafts/cma-228-soft-tail/cma.html')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 816, height: 1056 } })
const page = await ctx.newPage()

await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500) // let images load

const result = await page.evaluate(() => {
  const pages = document.querySelectorAll('.page')
  const bleed = []
  pages.forEach((p, i) => {
    const pageTop = p.getBoundingClientRect().top
    const footer = p.querySelector('.pg-footer, footer')
    const footerTop = footer ? footer.getBoundingClientRect().top - pageTop : 1025
    p.querySelectorAll('*').forEach(el => {
      if (el.tagName === 'FOOTER' || el.closest('.pg-footer, footer')) return
      if (el.tagName === 'HEADER' || el.closest('.pg-header, header')) return
      const r = el.getBoundingClientRect()
      const bottom = r.bottom - pageTop
      if (bottom > footerTop - 4) {
        bleed.push({
          page: i + 1,
          tag: el.tagName,
          cls: el.className.toString().slice(0, 80),
          text: (el.textContent || '').trim().slice(0, 80),
          overshoot: Math.round(bottom - (footerTop - 4)),
          footerTop: Math.round(footerTop),
        })
      }
    })
  })
  return bleed
})

await browser.close()

console.log(`=== Page-fit bleed check ===`)
console.log(`Total bleed violations: ${result.length}`)

if (result.length === 0) {
  console.log('✓ PASS')
  process.exit(0)
}

// Group by page
const byPage = {}
for (const b of result) {
  byPage[b.page] = byPage[b.page] || []
  byPage[b.page].push(b)
}

for (const [pg, items] of Object.entries(byPage)) {
  console.log(`\nPage ${pg} (${items.length} bleed items, footerTop=${items[0].footerTop}):`)
  // dedupe by overshoot + text  
  const seen = new Set()
  for (const it of items) {
    const key = `${it.overshoot}|${it.text}`
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  +${it.overshoot}px | ${it.tag}.${it.cls} | "${it.text}"`)
  }
}

process.exit(1)
