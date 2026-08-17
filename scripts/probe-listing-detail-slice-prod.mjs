#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH listing-detail slice (2026-08-17T05:40).
 *
 *   node scripts/probe-listing-detail-slice-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'

const CASES = [
  { id: 'bryant', path: '/homes-for-sale/albany/bryant-220224428', kind: 'listing' },
  { id: 'old-bend', path: '/homes-for-sale/bend/old-bend/under-600k', kind: 'search' },
  { id: 'old-farm', path: '/homes-for-sale/bend/old-farm-district/under-300k', kind: 'search' },
  { id: 'agness', path: '/homes-for-sale/agness/7800-rogue-river-220208750', kind: 'listing' },
  { id: 'empire', path: '/homes-for-sale/bend/20556-empire-220226741', kind: 'listing' },
  { id: 'foley', path: '/homes-for-sale/bend/2590-foley-220221409', kind: 'listing' },
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

async function measure(page, kind) {
  return page.evaluate((pageKind) => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ')
    const h1 = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim()
    const prices = [...text.matchAll(/\$[\d,]+(?:\.\d+)?/g)].map((m) => m[0]).slice(0, 24)
    const zeroPrices = [...text.matchAll(/\$0\b/g)].map((m) => m[0])
    const hoaLines = [...text.matchAll(/HOA \$[\d,]+ per month/g)].map((m) => m[0])
    const factsHoa = (() => {
      const dts = [...document.querySelectorAll('dt')]
      const hoa = dts.find((dt) => /^HOA$/i.test((dt.textContent || '').trim()))
      const dd = hoa?.parentElement?.querySelector('dd')
      return (dd?.textContent || '').replace(/\s+/g, ' ').trim() || null
    })()
    const trueCostLine =
      (text.match(/HOA \$[\d,]+ per month(?:\. Tax \$[\d,]+ per year)?/) || [])[0] || null
    const taxOnly = /Tax \$[\d,]+ per year/.test(text) && !/\$[\d,]{3,}/.test(h1)
    const heroStats = (text.match(/\d+\s*BD\s*[·•]\s*\d+\s*BA\s*[·•]\s*[\d,]+\s*SQFT/i) ||
      text.match(/\d+\s*bd\s*[·•]\s*\d+(?:\.\d+)?\s*ba\s*[·•]\s*[\d,]+\s*sqft/i) ||
      [])[0] || null
    const cards = [...document.querySelectorAll('a[href*="/homes-for-sale/"]')]
      .map((a) => {
        const t = (a.textContent || '').replace(/\s+/g, ' ').trim()
        const price = (t.match(/\$[\d,]+/) || [])[0] || null
        return { href: a.getAttribute('href') || '', text: t.slice(0, 180), price }
      })
      .filter((c) => /\$/.test(c.text) || /bd|ba|sqft/i.test(c.text))
      .slice(0, 12)
    return {
      title: document.title,
      h1,
      kind: pageKind,
      prices,
      zeroPrices,
      hoaLines,
      factsHoa,
      trueCostLine,
      taxOnly,
      heroStats,
      cards,
      hasListPriceInH1: /\$[\d,]+/.test(h1),
      crashed: /Aw, Snap|Error code: 9/i.test(text),
      snippet: text.slice(0, 500),
    }
  }, kind)
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
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
    const rec = { id: c.id, path: c.path, kind: c.kind }
    try {
      const res = await page.goto(`${BASE}${c.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      rec.status = res?.status() ?? null
      await page.waitForTimeout(2000)
      await dismissChrome(page)
      rec.measure = await measure(page, c.kind)
      rec.shotTop = await shot(page, `slice_${c.id}_${width}_top`)
      if (c.kind === 'listing' && (c.id === 'empire' || c.id === 'foley' || c.id === 'bryant')) {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('dt,h2,h3,div')].find((n) =>
            /Property details|True cost|Financial|What this listing shows/i.test(n.textContent || ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotFacts = await shot(page, `slice_${c.id}_${width}_facts`)
        rec.measureAfterScroll = await measure(page, c.kind)
      }
      if (c.id === 'empire') {
        const popped = []
        context.on('page', (p) => popped.push(p.url()))
        await page.mouse.move(width / 2, height / 2)
        await page.mouse.wheel(0, 1800)
        await page.waitForTimeout(800)
        rec.wheel = {
          urlAfter: page.url(),
          popped,
        }
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
  writeFileSync(`${ART}/listing_detail_slice_probe.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
