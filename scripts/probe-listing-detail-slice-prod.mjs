#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH listing-detail slice at 390+1280.
 *
 *   node scripts/probe-listing-detail-slice-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PROBE_PREFIX || ''

const CASES = [
  { id: 'bryant', path: '/homes-for-sale/albany/bryant-220224428' },
  { id: 'old-bend', path: '/homes-for-sale/bend/old-bend/under-600k' },
  { id: 'old-farm', path: '/homes-for-sale/bend/old-farm-district/under-300k' },
  { id: 'agness', path: '/homes-for-sale/agness/7800-rogue-river-220208750' },
  { id: 'empire', path: '/homes-for-sale/bend/20556-empire-220226741' },
  { id: 'foley', path: '/homes-for-sale/bend/2590-foley-220221409' },
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

async function measure(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ')
    const h1 = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim()
    const factsHoa = (() => {
      const dts = [...document.querySelectorAll('dt')]
      const hoa = dts.find((dt) => /^HOA$/i.test((dt.textContent || '').trim()))
      const dd = hoa?.parentElement?.querySelector('dd')
      return (dd?.textContent || '').replace(/\s+/g, ' ').trim() || null
    })()
    const financialHoa = (() => {
      const groups = [...document.querySelectorAll('h2,h3,legend,caption,div')]
      const fin = groups.find((el) => /^Financial$/i.test((el.textContent || '').trim()))
      const host = fin?.closest('section,article,div') || fin?.parentElement
      const dts = [...(host?.querySelectorAll('dt') || [])]
      const hoa = dts.find((dt) => /^HOA$/i.test((dt.textContent || '').trim()))
      return (hoa?.parentElement?.querySelector('dd')?.textContent || '').replace(/\s+/g, ' ').trim() || null
    })()
    const trueCostLine =
      (text.match(/HOA \$[\d,]+ per month(?:\. Tax \$[\d,]+ per year)?/) || [])[0] || null
    const zeroPrices = [...document.querySelectorAll('a,article,li,div')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => /\$0\b/.test(t) && t.length < 240)
      .slice(0, 12)
    const cardPrices = [...document.querySelectorAll('[data-testid="listing-card"], article, a[href*="/homes-for-sale/"]')]
      .map((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        const price = (t.match(/\$[\d,]+/) || [])[0] || null
        const addr = (t.match(/\d[\w\s.#-]+(?:Street|St|Lane|Ln|Loop|Road|Rd|Ave|Avenue|Creek|Drive|Dr)\b[^$]{0,40}/i) ||
          [])[0]
        return { price, addr: addr?.slice(0, 80) || null, snippet: t.slice(0, 160) }
      })
      .filter((c) => c.price)
      .slice(0, 20)
    const heroStats = (text.match(/\d+\s*bd\b[^.]{0,40}\d+\s*ba\b[^.]{0,40}[\d,]+\s*(?:sqft|SQFT)/i) || [])[0] || null
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((s) => {
        try {
          return [JSON.parse(s.textContent || '')]
        } catch {
          return []
        }
      })
      .flatMap((obj) => {
        const nodes = Array.isArray(obj) ? obj : [obj, obj['@graph']].flat().filter(Boolean)
        return nodes.map((n) => ({
          type: n?.['@type'],
          price: n?.offers?.price ?? n?.price ?? null,
          beds: n?.numberOfBedrooms ?? n?.numberOfRooms ?? null,
          baths: n?.numberOfBathroomsTotal ?? null,
          sqft: n?.floorSize?.value ?? null,
        }))
      })
      .filter((n) => n.price != null || n.beds != null)
    return {
      title: document.title,
      status: document.readyState,
      h1,
      factsHoa,
      financialHoa,
      trueCostLine,
      heroStats,
      hasListPrice: /\$[\d,]+/.test(h1) || /\$[\d,]+/.test(text.slice(0, 800)),
      taxOnly: /Tax \$[\d,]+ per year/i.test(text) && !/\$[\d,]{3,}/.test(h1),
      zeroPriceHits: [...new Set(zeroPrices)],
      cardPrices,
      jsonLd,
      neighborhoodHrefs: [...document.querySelectorAll('a[href*="/neighborhoods"]')].map((a) => ({
        href: a.getAttribute('href'),
        text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      })).slice(0, 12),
      textHead: text.slice(0, 900),
    }
  })
}

async function runCase(browser, viewport, c) {
  const page = await browser.newPage({ viewport: { width: viewport, height: 900 } })
  const url = `${BASE}${c.path}`
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1800)
  await dismissChrome(page)
  await page.waitForTimeout(400)
  const measured = await measure(page)
  mkdirSync(ART, { recursive: true })
  const shot = `${ART}/${PREFIX}${c.id}_${viewport}_top.png`
  await page.screenshot({ path: shot, fullPage: false })
  if (c.id === 'empire' && viewport === 1280) {
    const before = page.url()
    await page.mouse.move(640, 420)
    await page.mouse.wheel(0, 1800)
    await page.waitForTimeout(800)
    const pages = page.context().pages()
    measured.wheel = {
      before,
      after: page.url(),
      pageCount: pages.length,
      urls: pages.map((p) => p.url()),
    }
    await page.screenshot({ path: `${ART}/${PREFIX}${c.id}_${viewport}_after_wheel.png`, fullPage: false })
  }
  await page.close()
  return { id: c.id, viewport, status: res?.status() ?? null, url, shot, ...measured }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const rows = []
  for (const c of CASES) {
    for (const vp of [390, 1280]) {
      rows.push(await runCase(browser, vp, c))
    }
  }
  await browser.close()
  const out = `${ART}/${PREFIX}listing_detail_slice_probe.json`
  writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), base: BASE, rows }, null, 2))
  console.log(JSON.stringify({ out, count: rows.length, rows: rows.map((r) => ({
    id: r.id,
    viewport: r.viewport,
    status: r.status,
    h1: r.h1,
    factsHoa: r.factsHoa,
    financialHoa: r.financialHoa,
    trueCostLine: r.trueCostLine,
    heroStats: r.heroStats,
    taxOnly: r.taxOnly,
    zeroPriceHits: r.zeroPriceHits,
    cardPrices: r.cardPrices?.slice(0, 6),
    jsonLd: r.jsonLd,
    wheel: r.wheel,
  })) }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
