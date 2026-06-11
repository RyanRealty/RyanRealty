import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  extraHTTPHeaders: { 'x-forwarded-for': '73.157.10.20' },
  viewport: { width: 1440, height: 1300 },
})
const page = await ctx.newPage()
await page.goto('http://localhost:3000/lp/seller-home-value', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('img[alt*="Ryan Realty team"]', { state: 'visible', timeout: 60000 })
await page.waitForTimeout(2500)
const box = await page.locator('img[alt*="Ryan Realty team"]').boundingBox()
console.log('team img box:', JSON.stringify(box))
const y = box ? Math.max(0, box.y - 10) : 470
await page.screenshot({ path: 'out/lp-review/seller-social-proof.png', clip: { x: 40, y, width: 720, height: 360 } })
console.log('shot OK')
await browser.close()
