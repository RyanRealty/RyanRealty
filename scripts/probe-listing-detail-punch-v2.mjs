#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH listing-detail slice at 390+1280.
 *
 *   node scripts/probe-listing-detail-punch-v2.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'

const CASES = [
  { id: 'borden', path: '/homes-for-sale/bend/61055-borden-220225742', mls: '220225742' },
  { id: 'rockway-short', path: '/homes-for-sale/bend/61579-rockway-220226183', mls: '220226183' },
  {
    id: 'rockway-canonical',
    path: '/homes-for-sale/bend/old-farm-district/desert-woods/61579-rockway-220226183',
    mls: '220226183',
  },
  {
    id: 'breezes',
    path: '/homes-for-sale/bend/lane-knolls/61345-mountain-breezes-220226708',
    mls: '220226708',
  },
]

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}

async function measureListing(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ')
    const headings = [...document.querySelectorAll('h1,h2,h3')].map((el) =>
      (el.textContent || '').replace(/\s+/g, ' ').trim(),
    )
    const unmute = [...document.querySelectorAll('button,[aria-label]')].filter((el) =>
      /unmute|mute video/i.test(`${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`),
    )
    const unmuteVisible = unmute
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
          aria: el.getAttribute('aria-label'),
          w: Math.round(r.width),
          h: Math.round(r.height),
          x: Math.round(r.x),
          y: Math.round(r.y),
          visible: r.width > 0 && r.height > 0,
        }
      })
      .filter((b) => b.visible)
    const videos = [...document.querySelectorAll('video')].map((el) => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), src: el.currentSrc || el.src || null }
    })
    const iframes = [...document.querySelectorAll('iframe')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        src: el.getAttribute('src') || '',
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
      }
    })
    const historyHeading = headings.find((h) => /listing history|price history|status history/i.test(h)) || null
    const openHousesHeading = headings.find((h) => /open houses/i.test(h)) || null
    const openHouseDates = (text.match(/(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday), [A-Z][a-z]{2} \d{1,2}/g) || [])
    const daysOnMarket = (text.match(/(\d+)\s*days? on market/i) || [])[0] || null
    const heroPrice = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim()
    const ods = (text.match(/Listing courtesy of[^.]+/i) || [])[0] || null
    const similar = headings.some((h) => /similar|homes like this|nearby/i.test(h))
    const contact = [...document.querySelectorAll('a[href*="/contact"]')].some((a) =>
      /tour|contact|ask|broker/i.test(a.textContent || ''),
    )
    return {
      title: document.title,
      heroPrice,
      headings: headings.slice(0, 24),
      historyHeading,
      hasHistorySection: Boolean(historyHeading),
      daysOnMarket,
      openHousesHeading,
      openHouseDates,
      unmuteVisible,
      videoCount: videos.length,
      videos,
      iframeCount: iframes.length,
      visibleIframes: iframes.filter((f) => f.visible),
      ods,
      similar,
      contact,
      crashed: /Aw, Snap|Error code: 9/i.test(text),
      snippet: text.slice(0, 420),
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${PREFIX}${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function runViewport(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    userAgent: 'rr-ci-probe/1.0 (+https://ryan-realty.com/robots.txt)',
  })
  const page = await context.newPage()
  const rows = {}
  for (const c of CASES) {
    const rec = { id: c.id, path: c.path, mls: c.mls }
    try {
      const res = await page.goto(`${BASE}${c.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      rec.status = res?.status() ?? null
      rec.finalUrl = page.url()
      await page.waitForTimeout(2200)
      await dismissChrome(page)
      rec.measure = await measureListing(page)
      rec.shotTop = await shot(page, `listing_${c.id}_${width}_top`)
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('h2,h3,div')].find((n) =>
          /Listing history|Price history|Open houses|Days on market|WHAT THIS LISTING SHOWS/i.test(
            n.textContent || '',
          ),
        )
        el?.scrollIntoView({ block: 'center' })
      })
      await page.waitForTimeout(400)
      rec.shotMid = await shot(page, `listing_${c.id}_${width}_mid`)
    } catch (err) {
      rec.error = err instanceof Error ? err.message : String(err)
    }
    rows[c.id] = rec
  }
  await context.close()
  return rows
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const out = { fetchedAt: new Date().toISOString(), base: BASE, viewports: {} }
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    out.viewports[String(w)] = await runViewport(browser, w, h)
  }
  await browser.close()
  writeFileSync(`${ART}/${PREFIX}listing_detail_punch_v2.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
