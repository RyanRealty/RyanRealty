#!/usr/bin/env node
/**
 * measure-homepage-fold.mjs — 1440×900 geometry for SITE-125.
 *
 *   BASE_URL=http://127.0.0.1:3450 node scripts/measure-homepage-fold.mjs
 *
 * Writes JSON + fold PNGs under /opt/cursor/artifacts when that dir exists.
 * Exit 1 if first house-rail photo top is above the 880 lock (heading-only fold).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { HOME_FOLD_LOCK } from './lib/homepage-fold-density.mjs'
import { openGateContext } from './lib/gate-browser.mjs'

const BASE = (process.env.BASE_URL || process.argv[2] || '').replace(/\/$/, '')
if (!BASE) {
  console.error('measure-homepage-fold: set BASE_URL or pass the origin')
  process.exit(2)
}

const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts'
const FOLD = HOME_FOLD_LOCK.maxFirstPhotoTopPx

const browser = await chromium.launch({ headless: true })
const { context } = await openGateContext(browser, {
  baseUrl: BASE,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90_000 })
await page.waitForSelector('.home-rail__media, #guides', { timeout: 30_000 })
await page.waitForTimeout(400)

const geo = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
  }
  const guides = document.querySelector('#guides')
  const rail = document.querySelector('.home-rails > .home-rail, .home-rail')
  const heading = document.querySelector('.home-rail__title, .home-rails h2')
  const photo = document.querySelector('.home-rail__media, .home-rail .v3-lrow__media')
  const doors = [...document.querySelectorAll('#guides a.v3-answers__door')]
  return {
    guides: box(guides),
    rail: box(rail),
    heading: box(heading),
    photo: box(photo),
    doorCount: doors.length,
    doorHrefs: doors.map((a) => a.getAttribute('href')),
    headingText: heading?.textContent?.trim() ?? null,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }
})

mkdirSync(OUT, { recursive: true })
const stamp = 'site-125-fold-1440x900'
await page.screenshot({ path: join(OUT, `${stamp}.png`), fullPage: false })
await page.evaluate(() => window.scrollTo(0, 0))
const guidesShot = document.querySelector
void guidesShot
if (geo.guides) {
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 40)), geo.guides.top)
  await page.screenshot({ path: join(OUT, `${stamp}-guides.png`), fullPage: false })
}

const photoTop = geo.photo?.top ?? null
const pass = photoTop != null && photoTop <= FOLD
const report = {
  viewport: '1440x900',
  foldLockPx: FOLD,
  ...geo,
  pass,
  note: pass
    ? `first photo top ${photoTop} ≤ ${FOLD}`
    : `FAIL heading-only fold: photo top ${photoTop} > ${FOLD} (guides bottom ${geo.guides?.bottom}, heading bottom ${geo.heading?.bottom})`,
}

writeFileSync(join(OUT, `${stamp}.json`), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

await browser.close()
process.exit(pass ? 0 : 1)
