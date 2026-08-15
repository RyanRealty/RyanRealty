import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://ryan-realty.com'
const SHA = 'a93cf35a'
mkdirSync(here, { recursive: true })

const pages = [
  { id: 'home', route: '/' },
  { id: 'browse', route: '/homes-for-sale' },
  { id: 'city', route: '/cities/bend' },
  { id: 'neighborhood', route: '/cities/bend/awbrey-butte' },
  { id: 'tetherow', route: '/communities/tetherow' },
  { id: 'plat', route: '/subdivisions/sunrise-village' },
  { id: 'listing', route: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727' },
  { id: 'sell', route: '/sell' },
  { id: 'market', route: '/housing-market' },
  { id: 'about', route: '/about' },
]

const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 800 },
]

const manifest = []
const browser = await chromium.launch({ headless: true })

for (const family of pages) {
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
      manifest.push({ id: family.id, route: family.route, vp: vp.name, status, file })
    } catch (e) {
      console.error(`fail ${family.route} ${vp.name}: ${e}`)
      manifest.push({ id: family.id, route: family.route, vp: vp.name, status, err: String(e) })
    }
    await context.close()
  }
}

writeFileSync(
  join(here, 'manifest.json'),
  JSON.stringify({ base: BASE, sha: SHA, captured_at: new Date().toISOString(), manifest }, null, 2),
)
await browser.close()
console.log('done', manifest.filter((m) => m.file).length, '/', manifest.length)
