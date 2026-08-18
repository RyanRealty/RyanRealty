#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'after_'
const CASES = [
  { id: 'chloe-estates', url: 'https://ryan-realty.com/subdivisions/chloe-estates' },
  { id: 'blue-chip-ranch', url: 'https://ryan-realty.com/subdivisions/blue-chip-ranch' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'bend-farmers-market', url: 'https://ryan-realty.com/central-oregon/events/bend-farmers-market' },
  { id: 'aubrey-heights', url: 'https://ryan-realty.com/subdivisions/aubrey-heights' },
]

mkdirSync(ART, { recursive: true })

async function dismissArrival(page) {
  const notNow = page.getByRole('button', { name: /not now/i }).or(page.getByText(/^Not now$/i))
  if (await notNow.count()) {
    await notNow.first().click({ timeout: 4000 }).catch(() => null)
    await page.waitForTimeout(400)
  }
}

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
      await page.waitForTimeout(800)
      await dismissArrival(page)
      if (c.id === 'bend-farmers-market') {
        await page.waitForTimeout(3500)
      }
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const cityRows = [...document.querySelectorAll('a, li, tr, div')]
          .map((el) => el.innerText?.replace(/\s+/g, ' ').trim() ?? '')
          .filter((t) => /Terrebonne|days to pending/i.test(t) && t.length < 240)
          .slice(0, 12)
        const mapEl = document.querySelector('.v3-field__map, .mapboxgl-map, .leaflet-container')
        const mapBox = mapEl?.getBoundingClientRect()
        const tiles = document.querySelectorAll(
          'img[src*="googleapis.com/maps"], img[src*="maps.gstatic"], canvas',
        ).length
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          listingCards: document.querySelectorAll('[data-listing-card], a[href*="/homes-for-sale/"]').length,
          cityRows,
          hasDaysToPending: /days to pending/i.test(body),
          mapClass: mapEl?.className?.toString?.().slice(0, 160) ?? null,
          mapBox: mapBox
            ? { w: Math.round(mapBox.width), h: Math.round(mapBox.height), top: Math.round(mapBox.top) }
            : null,
          mapTiles: tiles,
          mapError: /map (failed|unavailable|could not)/i.test(body),
        }
      })
      if (c.id === 'housing-market') {
        const row = page.locator('a[href*="terrebonne"], [id="terrebonne"]').first()
        if (await row.count()) {
          await row.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotTerrebonne = `${ART}/${PREFIX}${c.id}_${width}_terrebonne.png`
          await page.screenshot({ path: rec.shotTerrebonne, fullPage: false })
        }
      }
      if (c.id === 'bend-farmers-market') {
        const map = page.locator('.v3-field__map, .v3-field__map-frame').first()
        if (await map.count()) {
          await map.scrollIntoViewIfNeeded()
          await page.waitForTimeout(800)
          rec.shotMap = `${ART}/${PREFIX}${c.id}_${width}_map.png`
          await page.screenshot({ path: rec.shotMap, fullPage: false })
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
  writeFileSync(`${ART}/${PREFIX}place_pages_v11_clean.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v11_clean.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
