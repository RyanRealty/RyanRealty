#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'brookswood-crossing', url: 'https://ryan-realty.com/subdivisions/brookswood-crossing' },
  { id: 'brooktree', url: 'https://ryan-realty.com/subdivisions/brooktree' },
  { id: 'summit-high', url: 'https://ryan-realty.com/schools/summit-high' },
  { id: 'portland', url: 'https://ryan-realty.com/oregon/portland' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow' },
  { id: 'subdivisions', url: 'https://ryan-realty.com/subdivisions' },
]

mkdirSync(ART, { recursive: true })

async function runViewport(browser, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const rows = {}
  for (const c of CASES) {
    const rec = { id: c.id, url: c.url }
    try {
      const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      rec.status = res?.status() ?? null
      rec.finalUrl = page.url()
      await page.waitForSelector('h1', { timeout: 20_000 }).catch(() => null)
      await page.waitForTimeout(1800)
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const tiles = [...document.querySelectorAll('img')].filter((img) => {
          const src = img.getAttribute('src') ?? ''
          return /maps\.googleapis|googleapis.com\/maps|ggpht|khms|vt\.googleapis/i.test(src)
        })
        const mapEl = document.querySelector(
          '.v3-field__map, [class*="map"], [data-map], .mapboxgl-map, .leaflet-container, canvas.mapboxgl-canvas',
        )
        const mapBox = mapEl?.getBoundingClientRect()
        const listingHrefs = [...document.querySelectorAll('a[href*="/homes-for-sale/"]')].map(
          (a) => a.getAttribute('href') ?? '',
        )
        const uniqueListings = [...new Set(listingHrefs.filter((h) => /-\d{6,}$|listing\//.test(h)))]
        const seeAll = [...document.querySelectorAll('a, button')].map((el) =>
          (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ).filter((t) => /see all|show all|view all/i.test(t))
        const featuredActive = [...body.matchAll(/(\d+)\s+ACTIVE/g)].map((m) => Number(m[1]))
        const closes = [...body.matchAll(/([\d,]+)\s+(ALL-TYPE closes|[A-Za-z /]+ closes)/g)].map(
          (m) => `${m[1]} ${m[2]}`,
        )
        const chartOl = document.querySelector('.v3-chart__data')
        const chartSegs = document.querySelectorAll('.v3-chart__plot--mix rect, .v3-chart__seg, [class*="mix"] rect')
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          notFound: /page not found/i.test(body),
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          outsideMarket: /not (our|Ryan Realty.?s) market|outside (our|this) market|do not (sell|work) (homes )?in/i.test(body),
          googleTiles: tiles.length,
          mapClass: mapEl?.className?.toString?.().slice(0, 140) ?? null,
          mapBox: mapBox
            ? { w: Math.round(mapBox.width), h: Math.round(mapBox.height), top: Math.round(mapBox.top) }
            : null,
          listingHrefCount: listingHrefs.length,
          uniqueListingCount: uniqueListings.length,
          seeAll: seeAll.slice(0, 6),
          featuredActive,
          featuredZero: featuredActive.filter((n) => n === 0).length,
          closes: closes.slice(0, 16),
          chartListItems: chartOl ? chartOl.querySelectorAll('li').length : 0,
          chartListText: chartOl?.innerText.replace(/\s+/g, ' ').slice(0, 400) ?? null,
          chartSegCount: chartSegs.length,
          homesHint: (body.match(/(\d[\d,]*)\s+(?:homes for sale|Active single-family|active single-family)/i) ?? [])[0] ?? null,
          bodyPreview: body.slice(0, 360),
        }
      })
      if (c.id === 'summit-high') {
        const map = page.locator('.v3-field__map').first()
        if (await map.count()) {
          await map.scrollIntoViewIfNeeded()
          await page.waitForTimeout(2500)
          rec.shotMap = `${ART}/${PREFIX}${c.id}_${width}_map.png`
          await page.screenshot({ path: rec.shotMap, fullPage: false })
          rec.metrics.afterMapWait = await page.evaluate(() => {
            const tiles = [...document.querySelectorAll('img')].filter((img) =>
              /maps\.googleapis|ggpht|khms|vt\.googleapis/i.test(img.getAttribute('src') ?? ''),
            )
            const mapEl = document.querySelector('.v3-field__map')
            const box = mapEl?.getBoundingClientRect()
            return {
              googleTiles: tiles.length,
              mapBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
            }
          })
        }
      }
      if (c.id === 'housing-market') {
        const chart = page.locator('.v3-chart, text=Single-family').first()
        if (await chart.count()) {
          await chart.scrollIntoViewIfNeeded()
          await page.waitForTimeout(300)
          rec.shotChart = `${ART}/${PREFIX}${c.id}_${width}_chart.png`
          await page.screenshot({ path: rec.shotChart, fullPage: false })
        }
      }
      if (c.id === 'tetherow') {
        const homes = page.locator('#homes, text=See all').first()
        if (await homes.count()) {
          await homes.scrollIntoViewIfNeeded()
          await page.waitForTimeout(300)
          rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
          await page.screenshot({ path: rec.shotHomes, fullPage: false })
        }
      }
      if (c.id === 'subdivisions') {
        const feat = page.locator('text=ACTIVE').first()
        if (await feat.count()) {
          await feat.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotFeatured = `${ART}/${PREFIX}${c.id}_${width}_featured.png`
          await page.screenshot({ path: rec.shotFeatured, fullPage: false })
        }
      }
      if (c.id === 'portland') {
        const other = page.locator('text=/other (Oregon )?market|Medford/i').first()
        if (await other.count()) {
          await other.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotOther = `${ART}/${PREFIX}${c.id}_${width}_other.png`
          await page.screenshot({ path: rec.shotOther, fullPage: false })
        }
      }
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(JSON.stringify({ w: width, id: c.id, status: rec.status, metrics: rec.metrics, error: rec.error }))
  }
  await page.close()
  return rows
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  })
  const out = { fetchedAt: new Date().toISOString(), viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}place_pages_v13.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v13.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
