import { chromium } from 'playwright'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const XFF = { 'x-forwarded-for': '73.157.10.20' }
const URL = 'http://localhost:3000/lp/seller-home-value'

async function settleScroll(page) {
  // Walk the page top→bottom so every IntersectionObserver fires, then let the
  // chart draw-in + card count-up animations finish before capturing.
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const h = document.body.scrollHeight
    for (let y = 0; y <= h; y += 400) {
      window.scrollTo(0, y)
      await sleep(120)
    }
    window.scrollTo(0, h)
    await sleep(400)
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(2200)
}

const browser = await chromium.launch()

// ── Desktop ────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ userAgent: UA, extraHTTPHeaders: XFF, viewport: { width: 1440, height: 1400 } })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })
  await settleScroll(page)
  await page.screenshot({ path: 'out/lp-review/seller-DESKTOP.png', fullPage: true })
  const market = page.locator('section', { hasText: 'Where Bend stands today' }).first()
  await market.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  await market.screenshot({ path: 'out/lp-review/seller-MARKET-desktop.png' })
  await ctx.close()
}

// ── Mobile ───────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    userAgent: UA,
    extraHTTPHeaders: XFF,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })
  await settleScroll(page)
  await page.screenshot({ path: 'out/lp-review/seller-MOBILE.png', fullPage: true })
  const market = page.locator('section', { hasText: 'Where Bend stands today' }).first()
  await market.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  await market.screenshot({ path: 'out/lp-review/seller-MARKET-mobile.png' })
  await ctx.close()
}

await browser.close()
console.log('shots written to out/lp-review/: seller-DESKTOP.png, seller-MARKET-desktop.png, seller-MOBILE.png, seller-MARKET-mobile.png')
