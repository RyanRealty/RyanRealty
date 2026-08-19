#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'aubrey-heights', url: 'https://ryan-realty.com/subdivisions/aubrey-heights' },
  { id: 'chase-village', url: 'https://ryan-realty.com/subdivisions/chase-village' },
  { id: 'chloe-estates', url: 'https://ryan-realty.com/subdivisions/chloe-estates' },
  { id: 'brookswood-estates', url: 'https://ryan-realty.com/subdivisions/brookswood-estates' },
  { id: 'brentwood', url: 'https://ryan-realty.com/subdivisions/brentwood' },
  { id: 'housing-market', url: 'https://ryan-realty.com/housing-market' },
  { id: 'blue-chip-ranch', url: 'https://ryan-realty.com/subdivisions/blue-chip-ranch' },
  { id: 'bend-farmers-market', url: 'https://ryan-realty.com/central-oregon/events/bend-farmers-market' },
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
      await page.waitForTimeout(1200)
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const cityRows = [...document.querySelectorAll('a, li, tr, div')]
          .map((el) => el.innerText?.replace(/\s+/g, ' ').trim() ?? '')
          .filter((t) => /Terrebonne/i.test(t) && t.length < 220)
          .slice(0, 8)
        const mapEl = document.querySelector(
          '[class*="map"], [data-map], .mapboxgl-map, .leaflet-container, canvas.mapboxgl-canvas',
        )
        const mapBox = mapEl?.getBoundingClientRect()
        const canvas = document.querySelector('canvas')
        const canvasBox = canvas?.getBoundingClientRect()
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          listingCards: document.querySelectorAll('[data-listing-card], a[href*="/homes-for-sale/"]').length,
          terrebonneRows: cityRows,
          hasDaysToPending: /days to pending/i.test(body),
          mapTag: mapEl?.tagName ?? null,
          mapClass: mapEl?.className?.toString?.().slice(0, 120) ?? null,
          mapBox: mapBox
            ? {
                w: Math.round(mapBox.width),
                h: Math.round(mapBox.height),
                top: Math.round(mapBox.top),
              }
            : null,
          canvasBox: canvasBox
            ? {
                w: Math.round(canvasBox.width),
                h: Math.round(canvasBox.height),
                top: Math.round(canvasBox.top),
              }
            : null,
          chromeOnly:
            !document.querySelector('h1') &&
            !/No active listings/i.test(body) &&
            !/sales history/i.test(body),
        }
      })
      if (c.id === 'housing-market') {
        const terrebonne = page.locator('text=Terrebonne').first()
        if (await terrebonne.count()) {
          await terrebonne.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotTerrebonne = `${ART}/${PREFIX}${c.id}_${width}_terrebonne.png`
          await page.screenshot({ path: rec.shotTerrebonne, fullPage: false })
        }
      }
      if (c.id === 'bend-farmers-market') {
        const mapHint = page.locator('text=/venue|map|marked/i').first()
        if (await mapHint.count()) {
          await mapHint.scrollIntoViewIfNeeded()
          await page.waitForTimeout(400)
        }
        rec.shotMap = `${ART}/${PREFIX}${c.id}_${width}_map.png`
        await page.screenshot({ path: rec.shotMap, fullPage: false })
      }
      if (rec.metrics?.h1 && rec.metrics.h1Top != null && rec.metrics.h1Top > height * 0.4) {
        await page.evaluate(() => document.querySelector('h1')?.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(300)
        rec.shotH1 = `${ART}/${PREFIX}${c.id}_${width}_h1.png`
        await page.screenshot({ path: rec.shotH1, fullPage: false })
      }
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(
      JSON.stringify({
        w: width,
        id: c.id,
        status: rec.status,
        metrics: rec.metrics,
        error: rec.error,
      }),
    )
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
  writeFileSync(`${ART}/${PREFIX}place_pages_v11.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v11.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
