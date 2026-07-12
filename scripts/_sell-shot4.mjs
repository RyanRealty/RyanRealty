import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const OUT = '/Users/matthewryan/RyanRealty/out/sell-rework'
const browser = await chromium.launch()
for (const v of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/sell`, { waitUntil: 'load', timeout: 120000 })
  for (const label of ['Maybe later', 'Essential only']) {
    try { const b = page.getByRole('button', { name: label }).first(); if (await b.isVisible({ timeout: 400 })) await b.click({ timeout: 600 }) } catch {}
  }
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/h1-${v.name}-fold.png` })
  console.log(`OK h1-${v.name}-fold`)
  await ctx.close()
}
await browser.close()
