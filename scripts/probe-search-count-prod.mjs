#!/usr/bin/env node
/**
 * Production accept for the search count + 390 chrome class.
 *
 *   node scripts/probe-search-count-prod.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const FILTERED = 'https://ryan-realty.com/homes-for-sale?maxPrice=800000&beds=3'
const CITY = 'https://ryan-realty.com/homes-for-sale/bend'
const HOME = 'https://ryan-realty.com/homes-for-sale'
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
  return { html: await res.text(), cache: res.headers.get('x-vercel-cache') }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const city = await fetchHtml(CITY)
  const cityText = textish(city.html)
  const headerAllTypes = /\d[\d,]*\s+homes for sale, all types/.test(cityText)
  const headerBare = /(\d[\d,]*)\s+homes for sale\./.test(cityText) && !headerAllTypes
  const faqSfr = /active single-family listings/.test(cityText)
  const faqQuestion = /How many single-family homes are for sale/.test(city.html)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  await page.goto(FILTERED, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2800)

  const chipBoxes = await page.evaluate(() => {
    const labels = ['Price', 'Beds', 'Baths', 'Home type', 'For sale']
    return labels.map((label) => {
      const el = [...document.querySelectorAll('button')].find((b) =>
        (b.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()),
      )
      if (!el) return { label, w: 0, h: 0, found: false }
      const r = el.getBoundingClientRect()
      return { label, w: Math.round(r.width), h: Math.round(r.height), found: true }
    })
  })
  const usableChips = chipBoxes.filter((c) => c.w >= 44 && c.h >= 32).length

  const listPhrase = await page.evaluate(() => {
    const text = document.body.innerText || ''
    const match = text.match(/([\d,]+)\s+homes(?:\s+in this map view)?/)
    return match ? match[0] : null
  })

  const countInFold = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('p, span, button')]
    const hit = nodes.find((n) => /homes/.test(n.textContent || '') && /[\d,]/.test(n.textContent || ''))
    if (!hit) return { visible: false, top: null }
    const r = hit.getBoundingClientRect()
    return { visible: r.top >= 0 && r.bottom <= 390 && r.height > 0, top: Math.round(r.top) }
  })

  await page.screenshot({ path: `${ART}/search_count_390_filtered.png` })

  await page.getByRole('button', { name: /all filters/i }).click()
  await page.waitForTimeout(1600)
  const showLabel = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /^Show\s+[\d,]+\s+homes?$/.test((b.textContent || '').trim()),
    )
    return btn ? btn.textContent.trim() : null
  })
  await page.screenshot({ path: `${ART}/search_filters_390_sheet.png` })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(FILTERED, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${ART}/search_count_1280_filtered.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${ART}/search_home_390.png` })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(CITY, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${ART}/search_bend_1280.png` })

  await browser.close()

  const showN = showLabel ? Number((showLabel.match(/[\d,]+/) || ['0'])[0].replace(/,/g, '')) : null
  const listN = listPhrase ? Number((listPhrase.match(/[\d,]+/) || ['0'])[0].replace(/,/g, '')) : null
  const countsAgree = showN != null && listN != null && showN === listN

  const report = {
    cityCache: city.cache,
    headerAllTypes,
    headerBare,
    faqSfr,
    faqQuestion,
    chipBoxes,
    usableChips,
    listPhrase,
    showLabel,
    countsAgree,
    countInFold,
  }
  console.log(JSON.stringify(report, null, 2))

  const ok =
    headerAllTypes &&
    !headerBare &&
    faqSfr &&
    faqQuestion &&
    usableChips >= 3 &&
    countsAgree &&
    countInFold.visible

  if (!ok) {
    console.error('probe-search-count-prod: FAIL')
    process.exit(1)
  }
  console.log('probe-search-count-prod: ok')
  try {
    copyFileSync(`${ART}/search_count_390_filtered.png`, 'out/search-count-prod/search_count_390_filtered.png')
  } catch {
    /* optional */
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
