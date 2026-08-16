#!/usr/bin/env node
/**
 * Production accept for the Ridge At Eagle Crest plat inventory class.
 * Index tile, hero, and #homes must share one SFR count. The stale 14-hero
 * / 26-card / 12-tile split must be gone.
 *
 *   node scripts/probe-ridge-plat-count-prod.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const PLACE = 'https://ryan-realty.com/subdivisions/ridge-at-eagle-crest'
const INDEX = 'https://ryan-realty.com/subdivisions'
const OUT = 'out/ridge-plat-count-prod'
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

function extract(placeHtml, indexHtml) {
  const placeText = textish(placeHtml)
  const indexText = textish(indexHtml)
  const hero = placeText.match(/(\d+)\s+homes for sale in ([^.]+?)\./)
  const homesStart = placeHtml.indexOf('id="homes"')
  const homesChunk = homesStart >= 0 ? placeHtml.slice(homesStart) : ''
  const homesHrefs = [...new Set(homesChunk.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? [])]
  const indexTile = indexText.match(/Ridge At Eagle Crest[\s\S]{0,260}?(\d+)\s+Active/)
  return {
    heroCount: hero ? Number(hero[1]) : null,
    heroPlace: hero ? hero[2].trim() : null,
    homesUnique: homesHrefs.length,
    indexCount: indexTile ? Number(indexTile[1]) : null,
    foundingHero14: /\b14\s+homes for sale\b/.test(placeText),
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

const [placeHtml, indexHtml] = await Promise.all([fetchHtml(PLACE), fetchHtml(INDEX)])
const extracted = extract(placeHtml, indexHtml)
const shared = extracted.heroCount
const countsAgree =
  shared != null &&
  shared > 0 &&
  extracted.indexCount === shared &&
  extracted.homesUnique === shared
const foundingSplitGone = !(
  extracted.heroCount === 14 &&
  extracted.homesUnique >= 24 &&
  extracted.indexCount === 12
)
const staleGone = extracted.heroPlace === 'Ridge At Eagle Crest' && foundingSplitGone
const ok = countsAgree && staleGone

mkdirSync(OUT, { recursive: true })
mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({ headless: true })
await shot(browser, PLACE, { width: 1280, height: 900 }, `${OUT}/place_1280.png`)
await shot(browser, PLACE, { width: 390, height: 844 }, `${OUT}/place_390.png`)
await shot(browser, INDEX, { width: 1280, height: 900 }, `${OUT}/index_tile_1280.png`, 'Ridge At Eagle Crest')
await shot(browser, INDEX, { width: 390, height: 844 }, `${OUT}/index_tile_390.png`, 'Ridge At Eagle Crest')
await browser.close()

for (const name of ['place_1280', 'place_390', 'index_tile_1280', 'index_tile_390']) {
  copyFileSync(`${OUT}/${name}.png`, `${ART}/ridge_count_${name}.png`)
}

const report = { place: PLACE, index: INDEX, extracted, countsAgree, staleGone, ok }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
