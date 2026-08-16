#!/usr/bin/env node
/**
 * G9 look-walk capture — first-screen PNGs at 390 + 1280 on production.
 * Writes out/look-walk/ (gitignored) and a machine JSON sidecar.
 *
 *   node scripts/look-walk-capture.mjs
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.LOOK_WALK_BASE || 'https://ryan-realty.com'
const OUT = resolve(process.env.LOOK_WALK_OUT || 'out/look-walk')
const ARTIFACTS = '/opt/cursor/artifacts'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const PUBLIC_ROUTES = [
  { id: 'home', route: '/', label: 'Home' },
  { id: 'homes-browse', route: '/homes-for-sale', label: 'Homes browse' },
  { id: 'city', route: '/cities/bend', label: 'City (Bend)' },
  { id: 'master-plan', route: '/communities/tetherow', label: 'Master-plan (Tetherow)' },
  { id: 'listing', route: '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727', label: 'Listing (McRoberts)' },
  { id: 'sell', route: '/sell', label: 'Sell' },
  { id: 'market', route: '/housing-market', label: 'Market' },
  { id: 'about', route: '/about', label: 'About' },
]

const CMA = {
  id: 'cma-tumalo',
  slug: 'cma-19496-tumalo-reservoir',
  route: '/cmas/cma-19496-tumalo-reservoir/cma.html',
  label: 'CMA (19496 Tumalo Reservoir — canonical exemplar)',
}

const VIEWPORTS = [
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '1280', width: 1280, height: 800, isMobile: false },
]

mkdirSync(OUT, { recursive: true })
if (existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true })

function slugFile(id, vp) {
  return `${id}-${vp}.png`
}

async function firstScreenText(page) {
  return page.evaluate(() => {
    const limit = window.innerHeight
    const nodes = [...document.querySelectorAll('h1, h2, a, button, label, [role="button"]')]
    const bits = []
    for (const el of nodes) {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > limit || r.width < 2 || r.height < 2) continue
      const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
      if (t && t.length < 80) bits.push(t)
      if (bits.length >= 24) break
    }
    const h1 = document.querySelector('h1')?.innerText?.replace(/\s+/g, ' ').trim() ?? ''
    return { h1, bits }
  })
}

async function captureRoute(browser, spec, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.isMobile ? 2 : 1,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    userAgent: UA,
  })
  const page = await ctx.newPage()
  const url = `${BASE}${spec.route}`
  let status = 0
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    status = res?.status() ?? 0
    await page.waitForTimeout(1800)
    const text = await firstScreenText(page)
    const file = slugFile(spec.id, vp.name)
    const dest = resolve(OUT, file)
    await page.screenshot({ path: dest })
    if (existsSync(ARTIFACTS)) {
      try {
        copyFileSync(dest, resolve(ARTIFACTS, `look_walk_${file}`))
      } catch {
        /* artifacts dir may be immutable after first write */
      }
    }
    await ctx.close()
    return { id: spec.id, route: spec.route, viewport: vp.name, status, url, file, ...text }
  } catch (err) {
    await ctx.close()
    return {
      id: spec.id,
      route: spec.route,
      viewport: vp.name,
      status,
      url,
      file: null,
      h1: '',
      bits: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function captureCma(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 1500 },
    deviceScaleFactor: 1,
    userAgent: UA,
  })
  const page = await ctx.newPage()
  const url = `${BASE}${CMA.route}`
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const status = res?.status() ?? 0
  await page.waitForTimeout(1500)
  const pages = await page.$$('.page')
  const headings = await page.$$eval('.page', (els) =>
    els.map((el, i) => ({
      i,
      h: el.querySelector('h2')?.textContent?.trim() ?? el.querySelector('h1')?.textContent?.trim() ?? '',
    })),
  )
  const shots = []
  const pick = [0, Math.min(6, pages.length - 1), pages.length - 1].filter((i, idx, a) => i >= 0 && a.indexOf(i) === idx)
  for (const i of pick) {
    const handle = pages[i]
    if (!handle) continue
    const file = `cma-${CMA.slug}-p${String(i).padStart(2, '0')}.png`
    const dest = resolve(OUT, file)
    await handle.screenshot({ path: dest })
    if (existsSync(ARTIFACTS)) {
      try {
        copyFileSync(dest, resolve(ARTIFACTS, `look_walk_${file}`))
      } catch {
        /* ignore */
      }
    }
    shots.push({ i, heading: headings[i]?.h ?? '', file })
  }
  await ctx.close()
  return { slug: CMA.slug, url, status, pageCount: pages.length, headings, shots }
}

const browser = await chromium.launch({
  executablePath: process.env.LOOK_WALK_CHROME || '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const publicShots = []
try {
  for (const spec of PUBLIC_ROUTES) {
    for (const vp of VIEWPORTS) {
      const row = await captureRoute(browser, spec, vp)
      publicShots.push(row)
      console.log(`${row.status}  ${row.viewport}  ${spec.route}  ${row.h1 || row.error || ''}`)
    }
  }
  const cma = await captureCma(browser)
  console.log(`CMA ${cma.status} pages=${cma.pageCount} shots=${cma.shots.length}`)
  const sidecar = {
    fetchedAt: new Date().toISOString(),
    base: BASE,
    public: publicShots,
    cma,
  }
  writeFileSync(resolve(OUT, 'capture.json'), JSON.stringify(sidecar, null, 2))
  console.log(`wrote ${OUT}/capture.json`)
} finally {
  await browser.close()
}
