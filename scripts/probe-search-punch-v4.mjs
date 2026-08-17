#!/usr/bin/env node
/**
 * Reproduce the FLEET-PUNCH fleet:public-ux:search slice (8 lines).
 *
 *   node scripts/probe-search-punch-v4.mjs
 *   BASE_URL=https://ryan-realty.com PREFIX=before_ node scripts/probe-search-punch-v4.mjs
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

function overlaps(a, b) {
  if (!a || !b || !a.visible || !b.visible) return false
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

async function shot(page, name) {
  const path = `${ART}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function inspectSearchChrome(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: text(el).slice(0, 160),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
        display: cs.display,
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        bg: cs.backgroundColor,
      }
    }
    const byLabel = (re) =>
      [...document.querySelectorAll('button, [role="button"], a')].find((n) => re.test(text(n)))
    const chipLabels = ['For sale', 'Pending', 'Sold', 'Price', 'Beds', 'Baths', 'Home type', 'All filters']
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
    const countRow = [...document.querySelectorAll('p, div, span')].find((el) =>
      /homes in this map view|homes match|homes found|No homes/i.test(text(el)),
    )
    const header = document.querySelector('header')
    const mapList = [...document.querySelectorAll('button, [role="tab"], a')].filter((el) =>
      /^(map|list)$/i.test(text(el)),
    )
    const cards = [...document.querySelectorAll('a')].filter((a) =>
      /\/homes-for-sale\/.+-\d{6,}/.test(a.getAttribute('href') || ''),
    )
    const firstCard = cards[0] || null
    const h1 = document.querySelector('h1')
    const h1Box = box(h1)
    const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0
    const bandAboveH1 = h1Box ? Math.max(0, h1Box.y - headerBottom) : null
    const searchFrame = document.querySelector('.search-app-frame')
    const dock = document.querySelector('[data-search-dock], .search-filter-dock, [class*="filter-dock"]')
    const mapCanvas = document.querySelector('canvas, .gm-style, [class*="mapbox"]')
    const mapImgs = [...document.querySelectorAll('.gm-style img, canvas')].slice(0, 8).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName,
        src: el.getAttribute('src')?.slice(0, 80) || null,
        w: Math.round(r.width),
        h: Math.round(r.height),
        y: Math.round(r.y),
      }
    })
    return {
      url: window.location.href,
      title: text(h1).slice(0, 160),
      bodyHead: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 420),
      chips,
      save: save.slice(0, 4).map(box),
      alerts: alerts.slice(0, 6).map((el) => ({
        ...box(el),
        href: el.getAttribute('href'),
      })),
      sort: box(sort),
      count: box(countRow),
      mapList: mapList.map((el) => ({ ...box(el), href: el.getAttribute('href') })),
      firstCard: firstCard ? { href: firstCard.getAttribute('href'), ...box(firstCard) } : null,
      cardCount: cards.length,
      headerBottom,
      h1: h1Box,
      bandAboveH1,
      searchFrame: box(searchFrame),
      dock: box(dock),
      mapCanvas: box(mapCanvas),
      mapImgs,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
}

async function inspectSheet(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const sheet =
      document.querySelector('[data-slot="sheet-content"]') ||
      document.querySelector('[role="dialog"]')
    if (!sheet) return { open: false }
    const r = sheet.getBoundingClientRect()
    const inputs = [...sheet.querySelectorAll('input')].map((el) => {
      const ir = el.getBoundingClientRect()
      return {
        name: el.getAttribute('name') || el.getAttribute('placeholder') || el.getAttribute('aria-label'),
        x: Math.round(ir.x),
        y: Math.round(ir.y),
        w: Math.round(ir.width),
        right: Math.round(ir.right),
        clipped: ir.right > window.innerWidth - 2,
      }
    })
    const apply = [...sheet.querySelectorAll('button')].find((el) =>
      /show .+home|apply filters/i.test(text(el)),
    )
    return {
      open: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      right: Math.round(r.right),
      viewportW: window.innerWidth,
      widerThanViewport: r.width > window.innerWidth + 1,
      text: text(sheet).slice(0, 500),
      apply: apply ? text(apply) : null,
      clippedInputs: inputs.filter((i) => i.clipped),
      inputCount: inputs.length,
    }
  })
}

async function inspectListingHero(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const videos = [...document.querySelectorAll('video')]
    const unmute = [...document.querySelectorAll('button')].filter((el) =>
      /unmute|mute video/i.test(text(el) + ' ' + (el.getAttribute('aria-label') || '')),
    )
    const hero = document.querySelector('[data-listing-hero], .listing-hero') || document.querySelector('main')
    return {
      url: window.location.href,
      title: text(document.querySelector('h1')).slice(0, 160),
      videoCount: videos.length,
      videos: videos.map((v) => ({
        src: v.currentSrc || v.getAttribute('src'),
        ready: v.readyState,
        w: Math.round(v.getBoundingClientRect().width),
        h: Math.round(v.getBoundingClientRect().height),
      })),
      unmute: unmute.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: text(el).slice(0, 40),
          aria: el.getAttribute('aria-label'),
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          visible: r.width > 0 && r.height > 0,
        }
      }),
      heroText: text(hero).slice(0, 240),
    }
  })
}

function listingKeysFromHtml(html) {
  const keys = []
  const re = /\/homes-for-sale\/[^"'>\s]+-(\d{6,})/g
  let m
  while ((m = re.exec(html))) keys.push(m[1])
  return [...new Set(keys)]
}

async function fetchPages() {
  const headers = { ...CI_PROBE_HEADERS }
  const p1 = `${BASE}/homes-for-sale/bend?sort=newest&statusFilter=active&page=1&view=3&perPage=9`
  const p2 = `${BASE}/homes-for-sale/bend?sort=newest&statusFilter=active&page=2&view=3&perPage=9`
  const [r1, r2] = await Promise.all([fetch(p1, { headers }), fetch(p2, { headers })])
  const [h1, h2] = await Promise.all([r1.text(), r2.text()])
  const k1 = listingKeysFromHtml(h1)
  const k2 = listingKeysFromHtml(h2)
  const overlap = k1.filter((k) => k2.includes(k))
  return {
    p1: { status: r1.status, keys: k1, count: k1.length, url: p1 },
    p2: { status: r2.status, keys: k2, count: k2.length, url: p2 },
    overlap,
    disjoint: overlap.length === 0 && k1.length > 0 && k2.length > 0,
  }
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const report = {
    fetchedAt: new Date().toISOString(),
    base: BASE,
    pagination: await fetchPages(),
    views: {},
  }

  const browser = await chromium.launch({ headless: true })
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 900
    const page = await browser.newPage({
      viewport: { width, height },
      extraHTTPHeaders: CI_PROBE_HEADERS,
    })
    const key = `w${width}`
    report.views[key] = {}

    // First paint map tiles — capture immediately after load
    const searchRes = await page.goto(`${BASE}/homes-for-sale`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    report.views[key].firstPaint = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.gm-style img, canvas')]
      return {
        tileCount: tiles.length,
        sized: tiles.filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 40 && r.height > 40
        }).length,
      }
    })
    await shot(page, `${PREFIX}search_${width}_firstpaint`)
    await page.waitForTimeout(2800)
    await dismissChrome(page)
    const searchChrome = await inspectSearchChrome(page)
    const mapToggle = searchChrome.mapList.find((el) => /^map$/i.test(el.text || ''))
    const listToggle = searchChrome.mapList.find((el) => /^list$/i.test(el.text || ''))
    const chipOverlapsToggle =
      overlaps(searchChrome.chipRow || searchChrome.chips.find((c) => c.found), mapToggle) ||
      overlaps(searchChrome.chipRow || searchChrome.chips.find((c) => c.found), listToggle)
    let mapToggleClick = null
    if (width === 390 && mapToggle?.visible) {
      const before = page.url()
      await page.getByRole('button', { name: /^map$/i }).first().click({ timeout: 4000 }).catch(async () => {
        await page.getByRole('tab', { name: /^map$/i }).first().click({ timeout: 2000 }).catch(() => {})
      })
      await page.waitForTimeout(800)
      mapToggleClick = { before, after: page.url(), landed: /view=map|view=list/.test(page.url()) || page.url() !== before }
      await shot(page, `${PREFIX}search_${width}_after_map_toggle`)
    }
    report.views[key].search = {
      http: searchRes?.status() ?? null,
      chrome: searchChrome,
      chipOverlapsToggle,
      mapToggleClick,
    }
    await shot(page, `${PREFIX}search_${width}_top`)

    // All-filters sheet width
    const allFilters = page.getByRole('button', { name: /all filters/i }).first()
    if (await allFilters.isVisible().catch(() => false)) {
      await allFilters.click()
      await page.waitForTimeout(1200)
      report.views[key].sheet = await inspectSheet(page)
      await shot(page, `${PREFIX}search_${width}_filters`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    } else {
      report.views[key].sheet = { open: false, reason: 'All filters not visible' }
    }

    // First card → listing hero unmute
    if (searchChrome.firstCard?.href) {
      const href = searchChrome.firstCard.href
      await page.goto(href.startsWith('http') ? href : `${BASE}${href}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      await page.waitForTimeout(2000)
      await dismissChrome(page)
      report.views[key].listingHero = await inspectListingHero(page)
      await shot(page, `${PREFIX}first_card_${width}`)
    } else {
      report.views[key].listingHero = { skipped: true }
    }

    // beds=4 sheet preview vs applied
    await page.goto(`${BASE}/homes-for-sale?beds=4`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2500)
    await dismissChrome(page)
    report.views[key].beds4applied = await inspectSearchChrome(page)
    await shot(page, `${PREFIX}beds4_${width}_applied`)
    const all2 = page.getByRole('button', { name: /all filters/i }).first()
    if (await all2.isVisible().catch(() => false)) {
      await all2.click()
      await page.waitForTimeout(1500)
      report.views[key].beds4sheet = await inspectSheet(page)
      await shot(page, `${PREFIX}beds4_${width}_sheet`)
      await page.keyboard.press('Escape')
    }

    // SEO pagination visual
    await page.goto(`${BASE}/homes-for-sale/bend?sort=newest&statusFilter=active&page=2&view=3&perPage=9`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page.waitForTimeout(2000)
    await dismissChrome(page)
    report.views[key].seoPage2 = {
      url: page.url(),
      title: await page.locator('h1').first().innerText().catch(() => null),
      cards: await page.evaluate(() =>
        [...document.querySelectorAll('a')]
          .map((a) => a.getAttribute('href') || '')
          .filter((h) => /\/homes-for-sale\/.+-\d{6,}/.test(h))
          .slice(0, 12),
      ),
    }
    await shot(page, `${PREFIX}seo_page2_${width}`)

    await page.close()
  }
  await browser.close()

  writeFileSync(`${ART}/${PREFIX}search_punch_v4.json`, JSON.stringify(report, null, 2))
  const summary = {
    pagination: report.pagination,
  }
  for (const width of [390, 1280]) {
    const v = report.views[`w${width}`]
    summary[width] = {
      firstPaint: v.firstPaint,
      title: v.search?.chrome?.title,
      bandAboveH1: v.search?.chrome?.bandAboveH1,
      headerBottom: v.search?.chrome?.headerBottom,
      h1: v.search?.chrome?.h1,
      chips: v.search?.chrome?.chips?.filter((c) => c.found),
      save: v.search?.chrome?.save,
      alerts: v.search?.chrome?.alerts,
      mapList: v.search?.chrome?.mapList,
      chipOverlapsToggle: v.search?.chipOverlapsToggle,
      mapToggleClick: v.search?.mapToggleClick,
      mapImgs: v.search?.chrome?.mapImgs,
      count: v.search?.chrome?.count,
      sheet: v.sheet,
      listingHero: v.listingHero,
      beds4applied: {
        count: v.beds4applied?.count,
        bodyHead: v.beds4applied?.bodyHead,
      },
      beds4sheet: v.beds4sheet,
      seoPage2: v.seoPage2,
      scroll: { w: v.search?.chrome?.scrollWidth, client: v.search?.chrome?.clientWidth },
    }
  }
  console.log(JSON.stringify({ base: BASE, prefix: PREFIX, summary }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
