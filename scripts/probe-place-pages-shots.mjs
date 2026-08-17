#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'south_meadow', url: 'https://ryan-realty.com/subdivisions/south-meadow' },
  { id: 'tumalo', url: 'https://ryan-realty.com/cities/tumalo' },
  { id: 'deer_park', url: 'https://ryan-realty.com/subdivisions/deer-park' },
  { id: 'deschutes_river', url: 'https://ryan-realty.com/subdivisions/deschutes-river-recreation-homesites' },
  { id: 'rivers_edge', url: 'https://ryan-realty.com/subdivisions/rivers-edge-village' },
  { id: 'boyd_acres', url: 'https://ryan-realty.com/cities/bend/boyd-acres' },
  { id: 'old_bend', url: 'https://ryan-realty.com/cities/bend/old-bend' },
  { id: 'southern_crossing', url: 'https://ryan-realty.com/cities/bend/southern-crossing' },
  { id: 'subdivisions_index', url: 'https://ryan-realty.com/subdivisions' },
  { id: 'cities_index', url: 'https://ryan-realty.com/cities' },
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
      await page.waitForTimeout(2000)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      if (c.id === 'boyd_acres' || c.id === 'old_bend' || c.id === 'southern_crossing') {
        await page.evaluate(() => {
          const el = document.getElementById('homes')
          el?.scrollIntoView({ block: 'start' })
        })
        await page.waitForTimeout(500)
        rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
        await page.screenshot({ path: rec.shotHomes, fullPage: false })
      }
      rec.text = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 500)
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(JSON.stringify({ w: width, id: c.id, status: rec.status, finalUrl: rec.finalUrl, error: rec.error }))
  }
  await page.close()
  return rows
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}place_pages_punch_shots.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_punch_shots.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
