#!/usr/bin/env node
/**
 * Reproduce the FLEET-PUNCH fleet:public-ux:search slice (8 lines).
 *
 *   node scripts/probe-search-punch-v2.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-search-punch-v2.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const BASE = (process.env.BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const ART = '/opt/cursor/artifacts'
const PREFIX = process.env.PREFIX || 'before_'

async function dismissChrome(page) {
  for (const label of ['Not now', 'Essential only', 'Accept all']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
  }
}

async function inspectSearchChrome(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: text(el).slice(0, 80),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
        display: cs.display,
        overflow: cs.overflow,
      }
    }
    const byLabel = (re) =>
      [...document.querySelectorAll('button, [role="button"], a')].find((n) => re.test(text(n)))
    const chipLabels = ['For sale', 'Price', 'Beds', 'Baths', 'Home type', 'All filters']
    const chips = chipLabels.map((label) => {
      const el = byLabel(new RegExp(`^${label}`, 'i'))
      return { label, found: !!el, ...(box(el) || {}) }
    })
    const save = [...document.querySelectorAll('button, a')].filter((el) =>
      /save this search|search saved|save search/i.test(text(el)),
    )
    const alerts = [...document.querySelectorAll('button, a')].filter((el) =>
      /get listing alerts|\balerts?\b/i.test(text(el)),
    )
    const sort = document.querySelector('[aria-label="Sort results"]')
    const countRow = [...document.querySelectorAll('p, div')].find((el) =>
      /homes in this map view|homes match|No homes/i.test(text(el)),
    )
    const header = document.querySelector('header')
    const stickyChips = [...document.querySelectorAll('div')].find((el) => {
      const cs = getComputedStyle(el)
      return cs.position === 'sticky' && /All filters/i.test(text(el))
    })
    const locationInput = document.querySelector('input[placeholder*="City" i], input[aria-label*="location" i], input[name="location"], input[placeholder*="Search" i]')
    const showing = [...document.querySelectorAll('button, span, p')].find((el) =>
      /Showing .* only/i.test(text(el)),
    )
    const watching = [...document.querySelectorAll('[role="region"], div')].find((el) =>
      /You.?re watching/i.test(text(el)),
    )
    const headerH = header ? Math.round(header.getBoundingClientRect().bottom) : 0
    const sortBox = box(sort)
    const countBox = box(countRow)
    return {
      url: window.location.href,
      title: text(document.querySelector('h1')).slice(0, 120),
      bodyHead: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 280),
      chips,
      save: save.slice(0, 4).map(box),
      alerts: alerts.slice(0, 6).map((el) => ({
        ...box(el),
        href: el.getAttribute('href'),
      })),
      sort: sortBox,
      count: countBox,
      locationValue: locationInput ? locationInput.value : null,
      locationPlaceholder: locationInput ? locationInput.getAttribute('placeholder') : null,
      showing: showing ? text(showing).slice(0, 80) : null,
      watching: watching ? text(watching).slice(0, 160) : null,
      headerBottom: headerH,
      sortClippedByHeader: sortBox ? sortBox.y + 4 < headerH && sortBox.visible : false,
      stickyChipText: stickyChips ? text(stickyChips).slice(0, 80) : null,
    }
  })
}

async function inspectSheet(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const dialog =
      document.querySelector('[data-slot="sheet-content"]') || document.querySelector('[role="dialog"]')
    if (!dialog) return { open: false }
    const r = dialog.getBoundingClientRect()
    const owner = [...dialog.querySelectorAll('label, span')].find((el) => /owner finan/i.test(text(el)))
    return {
      open: true,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth,
      clipped: dialog.scrollWidth > dialog.clientWidth + 2,
      overflowX: getComputedStyle(dialog).overflowX,
      owner: owner
        ? {
            text: text(owner),
            right: Math.round(owner.getBoundingClientRect().right),
            dialogRight: Math.round(r.right),
            clipped: owner.getBoundingClientRect().right > r.right + 1,
          }
        : null,
      labels: [...dialog.querySelectorAll('label')].slice(0, 12).map((el) => text(el).slice(0, 40)),
    }
  })
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = { fetchedAt: new Date().toISOString(), base: BASE, views: {} }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 900
    const page = await browser.newPage({
      viewport: { width, height },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    const key = `w${width}`
    report.views[key] = {}

    // Homepage: Homes + See homes destinations
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(1800)
    await dismissChrome(page)
    report.views[key].homeHrefs = await page.evaluate(() => {
      const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const links = [...document.querySelectorAll('a')].map((a) => ({
        text: text(a).slice(0, 60),
        href: a.getAttribute('href'),
      }))
      return {
        homes: links.filter((l) => /^homes$/i.test(l.text) || /^see homes/i.test(l.text)),
        seeHomes: links.filter((l) => /see homes/i.test(l.text)),
        buy: links.filter((l) => /^buy$/i.test(l.text) || /^homes$/i.test(l.text)),
      }
    })
    await shot(page, `${PREFIX}home_${width}_top`)

    const homesLink = page.getByRole('link', { name: /^homes$/i }).first()
    if (await homesLink.isVisible().catch(() => false)) {
      const [nav] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null),
        homesLink.click(),
      ])
      await page.waitForTimeout(2200)
      await dismissChrome(page)
      report.views[key].afterHomesNav = {
        url: page.url(),
        status: nav?.response()?.status() ?? null,
        chrome: await inspectSearchChrome(page),
      }
      await shot(page, `${PREFIX}after_homes_${width}`)
    } else {
      report.views[key].afterHomesNav = { skipped: true, reason: 'Homes link not visible' }
    }

    // Bare search
    const searchRes = await page.goto(`${BASE}/homes-for-sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    report.views[key].searchHttp = searchRes?.status() ?? null
    report.views[key].search = await inspectSearchChrome(page)
    await shot(page, `${PREFIX}search_${width}_top`)

    const allFilters = page.getByRole('button', { name: /all filters/i }).first()
    const allVisible = await allFilters.isVisible().catch(() => false)
    report.views[key].allFiltersVisible = allVisible
    if (allVisible) {
      await allFilters.click()
      await page.waitForTimeout(900)
      report.views[key].sheet = await inspectSheet(page)
      await shot(page, `${PREFIX}search_${width}_filters`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    } else {
      report.views[key].sheet = { open: false, reason: 'All filters not visible' }
    }

    // Regional list view (what See homes should open)
    const listRes = await page.goto(`${BASE}/homes-for-sale?view=list`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2200)
    await dismissChrome(page)
    report.views[key].listHttp = listRes?.status() ?? null
    report.views[key].list = await inspectSearchChrome(page)
    await shot(page, `${PREFIX}search_list_${width}_top`)

    // beds=3 save residual (do not submit a real email)
    await page.goto(`${BASE}/homes-for-sale?beds=3`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2000)
    await dismissChrome(page)
    report.views[key].beds3 = await inspectSearchChrome(page)
    await shot(page, `${PREFIX}search_beds3_${width}_top`)

    // Join page watching banner (clean visit)
    await page.goto(`${BASE}/join`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(1200)
    await dismissChrome(page)
    report.views[key].joinClean = await page.evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, ' ')
      return {
        url: location.href,
        watching: /You.?re watching/i.test(text),
        snippet: text.slice(0, 200),
      }
    })
    await shot(page, `${PREFIX}join_${width}_clean`)

    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}search_punch_v2.json`, JSON.stringify(report, null, 2))
  const summary = {}
  for (const width of [390, 1280]) {
    const v = report.views[`w${width}`]
    summary[width] = {
      homeHrefs: v.homeHrefs,
      afterHomesUrl: v.afterHomesNav?.url ?? v.afterHomesNav,
      searchUrl: v.search?.url,
      chips: v.search?.chips,
      save: v.search?.save,
      alerts: v.search?.alerts,
      sort: v.search?.sort,
      count: v.search?.count,
      locationValue: v.search?.locationValue,
      showing: v.search?.showing,
      sortClippedByHeader: v.search?.sortClippedByHeader,
      headerBottom: v.search?.headerBottom,
      allFiltersVisible: v.allFiltersVisible,
      sheet: v.sheet,
      listLocation: v.list?.locationValue,
      listShowing: v.list?.showing,
      beds3Watching: v.beds3?.watching,
      joinWatching: v.joinClean?.watching,
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
