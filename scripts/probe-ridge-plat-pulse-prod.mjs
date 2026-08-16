#!/usr/bin/env node
/**
 * Production accept for the Ridge At Eagle Crest plat-figure class.
 * Index tile and place hero share the plat median. The hero must not
 * print Redmond's pending days (19.5) or Redmond's $535,000 median.
 *
 *   node scripts/probe-ridge-plat-pulse-prod.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const PLACE = 'https://ryan-realty.com/subdivisions/ridge-at-eagle-crest'
const INDEX = 'https://ryan-realty.com/subdivisions'
const REDMOND = 'https://ryan-realty.com/cities/redmond'
const OUT = 'out/ridge-plat-pulse-prod'
const ART = '/opt/cursor/artifacts'

function textish(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: CI_PROBE_HEADERS })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return res.text()
}

function extractPlace(html) {
  const text = textish(html)
  const hero = text.match(/(\d+)\s+homes for sale in ([^.]+?)\./)
  const median = text.match(/Median list\s+\$([\d,]+)/)
  const pending = text.match(/Pending in\s+([\d.]+)\s+days/)
  return {
    heroCount: hero ? Number(hero[1]) : null,
    heroPlace: hero ? hero[2].trim() : null,
    medianList: median ? Number(median[1].replace(/,/g, '')) : null,
    pendingDays: pending ? Number(pending[1]) : null,
    has535k: /\$535,000/.test(text),
    has19_5: /Pending in\s+19\.5\s+days/.test(text),
  }
}

function extractIndex(html) {
  const text = textish(html)
  const tile = text.match(/Ridge At Eagle Crest[\s\S]{0,400}?(\d+)\s+Active[\s\S]{0,80}?\$([\d,]+)/)
  return {
    indexCount: tile ? Number(tile[1]) : null,
    indexMedian: tile ? Number(tile[2].replace(/,/g, '')) : null,
  }
}

function extractRedmond(html) {
  const text = textish(html)
  const median = text.match(/Median list\s+\$([\d,]+)/)
  const pending = text.match(/Pending in\s+([\d.]+)\s+days/)
  return {
    medianList: median ? Number(median[1].replace(/,/g, '')) : null,
    pendingDays: pending ? Number(pending[1]) : null,
  }
}

async function shot(browser, url, viewport, path, scrollText) {
  const page = await browser.newPage({ viewport, extraHTTPHeaders: CI_PROBE_HEADERS })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2200)
  if (scrollText) {
    const loc = page.getByText(scrollText, { exact: true }).first()
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
    }
  }
  await page.screenshot({ path, fullPage: false })
  await page.close()
}

const [placeHtml, indexHtml, redmondHtml] = await Promise.all([
  fetchHtml(PLACE),
  fetchHtml(INDEX),
  fetchHtml(REDMOND),
])
const place = extractPlace(placeHtml)
const index = extractIndex(indexHtml)
const redmond = extractRedmond(redmondHtml)

const platMedianShared =
  place.medianList != null &&
  place.medianList > 0 &&
  index.indexMedian === place.medianList
const cityMedianNotOnPlat = place.medianList !== redmond.medianList && !place.has535k
const cityPendingNotOnPlat = place.pendingDays == null && !place.has19_5
const countsAgree =
  place.heroCount != null &&
  place.heroCount > 0 &&
  index.indexCount === place.heroCount &&
  place.heroPlace === 'Ridge At Eagle Crest'
const ok = platMedianShared && cityMedianNotOnPlat && cityPendingNotOnPlat && countsAgree

mkdirSync(OUT, { recursive: true })
mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({ headless: true })
await shot(browser, PLACE, { width: 1280, height: 900 }, `${OUT}/place_1280.png`)
await shot(browser, PLACE, { width: 390, height: 844 }, `${OUT}/place_390.png`)
await shot(browser, INDEX, { width: 1280, height: 900 }, `${OUT}/index_tile_1280.png`, 'Ridge At Eagle Crest')
await shot(browser, INDEX, { width: 390, height: 844 }, `${OUT}/index_tile_390.png`, 'Ridge At Eagle Crest')
await browser.close()

for (const name of ['place_1280', 'place_390', 'index_tile_1280', 'index_tile_390']) {
  copyFileSync(`${OUT}/${name}.png`, `${ART}/ridge_pulse_${name}.png`)
}

const report = {
  place: PLACE,
  index: INDEX,
  extracted: { place, index, redmond },
  platMedianShared,
  cityMedianNotOnPlat,
  cityPendingNotOnPlat,
  countsAgree,
  ok,
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
