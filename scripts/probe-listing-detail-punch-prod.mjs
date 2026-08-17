#!/usr/bin/env node
/**
 * Reproduce the served FLEET-PUNCH listing-detail slice at 390+1280.
 *
 *   node scripts/probe-listing-detail-punch-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'

const CASES = [
  {
    id: 'hilmer',
    path: '/homes-for-sale/bend/ridgewater/61172-hilmer-creek-220222626',
    contactMls: '/contact?listingKey=220222626&intent=tour',
  },
  { id: '7th', path: '/homes-for-sale/redmond/121-west-phase-3/3366-7th-220223472' },
  { id: 'horse', path: '/homes-for-sale/sisters/saddlestone/1005-horse-back-220216121' },
  { id: 'kokanee', path: '/homes-for-sale/la-pine/wild-river/53509-kokanee-220215708' },
  { id: 'hudspeth', path: '/homes-for-sale/prineville/ochoco-pointe/895-hudspeth-220223399' },
  { id: 'canyons', path: '/homes-for-sale/terrebonne/ranch-at-the-canyons/11750-canyons-ranch-220210064' },
  { id: 'foley', path: '/homes-for-sale/bend/2590-foley-220221409' },
  { id: 'bryant', path: '/homes-for-sale/albany/bryant-220224428' },
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
    const hrefs = [...document.querySelectorAll('a[href*="listingKey="]')].map((a) => a.getAttribute('href') || '')
    const factsHoa = (() => {
      const dts = [...document.querySelectorAll('dt')]
      const hoa = dts.find((dt) => /^HOA$/i.test((dt.textContent || '').trim()))
      const dd = hoa?.parentElement?.querySelector('dd')
      return (dd?.textContent || '').replace(/\s+/g, ' ').trim() || null
    })()
    const trueCost = (() => {
      const row = [...document.querySelectorAll('dt,h3,p,span,div')].find((el) =>
        /^True cost$/i.test((el.textContent || '').trim()),
      )
      const host = row?.closest('div,article,section,li,dl') || row?.parentElement
      return (host?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) || null
    })()
    const trueCostLine = (text.match(/HOA \$[\d,]+ per month(?:\. Tax \$[\d,]+ per year)?/) || [])[0] || null
    const heroPrice = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim()
    const drop = (text.match(/Down \$[\d,]+ from original list price \$[\d,]+/) || [])[0] || null
    const jsonLdPrices = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((s) => {
        try {
          return [JSON.parse(s.textContent || '')]
        } catch {
          return []
        }
      })
      .flatMap((obj) => {
        const nodes = Array.isArray(obj) ? obj : [obj, obj['@graph']].flat().filter(Boolean)
        return nodes
          .map((n) => n?.offers?.price ?? n?.price)
          .filter((p) => p != null)
      })
    const baths = {
      hero: (text.match(/\d+(?:\.\d+)?\s*ba\b/i) || [])[0] || null,
      remarks25: /2\.5 bath/i.test(text),
    }
    return {
      title: document.title,
      heroPrice,
      drop,
      factsHoa,
      trueCost,
      trueCostLine,
      jsonLdPrices,
      hrefs: [...new Set(hrefs)].slice(0, 12),
      baths,
      crashed: /Aw, Snap|Error code: 9/i.test(text),
    }
  })
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
    const rec = { id: c.id, path: c.path }
    try {
      const res = await page.goto(`${BASE}${c.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      rec.status = res?.status() ?? null
      await page.waitForTimeout(1800)
      await dismissChrome(page)
      rec.measure = await measureListing(page)
      rec.shotTop = await shot(page, `listing_${c.id}_${width}_top`)
      if (c.id === 'foley' || c.id === 'canyons' || c.id === '7th' || c.id === 'hudspeth') {
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('dt,h2,h3,div')].find((n) =>
            /Property details|True cost|Financial/i.test(n.textContent || ''),
          )
          el?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(400)
        rec.shotFacts = await shot(page, `listing_${c.id}_${width}_facts`)
      }
      if (c.contactMls) {
        await page.goto(`${BASE}${c.contactMls}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(1200)
        await dismissChrome(page)
        const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
        rec.contactMls = {
          hasHilmer: /61172|Hilmer/i.test(body),
          snippet: body.slice(0, 280),
        }
        rec.contactShot = await shot(page, `listing_hilmer_contact_mls_${width}`)
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
  writeFileSync(`${ART}/listing_detail_punch_probe.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
