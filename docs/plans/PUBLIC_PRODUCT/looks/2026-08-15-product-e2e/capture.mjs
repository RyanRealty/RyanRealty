import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://ryan-realty.com'
const SHA = '4cfc1a9e'
mkdirSync(here, { recursive: true })

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

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
const walk = {}
const browser = await chromium.launch({ headless: true })

async function open(route, viewport, extras = {}) {
  const context = await browser.newContext({
    viewport,
    userAgent: UA,
    ...extras,
  })
  const page = await context.newPage()
  const res = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2800)
  return { context, page, status: res?.status() ?? null }
}

for (const family of pages) {
  for (const vp of viewports) {
    try {
      const { context, page, status } = await open(family.route, {
        width: vp.width,
        height: vp.height,
      })
      const file = `${family.id}-${vp.name}.png`
      await page.screenshot({ path: join(here, file), fullPage: false })
      console.log(`ok ${status} ${file}`)
      manifest.push({ id: family.id, route: family.route, vp: vp.name, status, file })
      await context.close()
    } catch (e) {
      console.error(`fail ${family.route} ${vp.name}: ${e}`)
      manifest.push({ id: family.id, route: family.route, vp: vp.name, err: String(e) })
    }
  }
}

{
  const { context, page, status } = await open('/', { width: 390, height: 844 })
  const buy = await page.getByRole('link', { name: 'Buy', exact: true }).count()
  const sell = await page.getByRole('link', { name: 'Sell', exact: true }).count()
  const look = await page.getByRole('link', { name: 'Look', exact: true }).count()
  walk.arrivalDirect = { status, buy, sell, look }
  console.log('walk arrival-direct', walk.arrivalDirect)
  await context.close()
}

{
  const { context, page, status } = await open('/', { width: 390, height: 844 }, {
    extraHTTPHeaders: { Referer: 'https://www.google.com/' },
  })
  const buy = await page.getByRole('link', { name: 'Buy', exact: true }).count()
  walk.arrivalGoogle = { status, buy }
  console.log('walk arrival-google', walk.arrivalGoogle)
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: UA,
  })
  await context.addInitScript(() => {
    sessionStorage.setItem(
      'rr_last_thing',
      JSON.stringify({
        kind: 'house',
        label: '61281 McRoberts',
        href: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
      }),
    )
  })
  const page = await context.newPage()
  const res = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2800)
  const welcome = await page.getByText('Welcome back. 61281 McRoberts.').count()
  const buy = await page.getByRole('link', { name: 'Buy', exact: true }).count()
  walk.welcomeBack = { status: res?.status() ?? null, welcome, buy }
  console.log('walk welcome-back', walk.welcomeBack)
  await context.close()
}

{
  const { context, page, status } = await open('/homes-for-sale', { width: 390, height: 844 })
  const sentence = await page.locator('#sentence-search').count()
  const placeholder = await page.locator('input[placeholder="3 bed under 800 in Tetherow"]').count()
  walk.browse = { status, sentence, placeholder }
  console.log('walk browse', walk.browse)
  await context.close()
}

{
  const { context, page, status } = await open(
    '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
    { width: 390, height: 844 },
  )
  const houseme = await page.locator('[data-testid="live-pricing-read"]').count()
  const valueMyHome = await page.getByRole('link', { name: /Value my home/i }).count()
  walk.listing = { status, houseme, valueMyHome }
  console.log('walk listing', walk.listing)
  await context.close()
}

{
  const { context, page, status } = await open('/sell', { width: 390, height: 844 })
  const cta = await page.getByRole('button', { name: 'Value my home' }).count()
  const worth = await page.getByRole('button', { name: /worth/i }).count()
  walk.sell = { status, cta, worth }
  console.log('walk sell', walk.sell)
  await context.close()
}

{
  const { context, page, status } = await open('/communities/tetherow', { width: 1280, height: 800 })
  const homes = await page.getByRole('link', { name: /Search Tetherow homes/i }).count()
  const market = await page.getByRole('link', { name: /Tetherow market report/i }).count()
  walk.tetherow = { status, homes, market }
  console.log('walk tetherow', walk.tetherow)
  await context.close()
}

{
  const { context, page, status } = await open('/about', { width: 390, height: 844 })
  const matt = await page.getByText('Matt Ryan', { exact: false }).count()
  const call = await page.getByRole('link', { name: /^Call/i }).count()
  const text = await page.getByRole('link', { name: /^Text/i }).count()
  walk.about = { status, matt, call, text }
  console.log('walk about', walk.about)
  await context.close()
}

writeFileSync(
  join(here, 'manifest.json'),
  JSON.stringify(
    { base: BASE, sha: SHA, captured_at: new Date().toISOString(), manifest, walk },
    null,
    2,
  ),
)
await browser.close()
console.log('done', manifest.filter((m) => m.file).length, '/', manifest.length)
