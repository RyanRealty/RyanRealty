// Capture the /homes-for-sale city search surface with the asking-price ladder,
// at 500 and 1280 (plus 390 — "390 is truth"). Scratch verification harness.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3106'
const OUT = process.env.OUT || '/tmp/search-shots'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const results = []

const VIEWS = [
  { name: '390', width: 390, height: 844 },
  { name: '500', width: 500, height: 1000 },
  { name: '1280', width: 1280, height: 900 },
]

const PATHS = [
  { slug: 'bend', label: 'bend' },
  { slug: 'madras', label: 'madras' },
  { slug: 'sisters', label: 'sisters' },
]

for (const p of PATHS) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 2,
      userAgent: UA,
    })
    const page = await ctx.newPage()
    try {
      await page.goto(`${BASE}/homes-for-sale/${p.slug}`, { waitUntil: 'load', timeout: 180000 })
      const present = await page
        .waitForSelector('#search-price-ladder', { timeout: 60000 })
        .then(() => true)
        .catch(() => false)
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
      if (!present) {
        results.push(`${p.label}-${v.name}: NO LADDER`)
        await ctx.close()
        continue
      }
      // Hide fixed/sticky chrome for the capture only. Nothing is clicked and no
      // consent is given — this is inspection, not interaction.
      await page.evaluate(() => {
        for (const n of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(n)
          if (cs.position === 'fixed' || cs.position === 'sticky') n.style.visibility = 'hidden'
        }
      })
      // Real wheel scroll to the card (programmatic scroll desyncs the compositor).
      const target = await page.evaluate(() => {
        const el = document.getElementById('search-price-ladder')
        return el.getBoundingClientRect().top + window.scrollY
      })
      let done = 0
      while (done < target - 40) {
        const step = Math.min(600, target - 40 - done)
        await page.mouse.wheel(0, step)
        done += step
        await page.waitForTimeout(60)
      }
      await page.waitForTimeout(900)
      await page.screenshot({ path: `${OUT}/ladder-${p.label}-${v.name}.png` })
      const metrics = await page.evaluate(() => {
        const el = document.getElementById('search-price-ladder')
        const r = el.getBoundingClientRect()
        const rows = [...el.querySelectorAll('.v3-chart__rangerow')]
        const cardRight = r.right
        let overflow = 0
        let minLabelGap = Infinity
        for (const row of rows) {
          const dot = row.querySelector('.v3-chart__rangedot')?.getBoundingClientRect()
          const lab = row.querySelector('.v3-chart__rangelabel')?.getBoundingClientRect()
          const tick = row.querySelector('.v3-chart__rangetick')
          if (dot && dot.right > cardRight) overflow++
          if (lab && lab.right > cardRight) overflow++
          if (lab) minLabelGap = Math.min(minLabelGap, cardRight - lab.right)
          if (tick && tick.scrollWidth > tick.clientWidth + 1) overflow++
        }
        return {
          cardTop: Math.round(r.top),
          cardH: Math.round(r.height),
          cardW: Math.round(r.width),
          rows: rows.length,
          overflow,
          minLabelGapToCardEdge: Math.round(minLabelGap),
          docScrollW: document.documentElement.scrollWidth,
          vpW: window.innerWidth,
        }
      })
      results.push(`${p.label}-${v.name}: ${JSON.stringify(metrics)}`)
    } catch (e) {
      results.push(`${p.label}-${v.name}: FAIL ${e.message}`)
    }
    await ctx.close()
  }
}

await browser.close()
for (const line of results) console.log(line)
