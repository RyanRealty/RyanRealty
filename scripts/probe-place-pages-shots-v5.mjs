#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_v5_'
const CASES = [
  { id: 'braydon_park', url: 'https://ryan-realty.com/subdivisions/braydon-park' },
  { id: 'brooktree', url: 'https://ryan-realty.com/subdivisions/brooktree' },
  { id: 'centennial_glen', url: 'https://ryan-realty.com/subdivisions/centennial-glen' },
  { id: 'choctaw_village', url: 'https://ryan-realty.com/subdivisions/choctaw-village' },
  { id: 'aspen_meadows', url: 'https://ryan-realty.com/subdivisions/aspen-meadows' },
  { id: 'canyon_view', url: 'https://ryan-realty.com/subdivisions/canyon-view' },
  { id: 'alstrup_estates', url: 'https://ryan-realty.com/subdivisions/alstrup-estates' },
  { id: 'townhomes_1925', url: 'https://ryan-realty.com/subdivisions/1925-townhomes' },
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
      await page.waitForTimeout(2500)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      await page.evaluate(() => {
        const el =
          document.getElementById('homes') ||
          document.querySelector('.section') ||
          document.querySelector('[class*="split"]')
        el?.scrollIntoView({ block: 'start' })
      })
      await page.waitForTimeout(400)
      rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
      await page.screenshot({ path: rec.shotHomes, fullPage: false })
      rec.text = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 900)
      rec.hero = await page.evaluate(() => {
        const sub = document.querySelector('.hero-sub')
        return sub?.textContent?.replace(/\s+/g, ' ').trim() ?? null
      })
      rec.noActive = /No active listings/i.test(rec.text ?? '')
      rec.heroHomes = (rec.hero ?? rec.text ?? '').match(/(\d[\d,]*)\s+homes? for sale/i)
      rec.heroHomesN = rec.heroHomes ? Number(rec.heroHomes[1].replace(/,/g, '')) : null
      rec.closed30 = (rec.text ?? '').match(/(\d+)\s+Closed\s*[·•]\s*30 days/i)
      rec.median756 = /\$756,000/.test(rec.text ?? '')
      rec.cider = /20431 Cider/i.test(rec.text ?? '')
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(
      JSON.stringify({
        w: width,
        id: c.id,
        status: rec.status,
        hero: rec.hero,
        heroHomesN: rec.heroHomesN,
        noActive: rec.noActive,
        closed30: rec.closed30?.[0] ?? null,
        median756: rec.median756,
        cider: rec.cider,
        error: rec.error,
      }),
    )
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
