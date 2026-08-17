import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
mkdirSync(ART, { recursive: true })
const BASE = 'https://ryan-realty.com'

const shots = [
  { slug: 'retirement-central-oregon', sel: '#explore', name: 'cta' },
  { slug: 'retirement-central-oregon', find: 'avoiding 7 to 10 percent', name: 'tax' },
  { slug: 'broken-top-bend-golf-community', sel: '#related-homes', name: 'homes' },
  { slug: 'broken-top-bend-golf-community', find: 'Between the HOA and a full golf', name: 'hoa' },
  { slug: 'best-neighborhoods-bend-families', sel: '#related-homes', name: 'homes' },
  { slug: 'price-per-sqft-trends-central-oregon', find: 'Sunriver: $456', name: 'sunriver' },
  { slug: 'bend-oregon-market-report-june-2026', find: 'Active listings at month end: 503', name: 'may' },
  { slug: 'bend-oregon-market-report-june-2026', find: '531 active listings as of June 10', name: 'june' },
]

const browser = await chromium.launch({ headless: true })
for (const width of [390, 1280]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const page = await context.newPage()
  for (const spec of shots) {
    await page.goto(`${BASE}/blog/${spec.slug}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(1200)
    await page.evaluate(() => {
      document.querySelector('[aria-label*="cookie" i], [class*="cookie" i]')?.remove()
      for (const el of document.querySelectorAll('button')) {
        if (/accept all|essential only/i.test(el.textContent || '')) el.click()
      }
      for (const el of document.querySelectorAll('[role="dialog"], [data-state="open"]')) {
        if (/alerts when homes match/i.test(el.textContent || '')) el.remove()
      }
    })
    await page.waitForTimeout(400)
    if (spec.find) {
      await page.evaluate((needle) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          if ((walker.currentNode.textContent || '').includes(needle)) {
            walker.currentNode.parentElement?.scrollIntoView({ block: 'center' })
            break
          }
        }
      }, spec.find)
      await page.waitForTimeout(200)
    } else if (spec.sel) {
      const loc = page.locator(spec.sel)
      if (await loc.count()) {
        await loc.first().scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
      }
    }
    await page.screenshot({ path: `${ART}/reject_${spec.slug}_${width}_${spec.name}.png` })
  }
  await context.close()
}
await browser.close()
console.log('clear shots written')
