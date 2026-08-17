#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'
const CASES = [
  { id: 'calaveras', url: 'https://ryan-realty.com/subdivisions/calaveras' },
  { id: 'townhomes_1925', url: 'https://ryan-realty.com/subdivisions/1925-townhomes' },
  { id: 'blakley_heights', url: 'https://ryan-realty.com/subdivisions/blakley-heights' },
  { id: 'aspenwood', url: 'https://ryan-realty.com/subdivisions/aspenwood' },
  { id: 'canyon_breeze', url: 'https://ryan-realty.com/subdivisions/canyon-breeze' },
  { id: 'aubrey_heights', url: 'https://ryan-realty.com/subdivisions/aubrey-heights' },
  { id: 'summit_west', url: 'https://ryan-realty.com/cities/bend/summit-west' },
  { id: 'bend_park', url: 'https://ryan-realty.com/subdivisions/bend-park' },
]

mkdirSync(ART, { recursive: true })

async function measure(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, ' ')
    const hero = document.querySelector('.hero, [class*="v3-hero"], [data-v3-hero]')
    const heroText = (hero?.textContent ?? '').replace(/\s+/g, ' ')
    const listEmpty = /No active listings in .+ right now/i.test(text)
    const listingLinks = [...document.querySelectorAll('a[href*="/homes-for-sale/"]')]
      .map((a) => a.getAttribute('href') ?? '')
      .filter((h) => /\/homes-for-sale\/[^/]+\/[^/]+\/.+-\d+/.test(h))
    const ticker = document.querySelector('.ticker')
    const tickerText = (ticker?.textContent ?? '').replace(/\s+/g, ' ')
    return {
      heroCount: heroText.match(/(\d+)\s+homes? for sale/i)?.[1] ?? text.match(/(\d+)\s+homes? for sale/i)?.[1] ?? null,
      heroHasSeeHomes: /See homes/i.test(heroText) || /See homes/i.test(text.slice(0, 2000)),
      emptyList: listEmpty,
      listingLinkCount: listingLinks.length,
      listingHrefs: [...new Set(listingLinks)].slice(0, 12),
      medianList: text.match(/Median list\s+\$([\d,]+)/i)?.[1] ?? null,
      pendingDays: text.match(/Pending in\s+([\d.]+)\s+days/i)?.[1] ?? null,
      closed30: text.match(/(\d[\d,]*)\s+Closed\s*[·•]\s*30 days/i)?.[1] ?? null,
      regionalPair: /\$756,000/.test(text) && /18 days/.test(text),
      has2035000: /\$2,035,000/.test(text),
      has2034500: /\$2,034,500/.test(text),
      tickerHas2035000: /\$2,035,000/.test(tickerText),
      tickerHas2034500: /\$2,034,500/.test(tickerText),
      tickerSnippet: tickerText.slice(0, 400),
      heroSnippet: heroText.slice(0, 400),
      bodySnippet: text.slice(0, 700),
    }
  })
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
      await page.waitForTimeout(2500)
      rec.shot = `${ART}/${PREFIX}${c.id}_${width}_top.png`
      await page.screenshot({ path: rec.shot, fullPage: false })
      await page.evaluate(() => {
        const el = document.getElementById('homes') || document.querySelector('.place-map-split, .lst-grid, .v3-field')
        el?.scrollIntoView({ block: 'start' })
      })
      await page.waitForTimeout(400)
      rec.shotHomes = `${ART}/${PREFIX}${c.id}_${width}_homes.png`
      await page.screenshot({ path: rec.shotHomes, fullPage: false })
      rec.measured = await measure(page)
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
    console.log(
      JSON.stringify({
        w: width,
        id: c.id,
        status: rec.status,
        error: rec.error,
        heroCount: rec.measured?.heroCount ?? null,
        emptyList: rec.measured?.emptyList ?? null,
        listingLinkCount: rec.measured?.listingLinkCount ?? null,
        regionalPair: rec.measured?.regionalPair ?? null,
        has2035000: rec.measured?.has2035000 ?? null,
        has2034500: rec.measured?.has2034500 ?? null,
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
  writeFileSync(`${ART}/${PREFIX}place_pages_punch_v5.json`, JSON.stringify(out, null, 2))
  console.log('wrote', `${ART}/${PREFIX}place_pages_punch_v5.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
