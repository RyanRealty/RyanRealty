import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const universe = JSON.parse(
  readFileSync(new URL('../../grade-universe.json', import.meta.url), 'utf8'),
)
const BASE = 'https://ryan-realty.com'
mkdirSync(join(here, 'cards'), { recursive: true })

const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 800 },
]

const manifest = []
const browser = await chromium.launch({ headless: true })

for (const family of universe.families) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    const url = `${BASE}${family.route}`
    let status = null
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      status = res?.status() ?? null
      await page.waitForTimeout(2500)
      const file = `${family.id}-${vp.name}.png`
      await page.screenshot({ path: join(here, file), fullPage: false })
      console.log(`ok ${status} ${file}`)
      manifest.push({ id: family.id, grain: family.grain, route: family.route, vp: vp.name, status, file })
    } catch (e) {
      console.error(`fail ${family.route} ${vp.name}: ${e}`)
      manifest.push({ id: family.id, grain: family.grain, route: family.route, vp: vp.name, status, err: String(e) })
    }
    await context.close()
  }
}

writeFileSync(
  join(here, 'manifest.json'),
  JSON.stringify({ base: BASE, captured_at: new Date().toISOString(), isolated: true, manifest }, null, 2),
)
await browser.close()
console.log('done', manifest.filter((m) => m.file).length, '/', manifest.length)
