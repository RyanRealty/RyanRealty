// Second capture pass: the below-fold composition (results tail → market
// snapshot → ladder) and the Source disclosure open. Scratch harness.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3106'
const OUT = process.env.OUT || '/tmp/search-shots3'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const out = []

for (const v of [
  { name: '1280', width: 1280, height: 900 },
  { name: '390', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 2,
    userAgent: UA,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/homes-for-sale/bend`, { waitUntil: 'load', timeout: 180000 })
  await page.waitForSelector('#search-price-ladder', { timeout: 60000 })
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
  await page.evaluate(() => {
    for (const n of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(n)
      if (cs.position === 'fixed' || cs.position === 'sticky') n.style.visibility = 'hidden'
    }
  })

  // 1. Composition: the market section from its heading down through the card.
  const secTop = await page.evaluate(
    () => document.getElementById('search-seo').getBoundingClientRect().top + window.scrollY,
  )
  let done = 0
  while (done < secTop - 20) {
    const step = Math.min(600, secTop - 20 - done)
    await page.mouse.wheel(0, step)
    done += step
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/context-${v.name}.png` })

  // 2. Source disclosure open.
  await page.evaluate(() => {
    document.querySelector('#search-price-ladder details').open = true
    document.getElementById('search-price-ladder').scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(600)
  const el = await page.$('#search-price-ladder')
  await el.screenshot({ path: `${OUT}/source-open-${v.name}.png` })
  const trace = await page.evaluate(
    () => document.querySelector('#search-price-ladder .v3-chartcard__source-body').textContent,
  )
  out.push(`${v.name} trace: ${trace}`)
  await ctx.close()
}

await browser.close()
for (const line of out) console.log(line)
