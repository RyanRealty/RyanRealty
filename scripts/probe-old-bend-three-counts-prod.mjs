#!/usr/bin/env node
/**
 * Production accept for the Old Bend 6 / 9 / 7 / 8 three-count finding.
 * Rejects the stale observation when index, city tile, hero, map badge,
 * FAQ, Dataset, and #homes share one count and one median.
 *
 *   node scripts/probe-old-bend-three-counts-prod.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const PLACE = 'https://ryan-realty.com/cities/bend/old-bend'
const INDEX = 'https://ryan-realty.com/neighborhoods'
const CITY = 'https://ryan-realty.com/cities/bend'
const OUT = 'out/old-bend-three-counts-prod'
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
  return { html: await res.text(), cache: res.headers.get('x-vercel-cache'), age: res.headers.get('age') }
}

function extract(placeHtml, indexHtml, cityHtml) {
  const placeText = textish(placeHtml)
  const indexText = textish(indexHtml)
  const cityText = textish(cityHtml)
  const hero = placeText.match(/(\d+)\s+homes for sale in ([^.]+?)\./)
  const faq = placeHtml.match(/There are (\d+) active single-family listings in Old Bend/)
  const dataset = placeHtml.match(/"name":"Active Listings","value":(\d+)/)
  const mapBadge = placeHtml.match(/totalActive[^0-9]{0,40}(\d+)/)
  const homesStart = placeHtml.indexOf('id="homes"')
  const homesEnd = placeHtml.indexOf('id="overview"')
  const homesChunk =
    homesStart >= 0 ? placeHtml.slice(homesStart, homesEnd > homesStart ? homesEnd : undefined) : ''
  const homesHrefs = [...new Set(homesChunk.match(/href="(\/homes-for-sale\/[^"]+-\d+)"/g) ?? [])]
  const indexTile = indexText.match(/Old Bend[\s\S]{0,280}?(\d+)\s+Active/)
  const cityTile = cityText.match(/Old Bend\s+(\d+)\s+Active/)
  const placeMedian = placeText.match(/Median list\s+\$([\d,]+)/)
  const indexMedian = indexText.match(/Old Bend[\s\S]{0,360}?\$([\d,]+)/)
  const cityMedian = cityText.match(/Old Bend\s+\$([\d,]+)/)
  return {
    heroCount: hero ? Number(hero[1]) : null,
    heroPlace: hero ? hero[2].trim() : null,
    faqCount: faq ? Number(faq[1]) : null,
    datasetCount: dataset ? Number(dataset[1]) : null,
    mapBadgeCount: mapBadge ? Number(mapBadge[1]) : null,
    homesUnique: homesHrefs.length,
    indexCount: indexTile ? Number(indexTile[1]) : null,
    cityCount: cityTile ? Number(cityTile[1]) : null,
    placeMedian: placeMedian ? Number(placeMedian[1].replace(/,/g, '')) : null,
    indexMedian: indexMedian ? Number(indexMedian[1].replace(/,/g, '')) : null,
    cityMedian: cityMedian ? Number(cityMedian[1].replace(/,/g, '')) : null,
    placeHas6: /\b6\s+homes for sale\b/.test(placeText) || /\b6\s+active single-family\b/.test(placeText),
    placeHas8: /\b8\s+homes for sale\b/.test(placeText) || /\b8\s+active single-family\b/.test(placeText),
    placeHas9: /\b9\s+homes for sale\b/.test(placeText) || /\b9\s+ACTIVE\b/.test(placeText),
    indexHas6NearOldBend: /Old Bend[\s\S]{0,240}6\s+Active|6\s+Active[\s\S]{0,80}Old Bend/.test(indexText),
    cityHas6NearOldBend: /Old Bend[\s\S]{0,80}6\s+Active|6\s+Active[\s\S]{0,40}Old Bend/.test(cityText),
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

const [place, index, city] = await Promise.all([fetchHtml(PLACE), fetchHtml(INDEX), fetchHtml(CITY)])
const extracted = extract(place.html, index.html, city.html)
const shared = extracted.heroCount
const countsAgree =
  shared != null &&
  shared > 0 &&
  extracted.faqCount === shared &&
  extracted.datasetCount === shared &&
  extracted.mapBadgeCount === shared &&
  extracted.homesUnique === shared &&
  extracted.indexCount === shared &&
  extracted.cityCount === shared
const mediansAgree =
  extracted.placeMedian != null &&
  extracted.placeMedian === extracted.indexMedian &&
  extracted.placeMedian === extracted.cityMedian
const staleGone =
  !extracted.placeHas6 &&
  !extracted.placeHas8 &&
  !extracted.placeHas9 &&
  !extracted.indexHas6NearOldBend &&
  !extracted.cityHas6NearOldBend &&
  extracted.heroPlace === 'Old Bend'
const ok = countsAgree && mediansAgree && staleGone

mkdirSync(OUT, { recursive: true })
mkdirSync(ART, { recursive: true })

const browser = await chromium.launch({ headless: true })
await shot(browser, PLACE, { width: 1280, height: 900 }, `${OUT}/place_1280.png`)
await shot(browser, PLACE, { width: 390, height: 844 }, `${OUT}/place_390.png`)
await shot(browser, INDEX, { width: 1280, height: 900 }, `${OUT}/index_tile_1280.png`, 'Old Bend')
await shot(browser, INDEX, { width: 390, height: 844 }, `${OUT}/index_tile_390.png`, 'Old Bend')
await shot(browser, CITY, { width: 1280, height: 900 }, `${OUT}/city_nbh_1280.png`, 'Old Bend')
await shot(browser, CITY, { width: 390, height: 844 }, `${OUT}/city_nbh_390.png`, 'Old Bend')
await browser.close()

const names = ['place_1280', 'place_390', 'index_tile_1280', 'index_tile_390', 'city_nbh_1280', 'city_nbh_390']
for (const name of names) {
  copyFileSync(`${OUT}/${name}.png`, `${ART}/old_bend_three_${name}.png`)
}

const report = {
  place: PLACE,
  index: INDEX,
  city: CITY,
  cache: { place: place.cache, index: index.cache, city: city.cache },
  age: { place: place.age, index: index.age, city: city.age },
  extracted,
  countsAgree,
  mediansAgree,
  staleGone,
  ok,
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!ok) process.exit(1)
