#!/usr/bin/env node
/**
 * Render an HTML ad mockup to a 1080×1080 JPG via Playwright.
 * Usage: node scripts/_render-ad-image.mjs <input.html> <output.jpg>
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [,, htmlArg, outArg] = process.argv
if (!htmlArg || !outArg) {
  console.error('Usage: node scripts/_render-ad-image.mjs <input.html> <output.jpg>')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = resolve(process.cwd(), htmlArg)
const outPath = resolve(process.cwd(), outArg)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
// Give fonts an extra moment to settle
await page.waitForTimeout(500)
await page.screenshot({ path: outPath, type: 'jpeg', quality: 92, fullPage: false, clip: { x: 0, y: 0, width: 1080, height: 1080 } })
await browser.close()

console.log(`Rendered ${outPath}`)
