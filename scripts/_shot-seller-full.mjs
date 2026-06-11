import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  extraHTTPHeaders: { 'x-forwarded-for': '73.157.10.20' },
  viewport: { width: 1440, height: 900 },
})
const page = await ctx.newPage()
await page.goto('http://localhost:3000/lp/seller-home-value', { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForSelector('#seller-lp-address', { state: 'visible', timeout: 60000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'out/lp-review/seller-FULLPAGE.png', fullPage: true })
console.log('fullpage OK')
await browser.close()
