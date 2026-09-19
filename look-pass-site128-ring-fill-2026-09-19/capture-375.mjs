#!/usr/bin/env node
/**
 * SITE-128 @375×720 measure. Looks at #place-look on /cities/bend:
 * island box, OverlayView SVG, placeLookFill/Zoom/Ring, $ pills, photo cards.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

const OUT = resolve('look-pass-site128-ring-fill-2026-09-19')
const URL = process.env.CAPTURE_URL || 'http://127.0.0.1:3199/cities/bend'
const VIEW = { width: 375, height: 720 }

mkdirSync(OUT, { recursive: true })

function chromeUa() {
  return 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
}

async function measure(page) {
  return page.evaluate(() => {
    const look = document.querySelector('#place-look, .v3-place-look')
    const map = document.querySelector('.v3-place-look__map')
    const canvas = document.querySelector('.v3-place-look__map-canvas')
    const host =
      canvas?.querySelector('[data-place-look-fill], [data-place-look-ring]') ||
      canvas ||
      map
    const svg = canvas?.querySelector('svg[data-subject-ring], [data-subject-ring] svg')
    const svgBox = svg?.getBoundingClientRect()
    const island = (canvas || map)?.getBoundingClientRect()
    const pills = [...document.querySelectorAll('.v3-place-look__map [data-price-pill], .map-search-mark, .price-pill')].length
    const pillFallback = [...document.querySelectorAll('.v3-place-look__map')].flatMap((el) =>
      [...el.querySelectorAll('[class*="pill"], [data-price]')],
    ).length
    const cards = [...document.querySelectorAll('.v3-place-look__card')]
    const visibleCards = cards.filter((c) => {
      const r = c.getBoundingClientRect()
      return r.height > 8 && r.bottom > 0 && r.top < window.innerHeight + 40
    })
    const ds = host && 'dataset' in host ? host.dataset : {}
    const fill = ds.placeLookFill != null ? Number(ds.placeLookFill) : null
    const boxW = svgBox?.width ?? 0
    const boxH = svgBox?.height ?? 0
    const islandW = island?.width ?? 0
    const islandH = island?.height ?? 0
    const ringMin = Math.min(boxW, boxH)
    const islandMin = Math.min(islandW, islandH)
    return {
      placeLookRing: ds.placeLookRing ?? null,
      placeLookZoom: ds.placeLookZoom ?? null,
      placeLookFill: ds.placeLookFill ?? null,
      placeLookBox: ds.placeLookBox ?? null,
      fill,
      svg: { w: Math.round(boxW), h: Math.round(boxH) },
      island: { w: Math.round(islandW), h: Math.round(islandH) },
      measuredFill: islandMin > 0 && ringMin > 0 ? ringMin / islandMin : 0,
      pills: pills || pillFallback,
      cards: cards.length,
      visibleCards: visibleCards.length,
      cardPrices: cards.slice(0, 4).map((c) => c.querySelector('.v3-place-look__price')?.textContent?.trim() ?? ''),
      lookPresent: Boolean(look),
    }
  })
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 1,
  userAgent: chromeUa(),
  reducedMotion: 'reduce',
})
await context.addInitScript(() => {
  try {
    localStorage.setItem('rr-cookie-consent', 'necessary')
  } catch {
    /* ignore */
  }
})
const page = await context.newPage()
page.setDefaultTimeout(90_000)
const res = await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('load').catch(() => {})
await page.waitForSelector('#place-look, .v3-place-look', { timeout: 45_000 })
const look = page.locator('#place-look, .v3-place-look').first()
await look.scrollIntoViewIfNeeded()
await page.waitForTimeout(2500)
await page.waitForFunction(() => {
  const host = document.querySelector('[data-place-look-fill], [data-place-look-ring], [data-subject-ring]')
  return Boolean(host)
}, { timeout: 30_000 }).catch(() => {})
await page.waitForTimeout(2000)

let stats = await measure(page)
for (let i = 0; i < 8 && !(Number(stats.fill) >= 0.7 || Number(stats.measuredFill) >= 0.7); i += 1) {
  await page.waitForTimeout(700)
  stats = await measure(page)
}

const full = resolve(OUT, 'ours-local-cities-bend-375.png')
const mapShot = resolve(OUT, 'ours-local-cities-bend-375-map.png')
await page.screenshot({ path: full, animations: 'disabled' })
const map = page.locator('.v3-place-look__map').first()
if (await map.count()) {
  await map.screenshot({ path: mapShot, animations: 'disabled' })
}
const lookShot = resolve(OUT, 'ours-local-cities-bend-375-place-look.png')
await look.screenshot({ path: lookShot, animations: 'disabled' })

const report = {
  url: URL,
  status: res?.status() ?? null,
  viewport: VIEW,
  stats,
  dest: { full, map: mapShot, look: lookShot },
  pass: {
    fill: Number(stats.fill ?? stats.measuredFill) >= 0.7,
    box: Math.max(stats.svg.w, stats.svg.h) >= 110,
    pills: stats.pills > 0,
    cards: stats.visibleCards >= 4,
  },
}
writeFileSync(resolve(OUT, 'ours-local-cities-bend-375-measure.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()

const ok = report.pass.fill && report.pass.box
process.exit(ok ? 0 : 2)
