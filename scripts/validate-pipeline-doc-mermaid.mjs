#!/usr/bin/env node
// Headless validator for the pipeline doc HTML. Opens the HTML in Playwright
// (Chromium, headless), waits for mermaid to render every diagram, then
// reports any blocks that produced a parse error.
//
// Run:
//   node scripts/validate-pipeline-doc-mermaid.mjs
//
// Exit code:
//   0  every diagram rendered cleanly
//   1  one or more diagrams threw a syntax/parse error

import { chromium } from 'playwright'
import { resolve } from 'node:path'

const HTML_PATH = resolve(process.cwd(), 'docs/FACEBOOK_SELLER_GROWTH_PIPELINE.html')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const errors = []
page.on('pageerror', (err) => errors.push({ kind: 'pageerror', message: err.message }))
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push({ kind: 'console.error', message: msg.text() })
  }
})

await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle' })
// Give mermaid a couple seconds to finish all renders.
await page.waitForTimeout(3000)

const diagnostics = await page.evaluate(() => {
  const blocks = Array.from(document.querySelectorAll('.mermaid'))
  return blocks.map((el, idx) => {
    const hasSvg = !!el.querySelector('svg')
    const errorEl = el.querySelector('.error-text, .errorText')
    const errorIcon = el.querySelector('.error-icon, .errorIcon')
    const text = (el.textContent || '').slice(0, 80).trim()
    const hasErrorClass = el.dataset.processed === 'true' && !hasSvg
    return {
      index: idx,
      preview: text.split('\n')[0],
      hasSvg,
      errorText: errorEl ? errorEl.textContent.trim() : null,
      hasErrorIcon: !!errorIcon,
      processed: el.dataset.processed === 'true',
    }
  })
})

await browser.close()

let bad = 0
for (const d of diagnostics) {
  const status = d.hasSvg ? 'OK' : 'FAIL'
  console.log(
    `Diagram ${d.index + 1}: ${status}${d.errorText ? ' — ' + d.errorText : ''} | "${d.preview}"`
  )
  if (!d.hasSvg) bad += 1
}

if (errors.length) {
  console.log('\n=== Page errors ===')
  for (const e of errors) console.log(`[${e.kind}] ${e.message}`)
}

console.log(`\nResult: ${diagnostics.length - bad}/${diagnostics.length} diagrams rendered cleanly`)
if (bad > 0 || errors.some((e) => /mermaid|parse|syntax/i.test(e.message))) {
  process.exit(1)
}
