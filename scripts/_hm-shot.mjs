// Render-verify harness for the housing-market flagship rebuild.
// Captures /housing-market/bend (desktop + mobile, full page) so Matt + the
// orchestrator can eyeball the real rendered page before the pattern is copied
// to the other market routes.
//   Local:  BASE=http://localhost:3000 node scripts/_hm-shot.mjs
//   Prod:   BASE=https://ryan-realty.com node scripts/_hm-shot.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const ROUTE = process.env.ROUTE || '/housing-market/bend'
const OUT = '/Users/matthewryan/RyanRealty/out/housing-market-verify'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const results = []

async function dismiss(page) {
  for (const label of ['Maybe later', 'Accept All', 'Accept all', 'Essential only', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 300 })) await btn.click({ timeout: 600 })
    } catch {}
  }
}

for (const v of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
  })
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await dismiss(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/hm-bend-${v.name}.png`, fullPage: true })
    results.push(`OK ${v.name} status=${res?.status()}`)
  } catch (e) {
    results.push(`FAIL ${v.name}: ${e.message}`)
  }
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
console.log('OUT ' + OUT)
