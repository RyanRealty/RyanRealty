import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const OUT = '/Users/matthewryan/RyanRealty/out/sell-rework'
const browser = await chromium.launch()
// Mobile stops on /sell
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(`${BASE}/sell`, { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(2000)
for (const [name, sel] of [['m-proof', '#track-record'], ['m-plan', '#marketing-plan']]) {
  const target = await page.evaluate((s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + window.scrollY : null }, sel)
  if (target == null) { console.log(`MISS ${name}`); continue }
  let current = await page.evaluate(() => window.scrollY); let guard = 0
  while (Math.abs(current - target) > 60 && guard < 200) {
    await page.mouse.wheel(0, Math.max(-1000, Math.min(1000, target - current)))
    await page.waitForTimeout(80)
    current = await page.evaluate(() => window.scrollY); guard++
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/stop-${name}.png` })
  console.log(`OK ${name} scrollY=${current}`)
}
await ctx.close()
// LP smoke: renders + form present
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const p2 = await ctx2.newPage()
const errors = []
p2.on('pageerror', (e) => errors.push(String(e)))
await p2.goto(`${BASE}/lp/seller-home-value`, { waitUntil: 'load', timeout: 120000 })
await p2.waitForTimeout(2500)
const hasForm = await p2.evaluate(() => !!document.querySelector('#get-value input'))
console.log(`LP form present: ${hasForm}; pageerrors: ${errors.length ? errors.join(' | ') : 'none'}`)
await browser.close()
