/**
 * Reproduce-or-reject the served place-pages punch slice at 390 + 1280.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = '/tmp/place-pages-v10'
mkdirSync(OUT, { recursive: true })
mkdirSync('/opt/cursor/artifacts', { recursive: true })

const PAGES = [
  { slug: 'awbrey-view', url: 'https://ryan-realty.com/subdivisions/awbrey-view' },
  { slug: 'bella-sera', url: 'https://ryan-realty.com/subdivisions/bella-sera' },
  { slug: 'breckenridge', url: 'https://ryan-realty.com/subdivisions/breckenridge' },
  { slug: 'ayres-acres', url: 'https://ryan-realty.com/subdivisions/ayres-acres' },
  { slug: 'crooked-river-ranch', url: 'https://ryan-realty.com/communities/crooked-river-ranch' },
  { slug: 'bear-springs-acres', url: 'https://ryan-realty.com/subdivisions/bear-springs-acres' },
  { slug: 'brier-ridge', url: 'https://ryan-realty.com/subdivisions/brier-ridge' },
  { slug: 'cascade-meadow-ranch', url: 'https://ryan-realty.com/subdivisions/cascade-meadow-ranch' },
]

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 900 },
]

const browser = await chromium.launch({ headless: true })
const results = []

for (const pageDef of PAGES) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    const started = Date.now()
    const response = await page.goto(pageDef.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(2500)
    const title = await page.title()
    const h1 = await page.locator('h1').first().innerText().catch(() => '')
    const h1Count = await page.locator('h1').count()
    const bodyText = await page.locator('body').innerText()
    const emptyState = /No active listings/i.test(bodyText)
    const salesHistory = /sales history/i.test(bodyText)
    const listingCards = await page.locator('a[href*="/homes-for-sale/"]').count()
    const chromeOnly = h1Count === 0 && !emptyState && listingCards === 0
    const shot = `${OUT}/${pageDef.slug}_${vp.name}.png`
    await page.screenshot({ path: shot, fullPage: false })
    const artifact = `/opt/cursor/artifacts/repro_${pageDef.slug}_${vp.name}.png`
    await page.screenshot({ path: artifact, fullPage: false })
    results.push({
      slug: pageDef.slug,
      viewport: vp.name,
      status: response?.status() ?? null,
      ms: Date.now() - started,
      title,
      h1,
      h1Count,
      emptyState,
      salesHistory,
      listingCards,
      chromeOnly,
      bodyPreview: bodyText.replace(/\s+/g, ' ').slice(0, 280),
      shot,
      artifact,
    })
    await context.close()
  }
}

await browser.close()
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
