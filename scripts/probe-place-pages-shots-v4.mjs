#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_v4_'
const CASES = [
  { id: 'southern_crossing', url: 'https://ryan-realty.com/cities/bend/southern-crossing', extra: 'hud' },
  { id: 'tetherow', url: 'https://ryan-realty.com/communities/tetherow', extra: 'hud' },
  { id: 'northwest_crossing', url: 'https://ryan-realty.com/communities/northwest-crossing', extra: 'homes' },
  { id: 'widgi_creek', url: 'https://ryan-realty.com/communities/widgi-creek', extra: 'hud' },
  { id: 'awbrey_court', url: 'https://ryan-realty.com/subdivisions/awbrey-court', extra: 'sales' },
  { id: 'amber_springs', url: 'https://ryan-realty.com/subdivisions/amber-springs', extra: 'homes' },
  { id: 'bailey', url: 'https://ryan-realty.com/subdivisions/bailey', extra: 'homes' },
  { id: 'bradetich_park', url: 'https://ryan-realty.com/subdivisions/bradetich-park', extra: 'homes' },
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
      await page.waitForTimeout(1800)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      if (c.extra === 'homes') {
        await page.evaluate(() => {
          const el = document.getElementById('homes') || document.querySelector('.split, .featured, .section')
          el?.scrollIntoView({ block: 'start' })
        })
        await page.waitForTimeout(400)
        rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
        await page.screenshot({ path: rec.shotHomes, fullPage: false })
      }
      if (c.extra === 'hud' || c.extra === 'sales') {
        await page.evaluate(() => {
          const el =
            document.getElementById('market') ||
            document.querySelector('.mkt, .sell, [id*="sales"]')
          el?.scrollIntoView({ block: 'start' })
        })
        await page.waitForTimeout(400)
        rec.shotHud = `${ART}/${PREFIX}${c.id}_${width}_hud.png`
        await page.screenshot({ path: rec.shotHud, fullPage: false })
      }
      rec.text = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 700)
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(JSON.stringify({ w: width, id: c.id, status: rec.status, error: rec.error }))
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
