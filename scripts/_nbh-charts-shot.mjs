// Unit NEIGHBORHOOD chart-room rollout — capture the market section of a Bend
// district page at 500 and 1280 so every chart is LOOKED AT, not assumed.
//
// Usage: BASE=http://localhost:3104 node scripts/_nbh-charts-shot.mjs [slug]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3104'
const SLUG = process.argv[2] || 'awbrey-butte'
const OUT = 'out/nbh-charts'
mkdirSync(OUT, { recursive: true })

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const browser = await chromium.launch()

async function capture(width, height, label) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    userAgent: UA,
    deviceScaleFactor: 2,
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
      document.cookie =
        'ryan_realty_cookie_consent=' +
        encodeURIComponent(JSON.stringify({ analytics: true, marketing: true })) +
        '; path=/'
    } catch {}
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 180))
  })
  const res = await page.goto(`${BASE}/cities/bend/${SLUG}`, {
    waitUntil: 'domcontentloaded',
    timeout: 180000,
  })
  // Scroll the whole page so every lazy section mounts, then come back.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight
    for (let y = 0; y < h; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(2500)

  const cards = page.locator('h3.text-base.font-semibold.text-primary')
  const titles = await cards.allTextContents()

  // The whole chart grid.
  const grid = page.locator('[aria-label*="sales history"]').first()
  await grid.scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await grid.screenshot({ path: `${OUT}/${SLUG}-charts-${label}.png` })

  // Each card on its own, and each switch panel of the history card.
  const articles = page.locator('[aria-label*="sales history"] > article')
  const n = await articles.count()
  for (let i = 0; i < n; i += 1) {
    const a = articles.nth(i)
    await a.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await a.screenshot({ path: `${OUT}/${SLUG}-card${i + 1}-${label}.png` })
  }
  const tabs = page.locator('[aria-label*="sales history"] [role="tab"]')
  const tabCount = await tabs.count()
  for (let i = 1; i < tabCount; i += 1) {
    await tabs.nth(i).click()
    await page.waitForTimeout(400)
    const a = articles.nth(0)
    await a.scrollIntoViewIfNeeded()
    await a.screenshot({ path: `${OUT}/${SLUG}-card1-tab${i + 1}-${label}.png` })
  }

  console.error(
    label,
    res.status(),
    `${width}px`,
    'cards:',
    JSON.stringify(titles),
    'consoleErrors:',
    errors.length ? errors.slice(0, 4) : 'none',
  )
  await ctx.close()
}

await capture(500, 900, '500')
await capture(1280, 900, '1280')
await browser.close()
