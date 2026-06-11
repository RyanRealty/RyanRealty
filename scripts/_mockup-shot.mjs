// Mockup screenshot harness — captures the two final design mockups (golf
// landing + full-width mega-menu) at desktop (1440) and mobile (390) widths
// for Matt's design sign-off. Loads the self-contained HTML via file://.
//
// Usage: node scripts/_mockup-shot.mjs
import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'node:fs'

const ROOT = '/Users/matthewryan/ryanrealty'
const OUT = `${ROOT}/out/design-mockups/_shots`
mkdirSync(OUT, { recursive: true })

const targets = [
  { id: 'golf', file: `${ROOT}/out/design-mockups/golf-editorial-guide/index.html` },
  { id: 'nav', file: `${ROOT}/out/design-mockups/nav-columns-featured/index.html` },
]

const views = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const browser = await chromium.launch()
const results = []
for (const t of targets) {
  if (!existsSync(t.file)) {
    results.push(`SKIP ${t.id}: file missing (${t.file})`)
    continue
  }
  for (const v of views) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()
    await page.goto(`file://${t.file}`, { waitUntil: 'load', timeout: 30000 })
    // let webfonts (Geist via Google, Amboqia via @font-face) settle + lazy layout
    try {
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()))
    } catch {}
    await page.waitForTimeout(1200)
    const path = `${OUT}/${t.id}-${v.name}.png`
    await page.screenshot({ path, fullPage: true })
    results.push(`OK ${path}`)
    await ctx.close()
  }
}
await browser.close()
console.log(results.join('\n'))
