// Viewport-sized captures at real scroll positions (no fullPage stitching) —
// distinguishes a captureBeyondViewport artifact from genuinely unpainted DOM.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = '/Users/matthewryan/RyanRealty/out/sell-rework'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(`${BASE}/sell`, { waitUntil: 'load', timeout: 120000 })
await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
await page.waitForTimeout(2000)

// Real wheel scrolling so Lenis drives the scroll.
const stops = [
  ['proof', '#track-record'],
  ['reviews', '#reviews'],
  ['plan', '#marketing-plan'],
  ['insight', '#pricing-insight'],
]
for (const [name, sel] of stops) {
  const target = await page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? el.getBoundingClientRect().top + window.scrollY : null
  }, sel)
  if (target == null) { console.log(`MISS ${name}`); continue }
  // wheel toward target in chunks
  let current = await page.evaluate(() => window.scrollY)
  let guard = 0
  while (Math.abs(current - target) > 60 && guard < 120) {
    const delta = Math.max(-1200, Math.min(1200, target - current))
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(90)
    current = await page.evaluate(() => window.scrollY)
    guard++
  }
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/stop-${name}.png` })
  console.log(`OK ${name} at scrollY=${current} (target ${Math.round(target)})`)
}
await browser.close()
