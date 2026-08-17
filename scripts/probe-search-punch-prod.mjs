/**
 * Reproduce-or-reject the served fleet:public-ux:search punch slice.
 *
 *   node scripts/probe-search-punch-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const HOME = `${BASE}/homes-for-sale`
const BEDS3 = `${BASE}/homes-for-sale?beds=3`
const BEDS4 = `${BASE}/homes-for-sale?beds=4`
const ART = '/opt/cursor/artifacts'

function parseCounts(text) {
  const match = text.match(/([\d,]+)\+?\s+homes(?!\s+for sale)/)
  const map = text.match(/([\d,]+)\+?\s+homes in this map view/)
  const delayed = /Search took too long|Search delayed|Try again/i.test(text)
  return {
    matchPhrase: match ? match[0] : null,
    matchN: match ? Number(match[1].replace(/,/g, '')) : null,
    mapPhrase: map ? map[0] : null,
    mapN: map ? Number(map[1].replace(/,/g, '')) : null,
    delayed,
    showingBend: /Showing Bend|Bend only|· Bend/i.test(text),
  }
}

async function snapshot(page, label) {
  const text = await page.evaluate(() => document.body.innerText || '')
  const url = page.url()
  const chips = await page.evaluate(() => {
    const labels = ['Price', 'Beds', 'Baths', 'Home type', 'For sale', 'All filters']
    return labels.map((label) => {
      const el = [...document.querySelectorAll('button')].find((b) => {
        const t = (b.textContent || '').trim().toLowerCase()
        return t === label.toLowerCase() || t.startsWith(`${label.toLowerCase()}:`) || t.startsWith(label.toLowerCase())
      })
      if (!el) return { label, found: false, w: 0, h: 0, visible: false }
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return {
        label,
        found: true,
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0,
        display: style.display,
        visibility: style.visibility,
      }
    })
  })
  const alerts = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('a, button, [role="button"]')]
    return nodes
      .filter((n) => /alert|save this search/i.test(n.textContent || ''))
      .map((n) => {
        const r = n.getBoundingClientRect()
        const style = getComputedStyle(n)
        return {
          text: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          tag: n.tagName,
          href: n.getAttribute('href'),
          w: Math.round(r.width),
          h: Math.round(r.height),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          visibility: style.visibility,
          display: style.display,
        }
      })
  })
  return { label, url, ...parseCounts(text), chips, alerts }
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(3500)
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = { base: BASE, at: new Date().toISOString(), shots: [] }

  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })

  await goto(desktop, HOME)
  report.home1280 = await snapshot(desktop, 'home-1280')
  await desktop.screenshot({ path: `${ART}/search_punch_home_1280.png`, fullPage: false })
  report.shots.push('search_punch_home_1280.png')

  const bedsBtn = desktop.getByRole('button', { name: /^Beds/i }).first()
  const beforeUrl = desktop.url()
  if (await bedsBtn.count()) {
    await bedsBtn.click({ timeout: 8_000 })
    await desktop.waitForTimeout(1200)
  }
  const afterClickUrl = desktop.url()
  report.bedsClick1280 = {
    beforeUrl,
    afterClickUrl,
    stayedOnSearch: /\/homes-for-sale\/?(\?|$)/.test(afterClickUrl) && !/\/homes-for-sale\/[^?]+\/.+-/.test(afterClickUrl),
    dropdownOpen: await desktop.getByText(/Min bedrooms/i).isVisible().catch(() => false),
  }
  await desktop.screenshot({ path: `${ART}/search_punch_beds_click_1280.png`, fullPage: false })
  report.shots.push('search_punch_beds_click_1280.png')

  await goto(desktop, BEDS3)
  report.beds3_1280 = await snapshot(desktop, 'beds3-1280')
  await desktop.screenshot({ path: `${ART}/search_punch_beds3_1280.png`, fullPage: false })
  report.shots.push('search_punch_beds3_1280.png')

  await goto(desktop, BEDS4)
  report.beds4_1280 = await snapshot(desktop, 'beds4-1280')
  await desktop.screenshot({ path: `${ART}/search_punch_beds4_1280.png`, fullPage: false })
  report.shots.push('search_punch_beds4_1280.png')

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })

  await goto(mobile, HOME)
  report.home390 = await snapshot(mobile, 'home-390')
  await mobile.screenshot({ path: `${ART}/search_punch_home_390.png`, fullPage: false })
  report.shots.push('search_punch_home_390.png')

  const allFilters = mobile.getByRole('button', { name: /all filters/i }).first()
  if (await allFilters.count()) {
    await allFilters.click({ timeout: 8_000 })
    await mobile.waitForTimeout(1800)
  }
  report.sheet390 = await mobile.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]')
    if (!sheet) return { open: false }
    const r = sheet.getBoundingClientRect()
    const overflowX = sheet.scrollWidth > sheet.clientWidth + 2
    const inputs = [...sheet.querySelectorAll('input')].map((el) => {
      const ir = el.getBoundingClientRect()
      return {
        clipped: ir.right > r.right + 2 || ir.left < r.left - 2,
        w: Math.round(ir.width),
        right: Math.round(ir.right),
        sheetRight: Math.round(r.right),
      }
    })
    const owner = [...sheet.querySelectorAll('label, span, p, button')].find((n) =>
      /owner finan/i.test(n.textContent || ''),
    )
    const find = sheet.querySelector('input[placeholder*="Find a filter" i], input[aria-label*="Find a filter" i]')
    return {
      open: true,
      w: Math.round(r.width),
      overflowX,
      inputClipped: inputs.some((i) => i.clipped),
      inputs: inputs.slice(0, 6),
      ownerText: owner ? (owner.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      findPresent: !!find,
    }
  })
  await mobile.screenshot({ path: `${ART}/search_punch_sheet_390.png`, fullPage: false })
  report.shots.push('search_punch_sheet_390.png')

  if (report.sheet390.findPresent) {
    const find = mobile.getByLabel(/find a filter/i).first()
    await find.fill('pool')
    await mobile.waitForTimeout(800)
    report.sheet390.afterFindOpen = await mobile.getByRole('heading', { name: /all filters/i }).isVisible().catch(() => false)
    await mobile.screenshot({ path: `${ART}/search_punch_sheet_find_390.png`, fullPage: false })
    report.shots.push('search_punch_sheet_find_390.png')
  }

  await goto(mobile, BEDS3)
  report.beds3_390 = await snapshot(mobile, 'beds3-390')
  await mobile.screenshot({ path: `${ART}/search_punch_beds3_390.png`, fullPage: false })
  report.shots.push('search_punch_beds3_390.png')

  await goto(mobile, BEDS4)
  report.beds4_390 = await snapshot(mobile, 'beds4-390')
  await mobile.screenshot({ path: `${ART}/search_punch_beds4_390.png`, fullPage: false })
  report.shots.push('search_punch_beds4_390.png')

  const providence = await desktop.evaluate(async () => {
    const cards = [...document.querySelectorAll('a')].filter((a) =>
      /654\s+Providence/i.test(a.textContent || ''),
    )
    return cards.slice(0, 3).map((a) => ({ href: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) }))
  })
  report.providenceOnBeds4 = providence

  if (!providence.length) {
    await goto(desktop, `${HOME}?q=654+Providence`)
    report.providenceSearch = await desktop.evaluate(() => {
      const cards = [...document.querySelectorAll('a')].filter((a) =>
        /654\s+Providence/i.test(a.textContent || ''),
      )
      return cards.slice(0, 3).map((a) => ({ href: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) }))
    })
  }

  const listingHref =
    (report.providenceOnBeds4?.[0]?.href || report.providenceSearch?.[0]?.href || '').replace(BASE, '') ||
    null
  if (listingHref) {
    await goto(desktop, listingHref.startsWith('http') ? listingHref : `${BASE}${listingHref}`)
    report.listing1280 = {
      url: desktop.url(),
      hasPriceHistory: await desktop.getByText(/price history/i).count(),
      hasStatusChange: await desktop.getByText(/status change|status history/i).count(),
      hasOds: await desktop.getByText(/ODS|owner.?financ/i).count(),
    }
    await desktop.screenshot({ path: `${ART}/search_punch_listing_1280.png`, fullPage: false })
    report.shots.push('search_punch_listing_1280.png')
  }

  await browser.close()
  writeFileSync(`${ART}/search_punch_probe.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
