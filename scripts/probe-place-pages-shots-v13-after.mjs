#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'after_'
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

async function dismiss(page) {
  for (const label of ['Not now', 'Essential only']) {
    const el = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).or(page.getByText(new RegExp(`^${label}$`, 'i')))
    if (await el.count()) {
      await el.first().click({ timeout: 2000 }).catch(() => null)
      await page.waitForTimeout(400)
    }
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
      await dismiss(page)
      await page.waitForTimeout(800)
      rec.shotTop = `${ART}/${PREFIX}${c.id}_${width}.png`
      await page.screenshot({ path: rec.shotTop, fullPage: false })
      rec.metrics = await page.evaluate(() => {
        const body = document.body.innerText.replace(/\s+/g, ' ')
        const h1 = document.querySelector('h1')
        const h1Box = h1?.getBoundingClientRect()
        const tiles = [...document.querySelectorAll('img')].filter((img) =>
          /maps\.googleapis|ggpht|khms|vt\.googleapis/i.test(img.getAttribute('src') ?? ''),
        )
        const mapEl = document.querySelector('.v3-field__map, [class*="map"]')
        const mapBox = mapEl?.getBoundingClientRect()
        const seeAll = [...document.querySelectorAll('a, button')]
          .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter((t) => /see all|show all|view all/i.test(t))
        const featuredActive = [...body.matchAll(/(\d+)\s+ACTIVE/g)].map((m) => Number(m[1]))
        return {
          title: document.title,
          h1: h1?.textContent?.trim() ?? null,
          h1Visible: Boolean(h1 && h1Box && h1Box.height > 0 && h1Box.width > 0),
          h1Top: h1Box ? Math.round(h1Box.top) : null,
          notFound: /page not found/i.test(body),
          emptyState: /No active listings/i.test(body),
          salesHistory: /sales history/i.test(body),
          outsideMarket: /outside that area|outside our Central Oregon market/i.test(body),
          googleTiles: tiles.length,
          mapBox: mapBox
            ? { w: Math.round(mapBox.width), h: Math.round(mapBox.height) }
            : null,
          seeAll: seeAll.slice(0, 4),
          featuredActive,
          featuredZero: featuredActive.filter((n) => n === 0).length,
          chartListItems: document.querySelectorAll('.v3-chart__data li').length,
          homesHint:
            (body.match(/(\d[\d,]*)\s+(?:homes for sale|Active single-family|active single-family)/i) ??
              [])[0] ?? null,
        }
      })
      if (c.id === 'subdivisions') {
        const feat = page.locator('text=ACTIVE').first()
        if (await feat.count()) {
          await feat.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
          rec.shotFeatured = `${ART}/${PREFIX}${c.id}_${width}_featured.png`
          await page.screenshot({ path: rec.shotFeatured, fullPage: false })
        }
      }
      if (c.id === 'summit-high') {
        const map = page.locator('.v3-field__map').first()
        if (await map.count()) {
          await map.scrollIntoViewIfNeeded()
          await page.waitForTimeout(2000)
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
  writeFileSync(`${ART}/${PREFIX}place_pages_v13.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_v13.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
