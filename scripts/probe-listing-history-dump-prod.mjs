#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH listing-detail slice at 390+1280.
 *
 *   node scripts/probe-listing-history-dump-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || 'before_'

const CASES = [
  { id: 'empire', path: '/homes-for-sale/bend/20556-empire-220226741', scroll: 'history' },
  { id: 'rockway', path: '/homes-for-sale/bend/61579-rockway-220226183' },
  { id: 'swalley', path: '/homes-for-sale/bend/65255-swalley-220207865', scroll: 'history' },
  { id: 'ninth', path: '/homes-for-sale/bend/orchard-district/1st-addition-bend-pk/438-9th-220208193', scroll: 'specs' },
  { id: 'roosevelt', path: '/homes-for-sale/bend/southern-crossing/2nd-addition-bend-pk/195-roosevelt-220225285', scroll: 'courtesy' },
]

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all', 'NOT NOW']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}

async function measureListing(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ')
    const lotDt = [...document.querySelectorAll('dt')].find((dt) => /^Lot size$/i.test((dt.textContent || '').trim()))
    const lotDd = lotDt?.parentElement?.querySelector('dd')
    return {
      title: document.title,
      h1: (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim(),
      unmute: /UNMUTE/i.test(text),
      videoCount: document.querySelectorAll('video').length,
      listingHistory: /Listing history/i.test(text),
      listed: /\bListed\b/i.test(text),
      listPriceRaw: /ListPrice:\s*\d/i.test(text),
      listPriceRawSnip: (text.match(/ListPrice:[^.]{0,60}/) || [])[0] || null,
      threeMillionDown: /3,000,000 down/i.test(text),
      dollarDown: /\$\d[\d,.]*[KM]?\s+down/i.test(text),
      courtesy: (text.match(/Listing courtesy of[^.]+/) || [])[0] || null,
      dataLastUpdated: (text.match(/Data last updated[^.]{0,40}/) || [])[0] || null,
      lotSize: (lotDd?.textContent || '').replace(/\s+/g, ' ').trim() || null,
      acresHero: (text.match(/\d[\d,.]*\s*acres/i) || [])[0] || null,
      interstitial: /Next step: get alerts for homes like this/i.test(text),
      notNow: /\bNOT NOW\b/i.test(text),
      futureAug17: /August 17, 2026/i.test(text),
      futureAug16: /August 16, 2026/i.test(text),
      crashed: /Aw, Snap|Error code: 9/i.test(text),
    }
  })
}

async function scrollTo(page, kind) {
  if (!kind) return
  await page.evaluate((target) => {
    const re =
      target === 'history'
        ? /Listing history/i
        : target === 'specs'
          ? /Lot size|Property details|Facts/i
          : /Listing courtesy of/i
    const el = [...document.querySelectorAll('h2,h3,dt,p,div')].find((n) => re.test(n.textContent || ''))
    el?.scrollIntoView({ block: 'center' })
  }, kind)
  await page.waitForTimeout(400)
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
    const rec = { id: c.id, path: c.path }
    try {
      const res = await page.goto(`${BASE}${c.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      rec.status = res?.status() ?? null
      await page.waitForTimeout(1800)
      await dismissChrome(page)
      rec.measure = await measureListing(page)
      rec.shotTop = await shot(page, `${c.id}_${width}_top`)
      if (c.scroll) {
        await scrollTo(page, c.scroll)
        rec.measureAfterScroll = await measureListing(page)
        rec.shotScroll = await shot(page, `${c.id}_${width}_${c.scroll}`)
      }
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
  writeFileSync(`${ART}/${PREFIX}listing_history_dump_probe.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
