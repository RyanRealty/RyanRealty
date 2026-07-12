// /sell conversion rework — draft screenshots for Matt's sign-off.
// Captures the dev-server page (desktop + mobile, fold + full page).
// Usage: node scripts/_sell-shot.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = '/Users/matthewryan/RyanRealty/out/sell-rework'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const results = []

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Accept All', 'Accept all', 'Essential only', 'Got it']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 300 })) await btn.click({ timeout: 600 })
    } catch {}
  }
}

// Walk the page so Lenis + ScrollTrigger fire every reveal before the
// stitched full-page capture (once:true reveals stay visible after firing).
async function primeScrollReveals(page) {
  const height = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0; y < height; y += 600) {
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(1200)
  await page.mouse.wheel(0, -height * 2)
  await page.waitForTimeout(1500)
}

for (const v of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 2,
  })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
  })
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/sell`, { waitUntil: 'load', timeout: 120000 })
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/sell-${v.name}-fold.png` })
    results.push(`OK sell-${v.name}-fold`)
    await primeScrollReveals(page)
    await page.screenshot({ path: `${OUT}/sell-${v.name}-full.png`, fullPage: true })
    results.push(`OK sell-${v.name}-full`)
  } catch (e) {
    results.push(`FAIL sell-${v.name}: ${e.message}`)
  }
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
