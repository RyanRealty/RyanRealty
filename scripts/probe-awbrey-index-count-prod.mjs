#!/usr/bin/env node
/**
 * Production accept for the Awbrey Butte index-vs-place count finding.
 * Rejects the stale 52-vs-63 / "homes for sale in Bend" observation when
 * index, city tile, hero, FAQ, Dataset, and #homes share one count.
 *
 *   node scripts/probe-awbrey-index-count-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const PLACE = 'https://ryan-realty.com/cities/bend/awbrey-butte'
const INDEX = 'https://ryan-realty.com/neighborhoods'
const CITY = 'https://ryan-realty.com/cities/bend'
const OUT = 'out/awbrey-index-count-prod'
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

function extract(placeHtml, indexHtml, cityHtml) {
  const placeText = textish(placeHtml)
  const indexText = textish(indexHtml)
  const cityText = textish(cityHtml)
  const hero = placeText.match(/(\d+)\s+homes for sale in ([^.]+?)\./)
  const faq = placeHtml.match(/There are (\d+) active single-family listings in Awbrey Butte/)
  const dataset = placeHtml.match(/"name":"Active Listings","value":(\d+)/)
  const homesStart = placeHtml.indexOf('id="homes"')
  const homesEnd = placeHtml.indexOf('id="overview"')
  const homesChunk =
    homesStart >= 0 ? placeHtml.slice(homesStart, homesEnd > homesStart ? homesEnd : undefined) : ''
  const homesHrefs = [...new Set(homesChunk.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? [])]
  const indexTile = indexText.match(/Awbrey Butte[\s\S]{0,220}?(\d+)\s+Active/)
  const cityTile = cityText.match(/Awbrey Butte\s+(\d+)\s+Active/)
  return {
    heroCount: hero ? Number(hero[1]) : null,
    heroPlace: hero ? hero[2].trim() : null,
    faqCount: faq ? Number(faq[1]) : null,
    datasetCount: dataset ? Number(dataset[1]) : null,
    homesUnique: homesHrefs.length,
    indexCount: indexTile ? Number(indexTile[1]) : null,
    cityCount: cityTile ? Number(cityTile[1]) : null,
    placeHas52: /\b52\s+Active\b/.test(placeText) || /\b52\s+homes for sale\b/.test(placeText),
    placeHas63: /\b63\s+homes for sale\b/.test(placeText),
    placeHeroInBend: /homes for sale in Bend/.test(placeText),
    indexHas52NearAwbrey: /Awbrey[\s\S]{0,240}52\s+Active|52\s+Active[\s\S]{0,80}Awbrey/.test(indexText),
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

const [placeHtml, indexHtml, cityHtml] = await Promise.all([
  fetchHtml(PLACE),
  fetchHtml(INDEX),
  fetchHtml(CITY),
])
const extracted = extract(placeHtml, indexHtml, cityHtml)
const shared = extracted.heroCount
const countsAgree =
  shared != null &&
  shared > 0 &&
  extracted.faqCount === shared &&
  extracted.datasetCount === shared &&
  extracted.homesUnique === shared &&
  extracted.indexCount === shared &&
  extracted.cityCount === shared
const staleGone =
  !extracted.placeHas52 &&
  !extracted.placeHas63 &&
  !extracted.placeHeroInBend &&
  !extracted.indexHas52NearAwbrey &&
  extracted.heroPlace === 'Awbrey Butte'
const ok = countsAgree && staleGone

mkdirSync(OUT, { recursive: true })
mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({ headless: true })
await shot(browser, PLACE, { width: 1280, height: 900 }, `${OUT}/place_1280.png`)
await shot(browser, PLACE, { width: 390, height: 844 }, `${OUT}/place_390.png`)
await shot(browser, INDEX, { width: 1280, height: 900 }, `${OUT}/index_1280.png`)
await shot(browser, INDEX, { width: 390, height: 844 }, `${OUT}/index_390.png`)
await shot(browser, INDEX, { width: 1280, height: 900 }, `${OUT}/index_tile_1280.png`, 'Awbrey Butte')
await shot(browser, INDEX, { width: 390, height: 844 }, `${OUT}/index_tile_390.png`, 'Awbrey Butte')
await shot(browser, CITY, { width: 1280, height: 900 }, `${OUT}/city_1280.png`)
await shot(browser, CITY, { width: 390, height: 844 }, `${OUT}/city_390.png`)
await shot(browser, CITY, { width: 1280, height: 900 }, `${OUT}/city_tile_1280.png`, 'Awbrey Butte')
await shot(browser, CITY, { width: 390, height: 844 }, `${OUT}/city_tile_390.png`, 'Awbrey Butte')
await browser.close()

const names = [
  'place_1280',
  'place_390',
  'index_1280',
  'index_390',
  'index_tile_1280',
  'index_tile_390',
  'city_1280',
  'city_390',
  'city_tile_1280',
  'city_tile_390',
]
for (const name of names) {
  const src = `${OUT}/${name}.png`
  const dest = `${ART}/awbrey_count_${name}.png`
  const { copyFileSync } = await import('node:fs')
  copyFileSync(src, dest)
}

const report = { place: PLACE, index: INDEX, city: CITY, extracted, countsAgree, staleGone, ok }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
